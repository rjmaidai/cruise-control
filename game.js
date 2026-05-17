/* Cruise Control — game engine
   Reads window.GAMEFLOW / window.HOTSPOTS / window.VOICE_MANIFEST,
   renders the game on the #stage, plays MP3s with TTS fallback.
   No fetch — everything is preloaded via <script src> shims so file:// works.
*/
(function(){
'use strict';

const GAMEFLOW = window.GAMEFLOW;
const HOTSPOTS = window.HOTSPOTS;
const VOICE_MANIFEST = window.VOICE_MANIFEST;

// ---- DOM refs ----
const $stage = document.getElementById('stage');
const $bg = document.getElementById('bg');
const $hotspots = document.getElementById('hotspots');
const $dialog = document.getElementById('dialog');
const $dialogText = document.getElementById('dialog-text');
const $options = document.getElementById('options');
const $dialogAdvance = document.getElementById('dialog-advance');
const $title = document.getElementById('title');
const $inventory = document.getElementById('inventory');
const $tts = document.getElementById('tts-toggle');
const $intro = document.getElementById('intro-card');
const $introImg = $intro.querySelector('img');
const $winCaption = document.getElementById('win-caption');
const $winHint = document.getElementById('win-hint');
const $loader = document.getElementById('loader');
const $hud = document.getElementById('hud');

// ---- Game state ----
const State = {
  character: null,
  screen: null,
  flags: new Set(),
  inventory: new Set(),
  activeItem: null,
  ending: null,
  // internal: hotspot ids unlocked beyond their default state
  unlocked: new Set(),
  // internal: hotspot ids consumed (item taken etc.) — hidden
  consumed: new Set(),
  // internal: ids whose dialog has been seen (not used yet, but available)
  seenDialog: new Set(),
};
function resetState(){
  State.character = null;
  State.screen = null;
  State.flags = new Set();
  State.inventory = new Set();
  State.activeItem = null;
  State.ending = null;
  State.unlocked = new Set();
  State.consumed = new Set();
  State.seenDialog = new Set();
  document.body.classList.remove('use-mode');
}

// ---- Voice / TTS ----
const Voice = {
  on: true,
  audioMap: new Map(),     // key: speaker||text(trim)  -> filename
  current: null,           // currently playing HTMLAudio or SpeechSynthesisUtterance
  voicesDe: [],
  warnedMissing: new Set(),
  init(){
    for(const entry of VOICE_MANIFEST){
      const key = entry.speaker + '||' + (entry.text||'').trim();
      this.audioMap.set(key, 'assets/voice/' + entry.file);
    }
    const loadVoices = ()=>{
      const all = speechSynthesis.getVoices();
      this.voicesDe = all.filter(v => /^de(-|_|$)/i.test(v.lang));
      if(!this.voicesDe.length) this.voicesDe = all;
    };
    loadVoices();
    if(typeof speechSynthesis !== 'undefined' && speechSynthesis.addEventListener){
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
  },
  stop(){
    if(this.current){
      try{
        if(this.current.tagName === 'AUDIO'){ this.current.pause(); this.current.currentTime = 0; }
      }catch(_){}
      this.current = null;
    }
    try{ speechSynthesis.cancel(); }catch(_){}
  },
  setOn(v){
    this.on = v;
    $tts.textContent = 'STIMME: ' + (v ? 'AN' : 'AUS');
    $tts.classList.toggle('off', !v);
    if(!v) this.stop();
  },
  // play a single dialog line, resolve when done OR user advances
  playLine(speaker, text){
    this.stop();
    if(!this.on) return Promise.resolve('text-only');
    if(speaker === '*') return Promise.resolve('regie'); // never spoken
    const key = speaker + '||' + (text||'').trim();
    const file = this.audioMap.get(key);
    if(window.Music) window.Music.duck(0.25);
    return new Promise((resolve)=>{
      let finished = false;
      const done = (reason)=>{
        if(finished) return; finished = true; this.current = null;
        if(window.Music) window.Music.duck(1);
        resolve(reason);
      };
      if(file){
        const audio = new Audio(file);
        this.current = audio;
        audio.addEventListener('ended', ()=>done('audio-ended'));
        audio.addEventListener('error', ()=>{
          if(!this.warnedMissing.has(file)){
            this.warnedMissing.add(file);
            console.warn('voice file missing or unreadable:', file, 'falling back to TTS for:', key);
          }
          this._tts(speaker, text, done);
        });
        audio.play().catch(err=>{
          // autoplay blocked or other — fall through to TTS
          if(!this.warnedMissing.has(file)){
            this.warnedMissing.add(file);
            console.warn('audio play blocked for', file, err, 'falling back to TTS');
          }
          this._tts(speaker, text, done);
        });
      } else {
        // No recorded line for this text — use TTS
        this._tts(speaker, text, done);
      }
    });
  },
  _tts(speaker, text, done){
    if(typeof speechSynthesis === 'undefined'){ setTimeout(()=>done('no-tts'), 600); return; }
    const utt = new SpeechSynthesisUtterance(text);
    // pick voice profile
    let profile = null;
    if(speaker === 'Arthur' || speaker === 'Beat'){
      const c = GAMEFLOW.characters[speaker.toLowerCase()];
      profile = c && c.tts;
    } else if(GAMEFLOW.npc_voices && GAMEFLOW.npc_voices[speaker]){
      profile = GAMEFLOW.npc_voices[speaker];
    }
    if(profile){
      utt.lang = profile.lang || 'de-DE';
      if(typeof profile.pitch === 'number') utt.pitch = profile.pitch;
      if(typeof profile.rate === 'number') utt.rate = profile.rate;
    } else {
      utt.lang = 'de-DE';
    }
    const v = this.voicesDe[0];
    if(v) utt.voice = v;
    utt.addEventListener('end', ()=>done('tts-ended'));
    utt.addEventListener('error', ()=>done('tts-error'));
    try{ speechSynthesis.speak(utt); this.current = utt; }
    catch(_){ setTimeout(()=>done('no-tts'), 600); }
  },
  skip(){ this.stop(); }
};

// ---- Render helpers ----
function getScreenDef(id){
  return GAMEFLOW.screens.find(s => s.id === id);
}
function getHotspots(id){
  const arr = (HOTSPOTS.screens && HOTSPOTS.screens[id]) || [];
  return arr;
}
function setBackground(src){
  return new Promise((resolve)=>{
    $bg.onload = ()=>{
      const w = $bg.naturalWidth, h = $bg.naturalHeight;
      if(w && h){
        $stage.style.aspectRatio = w + ' / ' + h;
      }
      resolve();
    };
    $bg.onerror = ()=>resolve();
    $bg.src = src;
  });
}
function clearHotspots(){
  $hotspots.innerHTML = '';
}
function isHotspotVisible(hs, screenDef){
  // hidden if consumed (item taken)
  if(State.consumed.has(hs.id)) return false;
  // resolve the gameflow definition for this hotspot
  const def = (screenDef.required_hotspots || []).find(r => r.id === hs.id);
  if(!def){
    // unknown hotspot; we still show it but only as "flavor"
    return true;
  }
  if(def.available_after_flag && !State.flags.has(def.available_after_flag) && !State.unlocked.has(hs.id)){
    return false;
  }
  return true;
}
function getHotspotDef(screenDef, id){
  return (screenDef.required_hotspots || []).find(r => r.id === id);
}
function isExitUnlocked(def){
  if(def.kind !== 'exit') return true;
  if(!def.locked_until_flag) return true;
  return State.flags.has(def.locked_until_flag) || State.unlocked.has(def.id);
}
function renderHotspots(){
  clearHotspots();
  const def = getScreenDef(State.screen);
  const rects = getHotspots(State.screen);
  if(!rects.length){
    console.warn('No hotspots defined for screen', State.screen,
      '— use the H toggle and edit hotspots.json + regenerate data/hotspots.js');
  }
  // index gameflow defs for unknown-hotspot detection
  const validIds = new Set((def.required_hotspots||[]).map(r=>r.id));
  for(const rect of rects){
    if(!validIds.has(rect.id)){
      console.warn('Hotspot id "' + rect.id + '" on screen "' + State.screen + '" is not in gameflow — ignored.');
      continue;
    }
    const hdef = getHotspotDef(def, rect.id);
    if(!isHotspotVisible(rect, def)) continue;
    const el = document.createElement('div');
    el.className = 'hotspot';
    el.dataset.id = rect.id;
    el.dataset.kind = hdef ? hdef.kind : (rect.kind || 'flavor');
    el.dataset.label = (hdef && hdef.label) || rect.label || rect.id;
    if(hdef && hdef.kind === 'exit' && !isExitUnlocked(hdef)) el.classList.add('locked');
    el.style.left = (rect.x*100).toFixed(3)+'%';
    el.style.top  = (rect.y*100).toFixed(3)+'%';
    el.style.width  = (rect.w*100).toFixed(3)+'%';
    el.style.height = (rect.h*100).toFixed(3)+'%';
    el.title = el.dataset.label;
    el.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      onHotspotClick(rect.id);
    });
    $hotspots.appendChild(el);
  }
  renderInventory();
  updateHUD();
}
function renderInventory(){
  $inventory.innerHTML = '';
  const items = GAMEFLOW.inventory.items;
  for(const id of State.inventory){
    const def = items.find(i => i.id === id) || { id, label: id };
    const el = document.createElement('div');
    el.className = 'inv-item' + (State.activeItem === id ? ' active' : '');
    el.textContent = def.label;
    el.title = def.icon_hint || def.label;
    el.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      if(State.activeItem === id){ State.activeItem = null; document.body.classList.remove('use-mode'); }
      else { State.activeItem = id; document.body.classList.add('use-mode'); }
      renderInventory();
      updateHUD();
    });
    $inventory.appendChild(el);
  }
}

