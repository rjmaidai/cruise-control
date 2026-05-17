/* Cruise Control — procedural 8-bit music
   Pure Web Audio API. No assets. One small loop per screen, plus a
   7-second intro jingle that plays over every intro card.

   API:
     Music.unlock()              — must be called from a user gesture
     Music.playForScreen(id)     — start the loop for 'start'|'prolog'|...|'win'
     Music.playIntroJingle()     — 7s sting played over intro cards
     Music.stop()                — silence everything immediately
     Music.duck(level)           — temporary master gain ramp (0..1)
*/
(function(){
'use strict';

const Music = {
  ctx: null,
  master: null,
  duckGain: null,
  active: null,          // opaque token: identifies the currently active loop
  abortFns: [],          // teardown callbacks for the active loop
  noiseBuf: null,

  _ensure(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    this.ctx = new AC();
    this.duckGain = this.ctx.createGain();
    this.duckGain.gain.value = 1;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.duckGain);
    this.duckGain.connect(this.ctx.destination);
  },

  unlock(){
    this._ensure();
    if(this.ctx && this.ctx.state === 'suspended'){
      this.ctx.resume().catch(()=>{});
    }
  },

  _ready(){
    return !!this.ctx && this.ctx.state === 'running';
  },

  // If a play request comes in before the user gesture has unlocked the
  // AudioContext, remember the latest request and replay it once the context
  // transitions to 'running'. Only the LAST request is honoured — older
  // requests are discarded, so e.g. queued "start" music is replaced by an
  // intro jingle if the player clicks a character right away.
  _pending: null,
  _stateListenerAttached: false,
  _attachStateListener(){
    if(this._stateListenerAttached || !this.ctx) return;
    this._stateListenerAttached = true;
    this.ctx.addEventListener('statechange', () => {
      if(this._ready() && this._pending){
        const p = this._pending;
        this._pending = null;
        p();
      }
    });
  },
  _whenReady(fn){
    this._ensure();
    if(!this.ctx) return;
    if(this._ready()){ fn(); return; }
    this._pending = fn;
    this._attachStateListener();
    if(this.ctx.state === 'suspended'){
      this.ctx.resume().catch(()=>{});
    }
  },

  stop(){
    this.active = null;
    this._pending = null;
    for(const fn of this.abortFns){ try{ fn(); }catch(_){} }
    this.abortFns = [];
  },

  duck(level){
    if(!this.duckGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.linearRampToValueAtTime(level, now + 0.15);
  },

  // ── primitive voices ───────────────────────────────────────────
  _note(freq, start, dur, type, vol, attack, release){
    if(!this.ctx) return;
    type = type || 'square';
    vol = vol == null ? 0.12 : vol;
    attack = attack == null ? 0.005 : attack;
    release = release == null ? Math.min(0.05, dur*0.4) : release;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + attack);
    const sustainEnd = Math.max(start + attack, start + dur - release);
    g.gain.setValueAtTime(vol, sustainEnd);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  },

  _kick(start, vol){
    if(!this.ctx) return;
    vol = vol == null ? 0.22 : vol;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(40, start + 0.14);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    osc.connect(g); g.connect(this.master);
    osc.start(start);
    osc.stop(start + 0.22);
  },

  _hat(start, dur, vol){
    if(!this.ctx) return;
    dur = dur || 0.04;
    vol = vol == null ? 0.05 : vol;
    if(!this.noiseBuf){
      const sr = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, sr * 0.5, sr);
      const data = this.noiseBuf.getChannelData(0);
      for(let i=0; i<data.length; i++) data[i] = Math.random()*2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(start);
    src.stop(start + dur);
  },

  // ── loop scheduler ─────────────────────────────────────────────
  _runLoop(scheduleBar, barSec){
    this._ensure();
    if(!this.ctx) return;
    this.stop();
    const id = {};
    this.active = id;
    let next = this.ctx.currentTime + 0.05;
    const tick = () => {
      if(this.active !== id) return;
      scheduleBar(next);
      next += barSec;
      const wait = Math.max(50, (next - this.ctx.currentTime - 0.25) * 1000);
      const t = setTimeout(tick, wait);
      this.abortFns.push(()=>clearTimeout(t));
    };
    tick();
  },

  // ── tracks ─────────────────────────────────────────────────────

  // Start / Titel — neon synthwave, slow, dreamy
  playStart(){
    const beat = 0.5;            // 120 BPM
    const bar = 16 * beat;
    // i  – III – VII – iv  in C minor (Cm, Eb, Bb, Fm)
    const chords = [
      [130.81, 155.56, 196.00],  // Cm
      [155.56, 196.00, 233.08],  // Eb
      [116.54, 146.83, 174.61],  // Bb
      [ 87.31, 103.83, 130.81],  // Fm
    ];
    // arp pattern (high octave triplets)
    const arp = [0,1,2,1, 2,1,0,1];
    this._runLoop(t => {
      for(let c=0; c<4; c++){
        const ch = chords[c];
        const tc = t + c * 4 * beat;
        // pad (low, two notes of triad held)
        this._note(ch[0],     tc, 4*beat, 'sawtooth', 0.04, 0.2, 0.4);
        this._note(ch[1],     tc, 4*beat, 'sawtooth', 0.035, 0.2, 0.4);
        // arpeggio (high)
        for(let n=0; n<8; n++){
          this._note(ch[arp[n]] * 4, tc + n*0.5*beat, 0.45*beat, 'triangle', 0.07);
        }
        // bass on 1 and 3
        this._note(ch[0]/2, tc,           1.8*beat, 'square',   0.08, 0.005, 0.2);
        this._note(ch[0]/2, tc + 2*beat,  1.8*beat, 'square',   0.08, 0.005, 0.2);
      }
    }, bar);
  },

  // Prolog — billiger nervoeser 8-bit Hafensound: chromatic anxious shuffle
  playProlog(){
    const beat = 0.18;           // fast, twitchy
    const bar = 16 * beat;
    // descend-then-rise small motif, square wave only
    const motif = [330, 311, 293, 277, 261, 277, 293, 311,
                   330, 349, 330, 311, 293, 277, 261, 246];
    this._runLoop(t => {
      // motif
      for(let i=0; i<16; i++){
        this._note(motif[i], t + i*beat, 0.14, 'square', 0.06);
      }
      // dull low pulse on 1 and 9
      this._note(110, t,             0.25, 'sawtooth', 0.09);
      this._note(110, t + 8*beat,    0.25, 'sawtooth', 0.09);
      // occasional ship-horn (low, atonal-ish)
      this._note(73.42, t + 4*beat,  0.6,  'sine',     0.08, 0.05, 0.3);
    }, bar);
  },

  // Kapitel 1 — billiger uebersteuerter 8-bit Eurodance, ~130 BPM
  playKapitel1(){
    const beat = 0.461;          // 130 BPM eighth notes
    const bar = 16 * beat;
    // F minor: F2 bass, F4-Ab4-C5-Eb5 arp
    const arpNotes = [349.23, 415.30, 523.25, 622.25];
    this._runLoop(t => {
      // 4-on-the-floor kick (one per quarter, 8 per bar)
      for(let i=0; i<8; i++) this._kick(t + i*2*beat, 0.24);
      // offbeat hi-hat
      for(let i=0; i<16; i++){
        if(i % 2 === 1) this._hat(t + i*beat, 0.04, 0.05);
      }
      // bass on quarters
      for(let i=0; i<8; i++){
        this._note(87.31, t + i*2*beat, 0.42, 'sawtooth', 0.11);
      }
      // arp lead (eighths)
      for(let i=0; i<16; i++){
        this._note(arpNotes[i % 4], t + i*beat, 0.18, 'square', 0.075);
      }
      // chord stab on beat 1 of bar
      this._note(349.23, t, 0.25, 'sawtooth', 0.06);
      this._note(415.30, t, 0.25, 'sawtooth', 0.06);
      this._note(523.25, t, 0.25, 'sawtooth', 0.06);
    }, bar);
  },

  // Kapitel 2 — billiger MIDI-Jazz, slow, walking bass + vibraphone
  playKapitel2(){
    const beat = 0.42;           // ~70 BPM
    const bar = 16 * beat;
    // Walking bass: ii-V-I-vi loop in C (Dm7 G7 Cmaj7 Am7)
    const bass = [
      146.83, 174.61, 196.00, 220.00,   // D F G A    (Dm7)
      196.00, 220.00, 246.94, 261.63,   // G A B C    (G7)
      261.63, 246.94, 220.00, 196.00,   // C B A G    (Cmaj7)
      220.00, 220.00, 196.00, 174.61,   // A A G F    (Am7)
    ];
    // Vibe-style melody (sine, sparse)
    const mel = [
      [0,  587.33, 1.0], [2,  698.46, 0.5], [3,  659.25, 1.5],
      [6,  880.00, 0.5], [7,  783.99, 0.5], [8,  659.25, 1.0],
      [10, 523.25, 1.0], [13, 587.33, 2.0],
    ];
    this._runLoop(t => {
      for(let i=0; i<16; i++){
        this._note(bass[i], t + i*beat, beat*0.85, 'triangle', 0.085, 0.01, 0.12);
      }
      for(const m of mel){
        const off = m[0], freq = m[1], dur = m[2];
        this._note(freq, t + off*beat, dur*beat, 'sine', 0.09, 0.02, 0.25);
      }
      // soft brush tick on every beat
      for(let i=0; i<16; i+=2) this._hat(t + i*beat, 0.05, 0.022);
    }, bar);
  },

  // Kapitel 3 — langsame kitschige 8-bit Loveballade
  playKapitel3(){
    const beat = 0.75;           // very slow
    const bar = 16 * beat;
    // I – vi – IV – V in F major (F, Dm, Bb, C)
    const chords = [
      [174.61, 220.00, 261.63],   // F
      [146.83, 174.61, 220.00],   // Dm
      [116.54, 146.83, 174.61],   // Bb
      [130.81, 164.81, 196.00],   // C
    ];
    // sweet melody on top of each chord
    const melodies = [
      [349.23, 440.00, 523.25, 440.00],
      [293.66, 349.23, 440.00, 349.23],
      [293.66, 349.23, 466.16, 349.23],
      [329.63, 392.00, 523.25, 392.00],
    ];
    this._runLoop(t => {
      for(let c=0; c<4; c++){
        const ch = chords[c];
        const mel = melodies[c];
        const tc = t + c*4*beat;
        // pad (held triad)
        ch.forEach(f => this._note(f, tc, 4*beat, 'triangle', 0.05, 0.35, 0.5));
        // bass root
        this._note(ch[0]/2, tc, 4*beat, 'sine', 0.07, 0.05, 0.3);
        // melody (one note per beat)
        for(let n=0; n<4; n++){
          this._note(mel[n], tc + n*beat, beat*0.95, 'sine', 0.08, 0.03, 0.15);
        }
      }
    }, bar);
  },

  // Win — short Triumph-Sting, then transition to Titel-Loop
  playWin(){
    this._ensure();
    if(!this.ctx) return;
    this.stop();
    const t0 = this.ctx.currentTime + 0.05;
    const b = 0.18;
    // ascending fanfare (5 notes, square + sub)
    const fan = [392.00, 523.25, 659.25, 783.99, 1046.50];
    fan.forEach((f, i) => {
      this._note(f,   t0 + i*b, b*0.95, 'square', 0.12);
      this._note(f/2, t0 + i*b, b*0.95, 'sawtooth', 0.06);
    });
    // hold chord
    [523.25, 659.25, 783.99, 1046.50].forEach(f => {
      this._note(f, t0 + 5*b, 1.4, 'square', 0.11, 0.005, 0.6);
    });
    // back to title loop after ~1.8s
    const handle = setTimeout(() => this.playStart(), 1900);
    this.abortFns.push(()=>clearTimeout(handle));
  },

  // 7-second intro jingle played over every intro card
  playIntroJingle(){
    this._whenReady(() => this._introJingleImpl());
  },
  _introJingleImpl(){
    if(!this.ctx) return;
    this.stop();
    const t = this.ctx.currentTime + 0.05;

    // 0.0–2.0s : sub-bass riser
    const riser = this.ctx.createOscillator();
    const rg = this.ctx.createGain();
    riser.type = 'sawtooth';
    riser.frequency.setValueAtTime(60, t);
    riser.frequency.exponentialRampToValueAtTime(720, t + 2.0);
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.16, t + 1.95);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 2.15);
    riser.connect(rg); rg.connect(this.master);
    riser.start(t); riser.stop(t + 2.2);
    this.abortFns.push(()=>{ try{riser.stop();}catch(_){} });

    // 2.0s : impact chord stab (C major add9)
    [261.63, 329.63, 392.00, 587.33].forEach(f => {
      this._note(f, t + 2.0, 1.4, 'square', 0.12, 0.003, 0.4);
    });
    this._kick(t + 2.0, 0.35);

    // 3.6–6.5s : 4 pulsing chord hits, fading out
    const pulses = [3.6, 4.3, 5.0, 5.7, 6.3];
    pulses.forEach((time, i) => {
      const vol = 0.11 * (1 - i / pulses.length);
      [261.63, 329.63, 392.00].forEach(f => {
        this._note(f, t + time, 0.45, 'triangle', vol, 0.02, 0.15);
      });
    });

    // 6.5–7.0s : tail (one soft note)
    this._note(523.25, t + 6.5, 0.5, 'sine', 0.06, 0.05, 0.3);
  },

  playForScreen(id){
    this._whenReady(() => {
      switch(id){
        case 'start':    this.playStart();    break;
        case 'prolog':   this.playProlog();   break;
        case 'kapitel1': this.playKapitel1(); break;
        case 'kapitel2': this.playKapitel2(); break;
        case 'kapitel3': this.playKapitel3(); break;
        case 'win':      this.playWin();      break;
        default:         this.stop();
      }
    });
  },
};

window.Music = Music;
})();
