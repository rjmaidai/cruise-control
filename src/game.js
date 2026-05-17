/* ============================================================
   CRUISE CONTROL — game.js
   Single-file implementation of BUILD_SPEC.md:
     §3  Datenfluss + hotspots from hotspots.json
     §4  State machine (character, screen, flags, inventory, activeItem, ending)
     §5  Dialog engine + TTS (Web Speech API)
     §6  Puzzle logic per room (data-driven via gameflow.json)
     §7  Intro cards
     §10 Robust to missing hotspots: warn, never crash
   Designed to run via `node serve.mjs` (or any static server). Plain script,
   no build step.
   ============================================================ */

(() => {
"use strict";

/* ============================================================
   0. CONFIG + HELPERS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const INTRO_AUTO_MS = 2500;

const log  = (...a) => console.log("[cc]", ...a);
const warn = (...a) => console.warn("[cc]", ...a);

/* ============================================================
   1. STATE
   ============================================================ */
const state = {
  character: null,          // "arthur" | "beat"
  screen: "start",          // current screen id
  prevScreen: null,
  flags: new Set(),
  inventory: new Set(),
  activeItem: null,         // itemId for use-with
  ending: null,             // "arthur" | "beat"
  ttsEnabled: true,
  debugHotspots: false,
  busy: false,              // dialog/intro running, ignore stray clicks
};

let GAMEFLOW = null;
let HOTSPOTS = null;
let SCREENS  = {};          // id -> screen object
let ITEMS    = {};          // id -> item definition

/* ============================================================
   2. LOADERS
   ============================================================ */
async function loadJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

async function boot() {
  try {
    [GAMEFLOW, HOTSPOTS] = await Promise.all([
      loadJson("gameflow.json"),
      loadJson("hotspots.json"),
    ]);
  } catch (err) {
    showFatal(
      "gameflow.json oder hotspots.json konnte nicht geladen werden.",
      err.message + "\n\nWird das Spiel direkt per file:// geöffnet? " +
      "Bitte über den Dev-Server starten: `node serve.mjs`."
    );
    return;
  }

  for (const s of GAMEFLOW.screens) SCREENS[s.id] = s;
  for (const it of (GAMEFLOW.inventory?.items ?? [])) ITEMS[it.id] = it;

  // TTS toggle persistence
  state.ttsEnabled = localStorage.getItem("cc.tts") !== "0";
  updateTtsButton();
  initVoices();

  // input wiring
  wireInputs();

  // start
  goto("start", { skipIntro: true });
}

/* ============================================================
   3. RENDER: SCREEN + BACKGROUND + HOTSPOTS
   ============================================================ */
function goto(screenId, { skipIntro = false } = {}) {
  const screen = SCREENS[screenId];
  if (!screen) { warn("unknown screen:", screenId); return; }
  closeDialog();
  hideFlavor();
  state.prevScreen = state.screen;
  state.screen = screenId;

  if (screenId === "win") return showWin(state.ending ?? "arthur");

  if (!skipIntro && screen.intro_card) {
    showIntroCard(screen.intro_card, () => renderRoom(screen));
  } else {
    renderRoom(screen);
  }
}

function renderRoom(screen) {
  setGoal(screen.goal || "");
  loadBg(screen.background);
  renderHotspots(screen);
  hideIntroCard();
  hideWinCard();
}

function loadBg(path) {
  const bg = $("bg");
  const miss = $("missingAsset");
  bg.classList.add("loading");
  miss.hidden = true;
  bg.onload = () => { bg.classList.remove("loading"); };
  bg.onerror = () => {
    bg.classList.remove("loading");
    bg.removeAttribute("src");
    miss.hidden = false;
    $("missingPath").innerHTML = `Erwartet: <code>${path}</code>`;
  };
  bg.src = path + "?v=" + Date.now();
}

function setGoal(t) { $("goalBar").textContent = t.toUpperCase(); }

function renderHotspots(screen) {
  const layer = $("hotspots");
  layer.innerHTML = "";

  const specs   = screen.required_hotspots ?? [];
  const coords  = HOTSPOTS?.screens?.[screen.id] ?? [];
  const coordMap = Object.fromEntries(coords.map(c => [c.id, c]));

  // also render extra (custom) hotspots that are in coords but not in spec
  const allIds = new Set([...specs.map(s => s.id), ...coords.map(c => c.id)]);
  const missing = [];

  for (const id of allIds) {
    const spec  = specs.find(s => s.id === id);
    const coord = coordMap[id];
    if (!coord) { missing.push(id); continue; }
    if (!spec) {
      log(`extra hotspot in coords without spec: ${id} (treated as flavor)`);
    }
    const el = buildHotspotEl(screen, spec || { id, kind: "flavor", label: id }, coord);
    layer.appendChild(el);
  }
  if (missing.length) warn(`screen "${screen.id}" — fehlende Hotspot-Koordinaten:`, missing);

  refreshDebugOverlay();
}

function buildHotspotEl(screen, spec, coord) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hs " + (spec.kind || "");
  el.dataset.id   = spec.id;
  el.dataset.kind = spec.kind || "";
  el.dataset.label = labelFor(screen, spec);
  el.style.left   = (coord.x * 100) + "%";
  el.style.top    = (coord.y * 100) + "%";
  el.style.width  = (coord.w * 100) + "%";
  el.style.height = (coord.h * 100) + "%";

  // initial enabled state for exits / items / npcs gated by flags
  applyHotspotGating(el, screen, spec);

  el.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (state.busy) return;
    onHotspot(spec, screen);
  });
  return el;
}