// ---- HUD (debug) ----
let HUD_ON = false;
function updateHUD(){
  if(!HUD_ON) return;
  const flags = [...State.flags].join(', ') || '—';
  const inv = [...State.inventory].join(', ') || '—';
  $hud.textContent = `screen:${State.screen}  char:${State.character||'-'}  flags:[${flags}]  inv:[${inv}]  active:${State.activeItem||'-'}  ending:${State.ending||'-'}`;
}
function toggleHUD(){
  HUD_ON = !HUD_ON;
  $hotspots.classList.toggle('debug', HUD_ON);
  $hud.classList.toggle('show', HUD_ON);
  updateHUD();
}

// ---- Screen router ----
async function gotoScreen(id, opts){
  opts = opts || {};
  Voice.stop();
  hideDialog();
  $title.innerHTML = '';
  $winCaption.classList.remove('show');
  $winHint.classList.remove('show');
  // intro card?
  const def = getScreenDef(id);
  if(!def){ console.error('unknown screen', id); return; }

  if(def.intro_card && !opts.skipIntro){
    await showIntroCard(def.intro_card);
  }

  State.screen = id;
  document.body.classList.remove('use-mode');
  State.activeItem = null;

  if(def.type === 'character_select'){
    await setBackground(def.background);
    renderTitleStart(def);
    renderHotspots();
    if(window.Music) window.Music.playForScreen('start');
    return;
  }
  if(def.type === 'ending'){
    const e = def.endings[State.ending] || def.endings.arthur;
    await setBackground(e.background);
    $winCaption.textContent = e.caption;
    $winCaption.classList.add('show');
    $winHint.classList.add('show');
    clearHotspots();
    $inventory.innerHTML = '';
    if(window.Music) window.Music.playForScreen('win');
    // click anywhere returns to start
    const clickHandler = ()=>{
      $stage.removeEventListener('click', clickHandler, true);
      resetState();
      gotoScreen('start', {skipIntro:true});
    };
    setTimeout(()=>{ $stage.addEventListener('click', clickHandler, true); }, 400);
    return;
  }
  // room
  await setBackground(def.background);
  renderHotspots();
  if(window.Music) window.Music.playForScreen(id);
}