function labelFor(screen, spec) {
  // exit: show locked label until unlocked (kapitel2 telefon has label_locked)
  if (spec.label_locked && spec.kind === "npc" && !state.flags.has(spec.id + "_freed")) {
    // not used currently — telefon uses requires_flag
  }
  return spec.label || spec.id;
}

function applyHotspotGating(el, screen, spec) {
  // visibility/locked classes — actual click logic re-checks
  el.classList.toggle("locked",
    spec.kind === "exit" && spec.locked_until_flag && !state.flags.has(spec.locked_until_flag));
  // items only visible after a flag (e.g. brotkorb after telefon_geloest)
  if (spec.kind === "item" && spec.available_after_flag && !state.flags.has(spec.available_after_flag)) {
    el.style.display = "none";
  }
  // npc with requires_flag (telefon)
  if (spec.kind === "npc") {
    const dlg = screen.dialogues?.[state.character];
    if (dlg && dlg._hotspot === spec.id && dlg.requires_flag && !state.flags.has(dlg.requires_flag)) {
      // dim slightly; click should give a small hint
      el.style.opacity = 0.65;
    } else {
      el.style.opacity = 1;
    }
  }
}

/* ============================================================
   4. INPUT DISPATCH
   ============================================================ */
function onHotspot(spec, screen) {
  // active-item mode → use(item, target/anything)
  if (state.activeItem) {
    return doUse(state.activeItem, spec, screen);
  }

  switch (spec.kind) {
    case "select":  return doSelect(spec);
    case "npc":     return doNpc(spec, screen);
    case "item":    return doTakeItem(spec, screen);
    case "target":  return showFlavor(state.character, "Ich brauche etwas, das ich damit verwende.");
    case "exit":    return doExit(spec, screen);
    case "flavor":  return doFlavor(spec, screen);
    default:        return showFlavor(state.character, "Hm.");
  }
}

function doSelect(spec) {
  // start screen — set character + goto
  const click = spec.on_click || {};
  if (click.set_character) {
    state.character = click.set_character;
    log("character chosen:", state.character);
  }
  if (click.goto) goto(click.goto);
}

function doExit(spec, screen) {
  if (spec.locked_until_flag && !state.flags.has(spec.locked_until_flag)) {
    const fb = screen.locked_feedback?.[state.character];
    if (fb) showFlavor(state.character, fb);
    return;
  }
  if (spec.goto) goto(spec.goto);
}

function doFlavor(spec, screen) {
  const t = screen.flavor?.[spec.id]?.[state.character];
  if (t) showFlavor(state.character, t);
  else   showFlavor(state.character, "...");
}

function doTakeItem(spec, screen) {
  // gating
  if (spec.available_after_flag && !state.flags.has(spec.available_after_flag)) return;
  if (spec.gives_item) {
    addItem(spec.gives_item);
  }
  if (spec.consume_hotspot_after_take) {
    // remove from screen visually (don't re-add on re-render until flag cleared)
    state.flags.add("__consumed_" + screen.id + "_" + spec.id);
  }
  // brief subtitle
  const it = ITEMS[spec.gives_item];
  showFlavor(state.character, `${it?.label || spec.gives_item} genommen.`);
  // re-render to apply consumption
  renderHotspots(screen);
}

function doNpc(spec, screen) {
  // first_interaction trigger (kapitel2: kellner OR captain before kellner_isst)
  const fi = screen.first_interaction;
  if (fi && !state.flags.has("first_interaction_" + screen.id)) {
    if (spec.id === "kellner" || (spec.id === "captain" && !state.flags.has("kellner_isst"))) {
      state.flags.add("first_interaction_" + screen.id);
      playDialogSequence(fi.lines, fi.effects, screen);
      return;
    }
  }

  // dialog for this character
  const dlg = screen.dialogues?.[state.character];
  if (!dlg) return showFlavor(state.character, "...");
  if (dlg._hotspot && dlg._hotspot !== spec.id) {
    // not the right NPC for the dialog block → flavor fallback
    return showFlavor(state.character, "...");
  }
  if (dlg.requires_flag && !state.flags.has(dlg.requires_flag)) {
    // e.g. telefon before telefon_klingelt
    return showFlavor(state.character, "Da ist gerade nichts.");
  }
  openDialog(dlg, screen);
}

/* USE(item, target) ----------------------------------------- */
function doUse(itemId, spec, screen) {
  const actions = screen.puzzle?.use_actions ?? [];
  const match = actions.find(a => a.item === itemId && a.target === spec.id);
  if (!match) {
    // wrong target — small feedback, deactivate
    deactivateItem();
    return showFlavor(state.character, "Das passt hier nicht.");
  }
  if (match.requires_flag && !state.flags.has(match.requires_flag)) {
    deactivateItem();
    return showFlavor(state.character, "Noch nicht.");
  }
  deactivateItem();
  playDialogSequence(match.lines, match.effects, screen);
}

/* ============================================================
   5. EFFECTS
   ============================================================ */
function applyEffects(effects, screen) {
  if (!Array.isArray(effects)) return;
  let needsGoto = null;
  for (const e of effects) {
    if (e.set_flag)       { state.flags.add(e.set_flag); log("flag:", e.set_flag); }
    if (e.unlock_hotspot) { log("unlock:", e.unlock_hotspot); /* re-render handles it */ }
    if (e.give_item)      addItem(e.give_item);
    if (e.remove_item)    removeItem(e.remove_item);
    if (e.ending)         { state.ending = e.ending; log("ending:", e.ending); }
    if (e.goto)           needsGoto = e.goto;
  }
  // visual refresh
  if (screen && state.screen === screen.id) {
    renderHotspots(SCREENS[state.screen]);
  }
  if (needsGoto) goto(needsGoto);
}

/* ============================================================
   6. INVENTORY
   ============================================================ */
function addItem(id) {
  if (!ITEMS[id]) warn("unknown item:", id);
  state.inventory.add(id);
  renderInventory();
}
function removeItem(id) {
  state.inventory.delete(id);
  if (state.activeItem === id) deactivateItem();
  renderInventory();
}
function renderInventory() {
  const bar = $("inventory");
  bar.innerHTML = "";
  if (state.inventory.size === 0) {
    const e = document.createElement("div");
    e.className = "invEmpty";
    e.textContent = "INVENTAR LEER";
    bar.appendChild(e);
    return;
  }
  for (const id of state.inventory) {
    const it = ITEMS[id] || { id, label: id };
    const el = document.createElement("button");
    el.className = "invItem" + (state.activeItem === id ? " active" : "");
    el.title = it.icon_hint || it.label;
    el.innerHTML = `<span class="ic"></span><span>${it.label}</span>`;
    el.addEventListener("click", () => {
      if (state.activeItem === id) deactivateItem();
      else activateItem(id);
    });
    bar.appendChild(el);
  }
}
function activateItem(id) {
  if (state.busy) return;
  state.activeItem = id;
  document.body.classList.add("using");
  renderInventory();
}
function deactivateItem() {
  state.activeItem = null;
  document.body.classList.remove("using");
  renderInventory();
}