function renderTitleStart(def){
  $title.innerHTML =
    '<h1>CRUISE CONTROL</h1>' +
    '<div class="subtitle">' + escapeHtml(GAMEFLOW.meta.subtitle || '') + '</div>' +
    '<div class="pick">' + escapeHtml(def.instruction_text || '') + '</div>';
}

function showIntroCard(src){
  return new Promise((resolve)=>{
    $introImg.src = src;
    $intro.classList.add('show');
    if(window.Music){ window.Music.playIntroJingle(); }
    // Fixed 7s — the intro jingle is exactly that long. No click-skip.
    const timer = setTimeout(()=>{
      $intro.classList.remove('show');
      resolve();
    }, 7000);
    // safety: if the scene tears down (e.g. dev reload), still resolve
    $intro._cancelTimer = timer;
  });
}

// ---- Hotspot click dispatch ----
async function onHotspotClick(id){
  const def = getScreenDef(State.screen);
  const hdef = getHotspotDef(def, id);
  if(!hdef){ return; }

  // SELECT (start screen)
  if(hdef.kind === 'select'){
    const oc = hdef.on_click || {};
    if(oc.set_character) State.character = oc.set_character;
    if(oc.goto) await gotoScreen(oc.goto);
    return;
  }

  // If an item is active, treat click as use(item, target/hotspot)
  if(State.activeItem){
    await tryUseItemOn(id, def, hdef);
    return;
  }

  if(hdef.kind === 'item'){
    await takeItem(def, hdef);
    return;
  }

  // kapitel2 special: first_interaction trigger on kellner or captain
  if(State.screen === 'kapitel2' && def.first_interaction && !State.flags.has('first_interaction_done')){
    if(id === 'kellner' || id === 'captain'){
      await runFirstInteraction(def);
      return;
    }
  }

  if(hdef.kind === 'npc'){
    const block = def.dialogues && def.dialogues[State.character];
    const dialogReady = !!block
      && (!block._hotspot || block._hotspot === hdef.id)
      && (!block.requires_flag || State.flags.has(block.requires_flag) || State.unlocked.has(hdef.id));
    if(dialogReady){
      await openDialog(def, hdef);
    } else {
      // NPC has nothing more to say right now — show flavor if defined, else stay silent
      const flav = def.flavor && def.flavor[id] && def.flavor[id][State.character];
      if(flav) await speakLockedFeedback(flav);
    }
    return;
  }

  if(hdef.kind === 'exit'){
    if(isExitUnlocked(hdef)){
      if(hdef.goto) await gotoScreen(hdef.goto);
    } else {
      // locked feedback
      const lf = def.locked_feedback && def.locked_feedback[State.character];
      if(lf) await speakLockedFeedback(lf);
    }
    return;
  }

  if(hdef.kind === 'flavor'){
    const f = def.flavor && def.flavor[id] && def.flavor[id][State.character];
    if(f) await speakLockedFeedback(f);
    return;
  }

  if(hdef.kind === 'target'){
    // target with no active item -> small flavor
    // no defined effect; ignore quietly
    return;
  }
}