/* ============================================================
   7. DIALOG ENGINE
   ============================================================ */
let currentDialog = null;
let currentLines  = null;
let currentLineIx = 0;
let currentLineAdvance = null; // resolves the playLine promise

function openDialog(dlg, screen) {
  currentDialog = { dlg, screen };
  state.busy = true;
  $("dialog").hidden = false;
  $("dlgLine").innerHTML = "";
  $("dlgOptions").innerHTML = "";
  setTimeout(() => playLines(dlg.entry || []).then(() => showOptions(dlg)), 0);
}

function showOptions(dlg) {
  if (!currentDialog) return;
  $("dlgLine").innerHTML = "<span class='sp dim'>›</span> Was sagst du?";
  const opts = $("dlgOptions");
  opts.innerHTML = "";
  for (const opt of dlg.options || []) {
    if (opt.id === "SCHWEIGEN" && state.character !== "beat") continue;
    if (opt.id === "ENDE" && state.character !== "arthur") continue;
    const b = document.createElement("button");
    b.className = "dlgOpt";
    if (opt.id === "SCHWEIGEN") b.classList.add("schweigen");
    if (opt.id === "ENDE")      b.classList.add("ende");
    b.textContent = opt.label;
    b.addEventListener("click", () => onOption(opt));
    opts.appendChild(b);
  }
}

function onOption(opt) {
  if (!currentDialog) return;
  $("dlgOptions").innerHTML = "";
  // branch_on_flag → resolve to a concrete {lines, result}
  let resolved = opt;
  if (opt.branch_on_flag) {
    const branch = state.flags.has(opt.branch_on_flag) ? opt.if_true : opt.if_false;
    resolved = { ...opt, lines: branch?.lines || [], result: branch?.result || { type: "none" } };
  }
  playLines(resolved.lines || []).then(() => {
    const result = resolved.result || { type: "none" };
    if (result.type === "solve") {
      const dlg = currentDialog?.dlg;
      const screen = currentDialog?.screen;
      closeDialog();
      applyEffects(result.effects, screen);
    } else {
      // none → back to options
      showOptions(currentDialog.dlg);
    }
  });
}

function closeDialog() {
  cancelTts();
  currentDialog = null;
  currentLines = null;
  currentLineIx = 0;
  if (currentLineAdvance) { currentLineAdvance(); currentLineAdvance = null; }
  $("dialog").hidden = true;
  state.busy = false;
}

/* Plays a sequence (e.g. entry, lines, first_interaction.lines). Returns promise. */
function playLines(lines) {
  return new Promise(async (resolve) => {
    if (!lines || lines.length === 0) return resolve();
    state.busy = true;
    $("dialog").hidden = false;
    $("dlgOptions").innerHTML = "";
    for (const line of lines) {
      await playLine(line);
    }
    resolve();
  });
}

/* used by use-actions and first_interaction (no dialog options after) */
function playDialogSequence(lines, effects, screen) {
  state.busy = true;
  $("dialog").hidden = false;
  $("dlgOptions").innerHTML = "";
  playLines(lines).then(() => {
    setTimeout(() => {
      $("dialog").hidden = true;
      state.busy = false;
      applyEffects(effects, screen);
    }, 250);
  });
}

function playLine(line) {
  return new Promise((resolve) => {
    const isRegie = line.speaker === "*";
    const el = $("dlgLine");
    el.classList.toggle("regie", isRegie);
    if (isRegie) {
      el.innerHTML = `<i>${escapeHtml(line.line)}</i>`;
    } else {
      const isSelf = (line.speaker === "Arthur" || line.speaker === "Beat") &&
                     (line.speaker.toLowerCase() === state.character);
      el.innerHTML = `<span class="sp ${isSelf ? "self" : ""}">${escapeHtml(line.speaker)}:</span>${escapeHtml(line.line)}`;
    }

    currentLineAdvance = () => { currentLineAdvance = null; resolve(); };

    if (isRegie || !state.ttsEnabled) {
      // text only: auto-advance after a short readable delay (or click)
      const ms = readDelay(line.line);
      const t  = setTimeout(() => { if (currentLineAdvance) currentLineAdvance(); }, ms);
      currentLineAdvance = () => { clearTimeout(t); currentLineAdvance = null; resolve(); };
    } else {
      speak(line, () => { if (currentLineAdvance) currentLineAdvance(); });
    }
  });
}