async function speakLockedFeedback(text){
  showDialog();
  setDialogLine(State.character === 'arthur' ? 'Arthur' : 'Beat', text);
  await Voice.playLine(State.character === 'arthur' ? 'Arthur' : 'Beat', text);
  await waitForClickOrTimeout(1200);
  hideDialog();
}

// ---- Items & use ----
async function takeItem(def, hdef){
  // brotkorb requires available_after_flag
  if(hdef.available_after_flag && !State.flags.has(hdef.available_after_flag) && !State.unlocked.has(hdef.id)){
    return;
  }
  if(hdef.gives_item){
    State.inventory.add(hdef.gives_item);
  }
  if(hdef.consume_hotspot_after_take){
    State.consumed.add(hdef.id);
  } else {
    // by default also consume to avoid duplicates
    State.consumed.add(hdef.id);
  }
  renderHotspots();
}

async function tryUseItemOn(targetId, def, targetHdef){
  const item = State.activeItem;
  const actions = (def.puzzle && def.puzzle.use_actions) || [];
  const match = actions.find(a => a.item === item && a.target === targetId);
  // deactivate cursor regardless of result
  const clearActive = ()=>{
    State.activeItem = null;
    document.body.classList.remove('use-mode');
    renderInventory();
    updateHUD();
  };
  if(!match){
    clearActive();
    // small "doesn't work" feedback
    const speaker = State.character === 'arthur' ? 'Arthur' : 'Beat';
    const txt = State.character === 'arthur' ? 'Honestly? Das ergibt grad keinen Sinn.' : 'Sinnlos.';
    showDialog();
    setDialogLine(speaker, txt);
    await Voice.playLine(speaker, txt);
    await waitForClickOrTimeout(1000);
    hideDialog();
    return;
  }
  // requires_flag?
  if(match.requires_flag && !State.flags.has(match.requires_flag)){
    clearActive();
    const speaker = State.character === 'arthur' ? 'Arthur' : 'Beat';
    const txt = State.character === 'arthur' ? 'Wait, das fuehlt sich noch nicht ready an.' : 'Noch nicht.';
    showDialog();
    setDialogLine(speaker, txt);
    await Voice.playLine(speaker, txt);
    await waitForClickOrTimeout(1000);
    hideDialog();
    return;
  }
  clearActive();
  // play lines
  showDialog();
  for(const ln of match.lines || []){
    setDialogLine(ln.speaker, ln.line);
    await Voice.playLine(ln.speaker, ln.line);
    await waitForClickOrTimeout(ln.speaker === '*' ? 1800 : 400);
  }
  hideDialog();
  await applyEffects(match.effects || []);
  renderHotspots();
}