function readDelay(text) {
  const ms = 900 + text.length * 38;
  return Math.min(7000, ms);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
  }[c]));
}

/* ============================================================
   8. TTS — Web Speech API
   ============================================================ */
let voices = [];
let deVoice = null;
let speaking = null;

function initVoices() {
  const pick = () => {
    voices = window.speechSynthesis?.getVoices?.() || [];
    deVoice = voices.find(v => /^de(-|_|$)/i.test(v.lang)) || voices[0] || null;
    log("TTS voices:", voices.length, "de:", deVoice?.name);
  };
  pick();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = pick;
  }
}

function speak(line, onend) {
  if (!window.speechSynthesis) { onend?.(); return; }
  cancelTts();
  const profile = voiceProfileFor(line);
  const utt = new SpeechSynthesisUtterance(line.line);
  if (deVoice) utt.voice = deVoice;
  utt.lang  = profile.lang  || "de-DE";
  utt.pitch = profile.pitch ?? 1;
  utt.rate  = profile.rate  ?? 1;
  utt.onend = () => { speaking = null; onend?.(); };
  utt.onerror = () => { speaking = null; onend?.(); };
  speaking = utt;
  window.speechSynthesis.speak(utt);
}

function voiceProfileFor(line) {
  const ch = GAMEFLOW.characters || {};
  const np = GAMEFLOW.npc_voices || {};
  if (line.speaker === "Arthur" || line.speaker === "Beat") {
    return ch[line.speaker.toLowerCase()]?.tts || {};
  }
  return np[line.speaker] || {};
}

function cancelTts() {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  speaking = null;
}

function toggleTts() {
  state.ttsEnabled = !state.ttsEnabled;
  localStorage.setItem("cc.tts", state.ttsEnabled ? "1" : "0");
  if (!state.ttsEnabled) cancelTts();
  updateTtsButton();
}
function updateTtsButton() {
  const b = $("ttsToggle");
  b.classList.toggle("off", !state.ttsEnabled);
  b.querySelector(".ico").textContent = state.ttsEnabled ? "🔊" : "🔇";
}

/* ============================================================
   9. INTRO CARD + WIN
   ============================================================ */
let introTimer = null;
function showIntroCard(src, then) {
  state.busy = true;
  const card = $("introCard");
  $("introImg").src = src + "?v=" + Date.now();
  card.hidden = false;
  const dismiss = () => {
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    card.removeEventListener("click", dismiss);
    card.hidden = true;
    state.busy = false;
    then?.();
  };
  card.addEventListener("click", dismiss);
  introTimer = setTimeout(dismiss, INTRO_AUTO_MS);
}
function hideIntroCard() { $("introCard").hidden = true; }

function showWin(endingId) {
  const winScreen = SCREENS["win"];
  const ending = winScreen?.endings?.[endingId];
  if (!ending) return goto("start", { skipIntro: true });
  const card = $("winCard");
  $("winImg").src = ending.background + "?v=" + Date.now();
  $("winCaption").textContent = ending.caption || "";
  card.hidden = false;
  const dismiss = () => {
    card.removeEventListener("click", dismiss);
    card.hidden = true;
    resetState();
    goto("start", { skipIntro: true });
  };
  card.addEventListener("click", dismiss);
  state.busy = false;
  setGoal("");
}
function hideWinCard() { $("winCard").hidden = true; }

function resetState() {
  state.character = null;
  state.flags.clear();
  state.inventory.clear();
  state.activeItem = null;
  state.ending = null;
  deactivateItem();
  renderInventory();
}

/* ============================================================
   10. FLAVOR / LOCKED-FEEDBACK BUBBLE
   ============================================================ */
let flavorTimer = null;
function showFlavor(character, text) {
  if (!text) return;
  const box = $("flavorBox");
  const isSelf = !!character;
  const speakerName = character === "arthur" ? "Arthur" :
                      character === "beat"   ? "Beat"   : "";
  box.innerHTML = (speakerName ? `<span class="sp">${speakerName}:</span>` : "") + escapeHtml(text);
  box.hidden = false;
  if (state.ttsEnabled && speakerName) {
    speak({ speaker: speakerName, line: text }, () => {});
  }
  if (flavorTimer) clearTimeout(flavorTimer);
  const ms = readDelay(text);
  flavorTimer = setTimeout(hideFlavor, ms);
}
function hideFlavor() {
  $("flavorBox").hidden = true;
  if (flavorTimer) { clearTimeout(flavorTimer); flavorTimer = null; }
}

/* ============================================================
   11. DEBUG OVERLAY (H)
   ============================================================ */
function toggleDebug() {
  state.debugHotspots = !state.debugHotspots;
  $("debugBadge").hidden = !state.debugHotspots;
  refreshDebugOverlay();
}
function refreshDebugOverlay() {
  const ov = $("debugOverlay");
  ov.hidden = !state.debugHotspots;
  ov.innerHTML = "";
  if (!state.debugHotspots) return;
  const coords = HOTSPOTS?.screens?.[state.screen] ?? [];
  const specs  = SCREENS[state.screen]?.required_hotspots ?? [];
  for (const c of coords) {
    const spec = specs.find(s => s.id === c.id);
    const kind = spec?.kind || c.kind || "custom";
    const el = document.createElement("div");
    el.className = "dh " + kind;
    el.style.left   = (c.x * 100) + "%";
    el.style.top    = (c.y * 100) + "%";
    el.style.width  = (c.w * 100) + "%";
    el.style.height = (c.h * 100) + "%";
    el.innerHTML = `<span>${kind} · ${c.id}</span>`;
    ov.appendChild(el);
  }
  // also flag missing required hotspots in the corner
  const placed = new Set(coords.map(c => c.id));
  const missing = specs.filter(s => !placed.has(s.id));
  if (missing.length) {
    const el = document.createElement("div");
    el.className = "dh";
    el.style.cssText = "left:8px;top:8px;width:auto;height:auto;padding:6px 9px;background:#7a0c1c;border-color:#ff5566";
    el.innerHTML = `<span style='position:static;background:none;padding:0'>fehlend: ${missing.map(m=>m.id).join(", ")}</span>`;
    ov.appendChild(el);
  }
}

/* ============================================================
   12. INPUT WIRING
   ============================================================ */
function wireInputs() {
  $("ttsToggle").addEventListener("click", toggleTts);

  // dialog click-to-advance
  $("dlgLine").addEventListener("click", () => {
    if (currentLineAdvance) currentLineAdvance();
  });

  // ESC / right click clears active item
  document.addEventListener("contextmenu", (e) => {
    if (state.activeItem) { e.preventDefault(); deactivateItem(); }
  });

  // Keys
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    switch (e.key) {
      case "h": case "H": toggleDebug(); break;
      case "t": case "T": toggleTts(); break;
      case "Escape":      if (state.activeItem) deactivateItem(); break;
      case " ":           // space advances current line
      case "Enter":       if (currentLineAdvance) { e.preventDefault(); currentLineAdvance(); } break;
      case "s": case "S": if (currentLineAdvance) currentLineAdvance(); break; // skip
    }
  });

  // intro / win cards already wire themselves
}

/* ============================================================
   13. FATAL ERROR
   ============================================================ */
function showFatal(headline, detail) {
  document.body.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0612;color:#f3e9ff;font-family:ui-monospace,Menlo,Consolas,monospace;padding:30px;text-align:center;";
  wrap.innerHTML = `
    <div style="max-width:600px;border:1px solid #ff5566;padding:24px 28px;border-radius:10px;background:#140d20">
      <h1 style="color:#ff5566;font-size:18px;letter-spacing:2px;margin:0 0 12px;">FEHLER</h1>
      <p style="margin:0 0 12px;">${escapeHtml(headline)}</p>
      <pre style="white-space:pre-wrap;font-size:12px;color:#9a86b8;text-align:left;background:#0c0815;padding:10px;border-radius:6px">${escapeHtml(detail)}</pre>
    </div>`;
  document.body.appendChild(wrap);
}

/* ============================================================
   14. BOOT
   ============================================================ */
boot();

})();