// ---- First interaction (kapitel2) ----
async function runFirstInteraction(def){
  State.flags.add('first_interaction_done');
  showDialog();
  for(const ln of def.first_interaction.lines || []){
    setDialogLine(ln.speaker, ln.line);
    await Voice.playLine(ln.speaker, ln.line);
    await waitForClickOrTimeout(ln.speaker === '*' ? 1800 : 400);
  }
  hideDialog();
  await applyEffects(def.first_interaction.effects || []);
  renderHotspots();
}

// ---- Effects ----
async function applyEffects(effects){
  for(const eff of effects){
    if(eff.set_flag) State.flags.add(eff.set_flag);
    if(eff.unlock_hotspot) State.unlocked.add(eff.unlock_hotspot);
    if(eff.give_item) State.inventory.add(eff.give_item);
    if(eff.remove_item) State.inventory.delete(eff.remove_item);
    if(eff.ending) State.ending = eff.ending;
    if(eff.goto){
      await gotoScreen(eff.goto);
      return; // stop applying after navigation
    }
  }
}

// ---- Dialog engine ----
function showDialog(){
  $dialog.classList.add('show');
  $options.classList.remove('show');
  $options.innerHTML = '';
}
function hideDialog(){
  $dialog.classList.remove('show');
  $options.classList.remove('show');
  $options.innerHTML = '';
  $dialogText.textContent = '';
}
function setDialogLine(speaker, text){
  $dialogText.classList.toggle('regie', speaker === '*');
  if(speaker === '*'){
    $dialogText.textContent = text;
  } else {
    $dialogText.innerHTML = '<span class="speaker">' + escapeHtml(speaker) + ':</span>' + escapeHtml(text);
  }
  $dialogAdvance.style.display = 'block';
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

async function openDialog(def, hdef){
  // pick dialog branch by character; some dialogues have _hotspot scoping
  const block = def.dialogues && def.dialogues[State.character];
  if(!block){ return; }
  // if _hotspot is set, only this dialog when matching id
  if(block._hotspot && block._hotspot !== hdef.id){
    return;
  }
  // requires_flag (e.g. telefon)
  if(block.requires_flag && !State.flags.has(block.requires_flag) && !State.unlocked.has(hdef.id) && hdef.id !== 'telefon'){
    return;
  }
  if(block.requires_flag && !State.flags.has(block.requires_flag)){
    // even if telefon hotspot is unlocked, gate the dialog. (unlocked_hotspot also sets the flag in practice)
    if(!State.unlocked.has(hdef.id)) return;
  }

  showDialog();
  // entry lines
  for(const ln of block.entry || []){
    setDialogLine(ln.speaker, ln.line);
    await Voice.playLine(ln.speaker, ln.line);
    await waitForClickOrTimeout(ln.speaker === '*' ? 1500 : 300);
  }
  // options loop until solve
  let solved = false;
  while(!solved){
    const choice = await pickOption(block.options || []);
    if(!choice){ break; }
    // resolve branching
    let lines = choice.lines || [];
    let result = choice.result || { type:'none' };
    if(choice.branch_on_flag){
      const hasFlag = State.flags.has(choice.branch_on_flag);
      const branch = hasFlag ? choice.if_true : choice.if_false;
      if(branch){
        lines = branch.lines || [];
        result = branch.result || { type:'none' };
      }
    }
    // play option lines
    setDialogLine('*', '...'); // brief separator (silent regie)
    for(const ln of lines){
      setDialogLine(ln.speaker, ln.line);
      await Voice.playLine(ln.speaker, ln.line);
      await waitForClickOrTimeout(ln.speaker === '*' ? 1500 : 300);
    }
    if(result.type === 'solve'){
      solved = true;
      hideDialog();
      await applyEffects(result.effects || []);
      renderHotspots();
      return;
    }
    // none -> back to options (loop)
  }
  hideDialog();
}

function pickOption(options){
  return new Promise((resolve)=>{
    // filter visible options
    const visible = options.filter(o => {
      if(o.id === 'SCHWEIGEN') return State.character === 'beat';
      if(o.id === 'ENDE')      return State.character === 'arthur';
      return true;
    });
    $options.innerHTML = '';
    $dialogText.textContent = '';
    $dialogAdvance.style.display = 'none';
    let finished = false;
    const finish = (val)=>{
      if(finished) return;
      finished = true;
      document.removeEventListener('keydown', onKey, true);
      $options.classList.remove('show');
      resolve(val);
    };
    const onKey = (ev)=>{
      if(ev.key === 'Escape'){ ev.stopPropagation(); finish(null); }
    };
    document.addEventListener('keydown', onKey, true);
    for(const o of visible){
      const b = document.createElement('button');
      b.className = 'opt' + (o.id==='SCHWEIGEN' ? ' schweigen' : '') + (o.id==='ENDE' ? ' ende' : '');
      b.type = 'button';
      b.textContent = o.label || o.id;
      b.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        finish(o);
      });
      $options.appendChild(b);
    }
    // last entry: "Verlassen" — always available, leaves the dialog without effect
    const leave = document.createElement('button');
    leave.className = 'opt leave';
    leave.type = 'button';
    leave.textContent = '(weggehen)';
    leave.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      finish(null);
    });
    $options.appendChild(leave);
    $options.classList.add('show');
  });
}

// ---- Click-to-skip ----
function waitForClickOrTimeout(ms){
  return new Promise((resolve)=>{
    let done = false;
    const finish = ()=>{
      if(done) return; done = true;
      $dialog.removeEventListener('click', advance, true);
      clearTimeout(t);
      resolve();
    };
    // small minimum so audio gets a chance to start playing
    const t = setTimeout(finish, Math.max(120, ms||0));
    function advance(ev){
      // ignore clicks on option buttons
      if(ev.target.closest && ev.target.closest('.opt')) return;
      Voice.skip();
      finish();
    }
    $dialog.addEventListener('click', advance, true);
  });
}

// ---- Init ----
function bindGlobalInputs(){
  $tts.addEventListener('click', ()=>Voice.setOn(!Voice.on));
  document.addEventListener('keydown', (ev)=>{
    if(ev.key === 'h' || ev.key === 'H'){ toggleHUD(); }
    else if(ev.key === 'm' || ev.key === 'M'){ Voice.setOn(!Voice.on); }
    else if(ev.key === 'Escape'){
      if(State.activeItem){
        State.activeItem = null;
        document.body.classList.remove('use-mode');
        renderInventory();
        updateHUD();
      }
    }
  });
  // right-click also cancels active item
  document.addEventListener('contextmenu', (ev)=>{
    if(State.activeItem){
      ev.preventDefault();
      State.activeItem = null;
      document.body.classList.remove('use-mode');
      renderInventory();
      updateHUD();
    }
  });
}

async function start(){
  if(!GAMEFLOW || !HOTSPOTS || !VOICE_MANIFEST){
    $loader.textContent = 'FEHLER: data/*.js nicht geladen';
    return;
  }
  Voice.init();
  Voice.setOn(true);
  bindGlobalInputs();
  // Unlock + (re-)kick off music on the user's first interaction. The browser
  // suspends AudioContext on page load — without this the title loop would
  // never start.
  const audioUnlock = ()=>{
    if(window.Music){
      window.Music.unlock();
      if(State.screen) window.Music.playForScreen(State.screen);
    }
  };
  document.addEventListener('click',   audioUnlock, { once: true });
  document.addEventListener('keydown', audioUnlock, { once: true });
  $loader.classList.add('hidden');
  resetState();
  await gotoScreen('start', { skipIntro:true });
}

window.addEventListener('DOMContentLoaded', start);

// expose for debugging
window.CC = { State, Voice, gotoScreen, GAMEFLOW, HOTSPOTS };
})();
