/* ==========================================================================
   audio.js — Love.audio: a generative, piano-led romantic score (Web Audio)
   with an optional user-supplied song (Love.config.music.src).

   Love.audio API — every method is a safe no-op before unlock():
     unlock()                    call inside a user gesture (Stage 1 CTA). Starts music
                                 (soft 3 s fade-in). Idempotent; after fadeOut() it
                                 brings the music back.
     setIntensity(v, secs=2)     0..1 — how full/emotional the score is right now.
                                 ~0–.25 pad + sparse piano · .25–.5 + arpeggios + bass
                                 .5–.8 + melody, fuller voicing · .8–1 + strings + bells
     cue(name)                   one-shots: 'chime' | 'swell' | 'heart' | 'sparkle' | 'whoosh'
     duck(amount=0.5, secs=1)    lower the music BY `amount` (0 = no duck, 1 = silent)
                                 until duck(0) / unduck(). Auto-resets on every stage enter.
     unduck(secs=1)              same as duck(0, secs)
     fadeOut(secs=2)             fade everything to silence (sequencer then sleeps)
     fadeIn(secs=3)              bring the music back after fadeOut()
     setMuted(bool) / toggle() / muted / unlocked / intensity
   Events emitted on Love: 'audio:unlocked', 'audio:muted' (payload: bool)

   The score: Db major, 68 BPM, 32-bar form A–B–A'–B' (A' = descending-bass
   variation), looped with fresh arpeggio patterns / ornaments every pass.
   Everything is synthesised: felt piano, detuned-saw pad, sub bass, string
   ensemble + legato violin line, music-box bells, generated-IR reverb and a
   ping-pong delay, into a gentle compressor and a soft-clip safety stage.
   ========================================================================== */
(function () {
  'use strict';
  const Love = window.Love;
  if (!Love) return;

  const AC = window.AudioContext || window.webkitAudioContext || null;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext || null;
  const DEBUG = !!(Love.params && Love.params.has('audiodebug'));
  const warn = function () { if (DEBUG) console.warn.apply(console, ['[audio]'].concat([].slice.call(arguments))); };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const settle = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };

  /* ======================================================================
     THE SCORE  (MIDI numbers; Db4 = 61, C=0 … Db=1, Eb=3, F=5, Gb=6, Ab=8, Bb=10)
     ====================================================================== */
  const BPM = 68;
  const BEAT = 60 / BPM;        // 0.882 s
  const STEP = BEAT / 2;        // 8th note
  const LOOK = 0.15;            // scheduler lookahead (s)
  const TICK = 25;              // scheduler period (ms)

  /* bass = sub-bass note · lh = piano left hand [root, upper, (full) colour]
     pad = 4-voice voice-led voicing (also the piano right hand / strings)
     arp = 6 ascending chord tones for the flowing arpeggios                */
  const CH = {
    'Db':       { bass: 37, lh: [37, 44, 53], pad: [53, 56, 61, 63], arp: [49, 56, 61, 63, 65, 68] }, // Db add9
    'Db/F':     { bass: 41, lh: [41, 49, 56], pad: [53, 56, 61, 63], arp: [41, 49, 56, 61, 65, 68] },
    'Db/Flo':   { bass: 29, lh: [29, 41, 49], pad: [53, 56, 61, 65], arp: [41, 49, 56, 61, 65, 68] },
    'Db/Ab':    { bass: 32, lh: [32, 44, 53], pad: [53, 56, 61, 65], arp: [44, 53, 56, 61, 65, 68] },
    'Bbm11':    { bass: 34, lh: [46, 53, 61], pad: [53, 56, 61, 63], arp: [46, 53, 56, 61, 63, 68] },
    'Bbm9':     { bass: 34, lh: [46, 53, 61], pad: [53, 56, 61, 65], arp: [46, 53, 56, 61, 65, 72] },
    'Bbm7':     { bass: 34, lh: [46, 53, 61], pad: [53, 56, 61, 65], arp: [46, 53, 56, 61, 65, 68] },
    'Bbm7lo':   { bass: 34, lh: [34, 41, 49], pad: [53, 56, 61, 65], arp: [46, 53, 56, 61, 65, 68] },
    'Gbmaj9':   { bass: 42, lh: [42, 49, 58], pad: [53, 58, 61, 65], arp: [42, 49, 58, 61, 65, 68] },
    'Gbmaj7lo': { bass: 30, lh: [30, 37, 46], pad: [53, 58, 61, 65], arp: [42, 49, 58, 61, 65, 68] },
    'Gbm6':     { bass: 42, lh: [42, 49, 57], pad: [54, 57, 61, 63], arp: [42, 49, 57, 61, 63, 69] }, // borrowed iv
    'Absus':    { bass: 44, lh: [44, 51, 61], pad: [51, 56, 61, 66], arp: [44, 51, 56, 61, 63, 66] }, // Ab7sus4
    'Ab7':      { bass: 44, lh: [44, 51, 60], pad: [51, 56, 60, 66], arp: [44, 51, 56, 60, 63, 66] },
    'Absuslo':  { bass: 32, lh: [32, 44, 51], pad: [51, 56, 61, 66], arp: [44, 51, 56, 61, 63, 66] },
    'Ab7lo':    { bass: 32, lh: [32, 44, 51], pad: [51, 56, 60, 66], arp: [44, 51, 56, 60, 63, 66] },
    'Ab/C':     { bass: 36, lh: [36, 44, 51], pad: [51, 56, 60, 63], arp: [48, 51, 56, 60, 63, 68] },
    'Fm7':      { bass: 41, lh: [41, 48, 56], pad: [51, 56, 60, 65], arp: [41, 48, 56, 60, 63, 68] },
    'Ebm7':     { bass: 39, lh: [39, 46, 54], pad: [54, 58, 61, 63], arp: [39, 46, 54, 58, 61, 66] },
  };

  /* 8-bar sections; each bar = [[chord, beats], …] */
  const PROG = {
    A:  [[['Db', 4]], [['Bbm11', 4]], [['Gbmaj9', 4]], [['Absus', 2], ['Ab7', 2]],
         [['Db/F', 4]], [['Bbm11', 4]], [['Gbmaj9', 2], ['Gbm6', 2]], [['Absus', 2], ['Ab7', 2]]],
    B:  [[['Gbmaj9', 4]], [['Fm7', 4]], [['Bbm9', 4]], [['Ebm7', 2], ['Absus', 2]],
         [['Gbmaj9', 4]], [['Fm7', 2], ['Bbm7', 2]], [['Ebm7', 4]], [['Gbm6', 2], ['Absus', 2]]],
    // descending bass: Db – C – Bb – Ab – Gb – F – Eb – Ab
    A2: [[['Db', 4]], [['Ab/C', 4]], [['Bbm7lo', 4]], [['Db/Ab', 4]],
         [['Gbmaj7lo', 4]], [['Db/Flo', 4]], [['Ebm7', 4]], [['Absuslo', 2], ['Ab7lo', 2]]],
  };
  PROG.B2 = PROG.B;

  /* melodies: [bar, beat, midi, beats] */
  const MEL = {
    A: [[0, 0, 68, .5], [0, .5, 73, .5], [0, 1, 75, .5], [0, 1.5, 77, 2.5],
        [1, 0, 75, 1], [1, 1, 73, 1], [1, 2, 72, 2],
        [2, .5, 70, .5], [2, 1, 73, .5], [2, 1.5, 77, 1.5], [2, 3, 75, 1],
        [3, 0, 73, 2], [3, 2, 72, 2],
        [4, 0, 68, .5], [4, .5, 73, .5], [4, 1, 75, .5], [4, 1.5, 80, 2.5],
        [5, 0, 77, 1.5], [5, 1.5, 75, .5], [5, 2, 73, 1], [5, 3, 75, 1],
        [6, 0, 77, 2], [6, 2, 75, 2],
        [7, 0, 73, 1.5], [7, 1.5, 75, .5], [7, 2, 72, 2]],
    B: [[0, 0, 73, .5], [0, .5, 77, .5], [0, 1, 80, 2], [0, 3, 82, 1],
        [1, 0, 80, 1.5], [1, 1.5, 75, .5], [1, 2, 77, 2],
        [2, 0, 77, .5], [2, .5, 80, .5], [2, 1, 84, 2], [2, 3, 82, 1],
        [3, 0, 80, 1], [3, 1, 78, 1], [3, 2, 75, 2],
        [4, 0, 73, .5], [4, .5, 77, .5], [4, 1, 82, 2], [4, 3, 80, 1],
        [5, 0, 84, 1], [5, 1, 80, 1], [5, 2, 85, 1.5], [5, 3.5, 84, .5],
        [6, 0, 82, 2], [6, 2, 80, 1], [6, 3, 78, 1],
        [7, 0, 78, 1], [7, 1, 75, 1], [7, 2, 73, 2]],
    A2: [[0, 0, 80, 1.5], [0, 1.5, 77, .5], [0, 2, 75, 1], [0, 3, 77, 1],
         [1, 0, 75, 2], [1, 2, 72, 1], [1, 3, 75, 1],
         [2, 0, 73, 1], [2, 1, 77, 1], [2, 2, 80, 2],
         [3, 0, 77, 1.5], [3, 1.5, 75, .5], [3, 2, 73, 2],
         [4, 0, 70, .5], [4, .5, 73, .5], [4, 1, 77, 1.5], [4, 2.5, 75, .5], [4, 3, 80, 1],
         [5, 0, 80, 1.5], [5, 1.5, 82, .5], [5, 2, 80, 1], [5, 3, 77, 1],
         [6, 0, 78, 1.5], [6, 1.5, 77, .5], [6, 2, 75, 1], [6, 3, 73, 1],
         [7, 0, 75, 1], [7, 1, 73, 1], [7, 2, 72, 2]],
    B2: [[0, 0, 73, .5], [0, .5, 77, .5], [0, 1, 80, 2], [0, 3, 82, 1],
         [1, 0, 80, 1.5], [1, 1.5, 75, .5], [1, 2, 77, 2],
         [2, 0, 77, .5], [2, .5, 80, .5], [2, 1, 84, 2], [2, 3, 82, 1],
         [3, 0, 80, 1], [3, 1, 78, 1], [3, 2, 75, 2],
         [4, 0, 77, .5], [4, .5, 80, .5], [4, 1, 85, 2], [4, 3, 84, 1],
         [5, 0, 84, 1], [5, 1, 80, 1], [5, 2, 85, 2],
         [6, 0, 82, 1.5], [6, 1.5, 80, .5], [6, 2, 78, 1], [6, 3, 77, 1],
         [7, 0, 75, 2], [7, 2, 73, 2]],
  };
  const FORM = ['A', 'B', 'A2', 'B2'];

  const ARPS = [
    [0, 1, 2, 3, 4, 3, 2, 1],
    [0, 2, 1, 3, 2, 4, 3, 5],
    [0, 1, 2, 4, 3, 5, 4, 2],
    [0, 2, 3, 4, 5, 4, 3, 2],
  ];
  const SPARSE_RH = [[4], [2, 6], [3, 6], [4, 7], [2, 5], [5], [3], [1, 4]];
  const BELL_RH = [[1, 3, 6], [3, 5, 7], [1, 4, 5, 7], [2, 3, 6], [1, 5], [3, 7], [1, 3, 5, 7]];
  const DB_SCALE = [1, 3, 5, 6, 8, 10, 0];

  const pcsOf = (ch) => {
    const s = new Set();
    ch.lh.concat(ch.pad, ch.arp).forEach((m) => s.add(m % 12));
    return s;
  };
  /* decoration pitch classes: chord tones that never sit a semitone above
     another chord tone (b9) nor a semitone from the melody in that bar */
  function allowedPcs(ch, mel) {
    const base = pcsOf(ch), out = [];
    base.forEach((p) => {
      if (base.has((p + 11) % 12)) return;
      if (mel && (mel.has((p + 11) % 12) || mel.has((p + 1) % 12))) return;
      out.push(p);
    });
    return out;
  }
  Object.keys(CH).forEach((k) => { CH[k].name = k; CH[k].decor = allowedPcs(CH[k], null); });

  /* compile sections → bars with chord spans, melody per step, decor pcs */
  const SEC = {};
  FORM.forEach((key) => {
    const prog = PROG[key], mel = MEL[key];
    const abs = mel.map((n) => ({ a: n[0] * 4 + n[1], e: n[0] * 4 + n[1] + n[3], m: n[2] }));
    SEC[key] = prog.map((bar, b) => {
      const melPcs = new Set();
      abs.forEach((n) => { if (n.a < b * 4 + 4 && n.e > b * 4) melPcs.add(n.m % 12); });
      let start = 0;
      const chords = bar.map(([name, beats]) => {
        const c = { ch: CH[name], start, beats, decor: allowedPcs(CH[name], melPcs) };
        start += beats;
        return c;
      });
      const notes = mel.filter((n) => n[0] === b).map((n) => ({
        s: Math.round(n[1] * 2), m: n[2], d: n[3],
        v: clamp(0.6 + (n[3] >= 2 ? 0.06 : 0) - (n[3] <= 0.5 ? 0.07 : 0) + (n[2] - 75) * 0.004, 0.4, 0.8),
      }));
      return { chords, notes };
    });
  });

  const stepDur = (b, s) => STEP * (b === 7 ? (s >= 6 ? 1.1 : s >= 4 ? 1.05 : 1) : 1); // phrase-end ritardando

  /* ======================================================================
     ENGINE  — one per AudioContext (also used for the offline preview)
     ====================================================================== */
  function createEngine(ctx, opts) {
    opts = opts || {};
    const SR = ctx.sampleRate;
    const hasPan = typeof ctx.createStereoPanner === 'function';
    const G = (v) => { const g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; };
    const F = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? 0.707 : q; return b; };
    const P = (p) => { if (!hasPan) return G(1); const s = ctx.createStereoPanner(); s.pan.value = p; return s; };
    const O = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    const kill = function () { for (let i = 0; i < arguments.length; i++) { try { arguments[i] && arguments[i].disconnect(); } catch (e) { /* already gone */ } } };

    /* ---- mix constants (calibrated by measurement) */
    const MIX = {
      trim: 1.25, piano: 0.21, pad: 0.019, bass: 0.022, str: 0.025, vln: 0.034,
      bell: 0.1, cue: 1.0, revOut: 0.85, dlyOut: 0.5,
    };

    /* ---- buffers */
    const NOISE = (() => {
      const n = Math.floor(SR * 2), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const THUMP = (() => {
      const n = Math.floor(SR * 0.08), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
      const c = 1 - Math.exp(-2 * Math.PI * 650 / SR);
      let lp = 0, pk = 1e-6;
      for (let i = 0; i < n; i++) {
        lp += c * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-i / (SR * 0.012)) * Math.min(1, i / (SR * 0.0015));
        pk = Math.max(pk, Math.abs(d[i]));
      }
      for (let i = 0; i < n; i++) d[i] /= pk;
      return b;
    })();
    function makeIR(secs) {
      const len = Math.floor(SR * secs), buf = ctx.createBuffer(2, len, SR);
      const rt60 = secs * 0.88;
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0, c = 0;
        for (let i = 0; i < len; i++) {
          if ((i & 63) === 0) { const t = i / SR; c = 1 - Math.exp(-2 * Math.PI * (7500 * Math.exp(-t * 1.25) + 700) / SR); }
          lp += c * ((Math.random() * 2 - 1) - lp);
          const t = i / SR;
          d[i] = lp * Math.exp(-6.9 * t / rt60) * Math.min(1, t / 0.006);
        }
        // a few soft early reflections
        [0.011, 0.019, 0.027, 0.041].forEach((tt, k) => {
          const j = Math.floor((tt + ch * 0.0023) * SR);
          if (j < len) d[j] += (k % 2 ? -0.45 : 0.55) * (1 - k * 0.15);
        });
      }
      return buf;
    }
    const wave = (amps) => ctx.createPeriodicWave(new Float32Array(amps.length), new Float32Array(amps));
    const FELT_BODY = wave([0, 1, 0.34, 0.12, 0.045, 0.015]);
    const FELT_BRIGHT = wave([0, 0.55, 0.62, 0.5, 0.38, 0.28, 0.2, 0.14, 0.1, 0.07, 0.05, 0.035, 0.025, 0.018, 0.012]);
    const SOFTCLIP = (() => {
      const n = 4097, c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const s = ((i / (n - 1)) * 2 - 1) * 2, a = Math.abs(s);
        const y = a < 0.6 ? a : 0.6 + 0.35 * Math.tanh((a - 0.6) / 0.35);
        c[i] = s < 0 ? -y : y;
      }
      return c;
    })();

    /* ---- output chain:  master(mute) → trim → compressor → soft-clip → out */
    const out = G(1);
    const master = G(1);
    const trim = G(MIX.trim);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 16; comp.ratio.value = 2.2;
    comp.attack.value = 0.015; comp.release.value = 0.3;
    const pre = G(0.5);
    const shaper = ctx.createWaveShaper();
    shaper.curve = SOFTCLIP; shaper.oversample = 'none'; // linear below 0.6 — only a safety net
    master.connect(trim); trim.connect(comp); comp.connect(pre); pre.connect(shaper); shaper.connect(out);
    out.connect(ctx.destination);

    /* ---- reverb (generated IR) + ping-pong delay */
    const revIn = G(1), revHP = F('highpass', 210, 0.5), preDelay = ctx.createDelay(0.2);
    preDelay.delayTime.value = 0.024;
    const conv = ctx.createConvolver();
    conv.buffer = makeIR(2.8);
    const revOut = G(MIX.revOut);
    revIn.connect(revHP); revHP.connect(preDelay); preDelay.connect(conv); conv.connect(revOut); revOut.connect(master);

    const dlyIn = G(1);
    dlyIn.channelCount = 1; dlyIn.channelCountMode = 'explicit'; dlyIn.channelInterpretation = 'speakers';
    const dlyLP = F('lowpass', 2600, 0.5), dL = ctx.createDelay(2), dR = ctx.createDelay(2);
    dL.delayTime.value = BEAT / 2; dR.delayTime.value = BEAT * 0.75;
    const fbLR = G(0.3), fbRL = G(0.3), fbLP = F('lowpass', 2000, 0.5);
    const merger = ctx.createChannelMerger(2), dlyOut = G(MIX.dlyOut), dlyToRev = G(0.35);
    dlyIn.connect(dlyLP); dlyLP.connect(dL);
    dL.connect(fbLR); fbLR.connect(fbLP); fbLP.connect(dR); dR.connect(fbRL); fbRL.connect(dL);
    dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
    merger.connect(dlyOut); dlyOut.connect(master); dlyOut.connect(dlyToRev); dlyToRev.connect(revIn);

    /* ---- music buses: separate fade + duck on dry / reverb-send / delay-send */
    const musicDry = G(1), musicRev = G(1), musicDly = G(1);
    const fades = [G(0), G(0), G(0)], ducks = [G(1), G(1), G(1)];
    [[musicDry, master], [musicRev, revIn], [musicDly, dlyIn]].forEach(([src, dst], i) => {
      src.connect(fades[i]); fades[i].connect(ducks[i]); ducks[i].connect(dst);
    });

    /* ---- cue buses (not ducked; faded only by fadeOut) */
    const cueBus = G(MIX.cue), cueRev = G(0.55), cueDly = G(0.35), cueDyn = G(0.85);
    cueBus.connect(cueDyn); cueDyn.connect(master); cueRev.connect(revIn); cueDly.connect(dlyIn);
    let cueFaded = false;

    /* ---- layers */
    function layer(o) {
      const L = G(1), C = G(1), R = G(1), pL = P(-0.2), pR = P(0.2), sum = G(1);
      L.connect(pL); pL.connect(sum); R.connect(pR); pR.connect(sum); C.connect(sum);
      let last = sum, lp = null;
      if (o.hp) { const hp = F('highpass', o.hp, 0.6); last.connect(hp); last = hp; }
      if (o.lpFn) { lp = F('lowpass', o.lpFn(0), o.q || 0.5); last.connect(lp); last = lp; }
      const g = G(0);
      last.connect(g);
      g.connect(musicDry);
      if (o.rev) { const s = G(o.rev); g.connect(s); s.connect(musicRev); }
      if (o.dly) { const s = G(o.dly); g.connect(s); s.connect(musicDly); }
      return { L, C, R, pL, pR, lp, g, mix: o.mix || 1, fn: o.fn, wFn: o.wFn, lpFn: o.lpFn, lfo: !!o.lfo, level: -1, w: -1, f: o.lpFn ? o.lpFn(0) : 0, on: false, lastOn: -99 };
    }
    const lpPiano = (I) => 3400 * Math.pow(2.9, ss(0.15, 1, I));
    const wPiano = (I) => 0.12 + 0.5 * ss(0.2, 1, I);
    const LY = {
      pad:     layer({ lpFn: (I) => 560 * Math.pow(4, ss(0, 1, I)), q: 0.7, rev: 0.6, lfo: true, wFn: () => 0.75,
                       fn: (I) => 0.72 + 0.28 * ss(0, 0.5, I) - 0.18 * ss(0.85, 1, I) }),
      piano:   layer({ lpFn: lpPiano, rev: 0.36, dly: 0.05, wFn: wPiano, fn: (I) => 0.62 + 0.38 * ss(0.05, 0.6, I) }),
      sparse:  layer({ lpFn: lpPiano, rev: 0.55, dly: 0.2, wFn: wPiano, mix: 1.5, fn: (I) => 1 - 0.85 * ss(0.42, 0.72, I) }),
      arp:     layer({ lpFn: lpPiano, rev: 0.36, dly: 0.07, wFn: wPiano, fn: (I) => ss(0.22, 0.52, I) * (1 - 0.2 * ss(0.85, 1, I)) }),
      full:    layer({ lpFn: lpPiano, rev: 0.36, wFn: wPiano, fn: (I) => ss(0.5, 0.82, I) }),
      melody:  layer({ lpFn: (I) => 4000 * Math.pow(2.5, ss(0.4, 1, I)), rev: 0.34, dly: 0.13, wFn: () => 0.1, mix: 1.18, fn: (I) => ss(0.45, 0.72, I) }),
      bass:    layer({ lpFn: () => 240, q: 0.6, rev: 0.04, wFn: () => 0, fn: (I) => ss(0.25, 0.55, I) }),
      strings: layer({ hp: 140, lpFn: (I) => 1300 + 3200 * ss(0.7, 1, I), q: 0.6, rev: 0.55, wFn: (I) => 0.45 + 0.4 * ss(0.7, 1, I), fn: (I) => ss(0.72, 0.95, I) }),
      violin:  layer({ hp: 220, lpFn: (I) => 2000 + 2600 * ss(0.8, 1, I), q: 0.6, rev: 0.5, dly: 0.06, wFn: () => 0, fn: (I) => ss(0.8, 1, I) }),
      bells:   layer({ hp: 500, rev: 0.65, dly: 0.3, wFn: (I) => 0.45 + 0.4 * ss(0.78, 1, I), fn: (I) => ss(0.78, 1, I) }),
    };
    const LKEYS = Object.keys(LY);
    const sideOf = (ly, m) => (m < 55 ? ly.L : m > 70 ? ly.R : ly.C);

    /* ---- intensity (linear ramps in context time) */
    let iFrom = 0, iTo = 0, iT0 = 0, iT1 = 0;
    function intensityAt(t) {
      if (t >= iT1) return iTo;
      if (t <= iT0) return iFrom;
      return iFrom + (iTo - iFrom) * ((t - iT0) / (iT1 - iT0));
    }
    function setIntensity(v, secs, now) {
      const cur = intensityAt(now);
      iFrom = cur; iTo = clamp(v, 0, 1); iT0 = now; iT1 = now + Math.max(0.05, secs || 0);
    }

    let dynLevel = -1;
    const dyn = (I) => 0.7 + 0.3 * ss(0.2, 1, I); // overall crescendo on top of the added layers
    function updateParams(now) {
      const I = intensityAt(now + 0.05), Ion = Math.max(I, iTo);
      const d = dyn(I);
      if (Math.abs(d - dynLevel) > 0.002) { [musicDry, musicRev, musicDly, cueDyn].forEach((g) => g.gain.setTargetAtTime(d, now, 0.15)); dynLevel = d; }
      for (let k = 0; k < LKEYS.length; k++) {
        const ly = LY[LKEYS[k]];
        const v = ly.fn(I) * ly.mix;
        if (Math.abs(v - ly.level) > 0.002) { ly.g.gain.setTargetAtTime(v, now, 0.12); ly.level = v; }
        ly.on = ly.fn(Ion) > 0.004 || ly.fn(I) > 0.004;
        if (ly.on) ly.lastOn = now;
        const w = ly.wFn(I);
        if (hasPan && Math.abs(w - ly.w) > 0.01) {
          ly.pL.pan.setTargetAtTime(-w, now, 0.3); ly.pR.pan.setTargetAtTime(w, now, 0.3); ly.w = w;
        }
        if (ly.lp) {
          let f = ly.lpFn(I);
          if (ly.lfo) f *= 1 + 0.14 * Math.sin(now * 0.52);
          if (Math.abs(f - ly.f) / ly.f > 0.01) { ly.lp.frequency.setTargetAtTime(f, now, 0.25); ly.f = f; }
        }
      }
    }

    /* ---- voice accounting (time based, so it also works offline) */
    let voiceEnds = [];
    function voiceOk(t, prio) {
      if (voiceEnds.length > 20) voiceEnds = voiceEnds.filter((e) => e > t);
      const cap = prio >= 2 ? 64 : prio === 1 ? 52 : 42;
      return voiceEnds.length < cap;
    }

    /* ---- felt piano: a mellow "body" partial set + an overtone-rich "hammer"
       set that decays much faster (spectral decay without per-voice filters,
       which are expensive when their cutoff is automated). The two are
       detuned by a few cents → the warm beating of a piano's string unison. */
    function piano(ly, m, t, tOff, vel, prio) {
      if (!voiceOk(t, prio)) return;
      vel = clamp(vel, 0.05, 1);
      const f = mtof(m);
      const ob = ctx.createOscillator(), oh = ctx.createOscillator();
      ob.setPeriodicWave(FELT_BODY); oh.setPeriodicWave(FELT_BRIGHT);
      ob.frequency.value = oh.frequency.value = f;
      ob.detune.value = rnd(-1.5, 1.5);
      oh.detune.value = (Math.random() < 0.5 ? -1 : 1) * rnd(2.5, 5);
      const gb = G(0), gh = G(0);
      const comp = m < 44 ? 0.62 : m < 50 ? 0.82 : m > 84 ? 0.8 : 1;
      const amp = MIX.piano * Math.pow(vel, 1.5) * comp;
      const hAmp = amp * (0.3 + 0.8 * vel) * (m > 80 ? 0.6 : 1);
      const tauLong = clamp(4.4 - (m - 36) * 0.065, 0.9, 4.4);
      const tauH = clamp(0.42 - (m - 48) * 0.006, 0.12, 0.45) * (0.7 + 0.5 * vel);
      const off = Math.max(tOff, t + 0.03), rel = m > 80 ? 0.32 : 0.24;
      // body: soft attack, prompt sound, long after-sound, felt damper
      gb.gain.setValueAtTime(0, t);
      gb.gain.linearRampToValueAtTime(amp, t + 0.008);
      gb.gain.setTargetAtTime(amp * 0.5, t + 0.008, 0.16);
      if (off > t + 0.3) gb.gain.setTargetAtTime(0, t + 0.28, tauLong);
      gb.gain.setTargetAtTime(0, off, rel);
      // hammer / overtones: quick bloom then fast decay
      gh.gain.setValueAtTime(0, t);
      gh.gain.linearRampToValueAtTime(hAmp, t + 0.005);
      gh.gain.setTargetAtTime(hAmp * 0.12, t + 0.005, tauH);
      if (off > t + 0.6) gh.gain.setTargetAtTime(0, t + 0.6, tauLong * 0.5);
      gh.gain.setTargetAtTime(0, off, rel * 0.7);
      const end = off + rel * 6.5;
      const dest = sideOf(ly, m);
      ob.connect(gb); oh.connect(gh); gb.connect(dest); gh.connect(dest);
      ob.start(t); oh.start(t); ob.stop(end); oh.stop(end);
      ob.onended = () => kill(ob, oh, gb, gh);
      voiceEnds.push(end);
      if (prio >= 2 && vel > 0.38) { // felt hammer / mechanism noise
        const n = ctx.createBufferSource(), ng = G(amp * 0.22);
        n.buffer = THUMP; n.playbackRate.value = clamp(0.6 + (m - 36) / 60, 0.6, 1.6);
        n.connect(ng); ng.connect(ly.C); n.start(t);
        n.onended = () => kill(n, ng);
      }
    }

    /* ---- music-box bell */
    function bell(dests, m, t, vel, decay, pan) {
      const f = mtof(m);
      const bus = pan == null ? G(1) : P(pan);
      dests.forEach((d) => bus.connect(d));
      const parts = [[1, 1, decay], [2, 0.2, decay * 0.3], [5.43, 0.08, 0.07]];
      parts.forEach(([r, a, d], i) => {
        const fr = f * r;
        if (fr > 15500) return;
        const o = O('sine', fr), g = G(0), amp = MIX.bell * vel * a;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.002);
        g.gain.setTargetAtTime(0, t + 0.002, d / 3.2);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + d * 1.5 + 0.05);
        o.onended = i === 0 ? () => kill(o, g, bus) : () => kill(o, g);
      });
    }

    /* ---- held (voice-led) voices: pad, strings, bass */
    function held(startFn) {
      let slots = [];
      return {
        set(notes, t) {
          const next = [], n = Math.max(notes.length, slots.length);
          for (let i = 0; i < n; i++) {
            const old = slots[i], m = notes[i];
            if (old && m != null && old.m === m) { next[i] = old; if (old.renew) old.renew(t); continue; }
            if (old) old.release(t);
            if (m != null) next[i] = startFn(m, t, i);
          }
          slots = next;
        },
        releaseAll(t) { slots.forEach((v) => v && v.release(t)); slots = []; },
        get empty() { return !slots.some(Boolean); },
      };
    }
    function twoOscVoice(type, m, t, detune, lvl, attack, outA, outB, vibrato) {
      const f = mtof(m), a = O(type, f), b = O(type, f), ga = G(0), gb = G(0);
      a.detune.value = -detune + rnd(-2, 2); b.detune.value = detune + rnd(-2, 2);
      if (vibrato) { vibG.connect(a.detune); vibG.connect(b.detune); }
      [ga, gb].forEach((g) => { g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(lvl, t, attack); });
      a.connect(ga); b.connect(gb); ga.connect(outA); gb.connect(outB);
      a.start(t); b.start(t);
      a.onended = () => {
        if (vibrato) { try { vibG.disconnect(a.detune); vibG.disconnect(b.detune); } catch (e) { /* old browsers */ } }
        kill(a, b, ga, gb);
      };
      let gone = false;
      return {
        m, ga, gb, a, b,
        release(t2, tau) {
          if (gone) return; gone = true;
          t2 = Math.max(t2, t + 0.02); tau = tau || 0.7;
          ga.gain.setTargetAtTime(0, t2, tau); gb.gain.setTargetAtTime(0, t2, tau);
          a.stop(t2 + tau * 7); b.stop(t2 + tau * 7);
        },
      };
    }
    const vib = O('sine', 5.1), vibG = G(5.5);
    vib.connect(vibG); vib.start(ctx.currentTime);

    const padV = held((m, t) => {
      const v = twoOscVoice('sawtooth', m, t, 7, MIX.pad * (m < 56 ? 1 : 0.85), 0.55, LY.pad.L, LY.pad.R, false);
      const r = v.release; v.release = (t2) => r(t2, 0.75);
      return v;
    });
    const strV = held((m, t, i) => {
      const lvl = MIX.str * (i === 0 ? 1.25 : 1);
      const v = twoOscVoice('sawtooth', m, t, 6, lvl, 0.6, LY.strings.L, LY.strings.R, true);
      v.renew = (t2) => { // bow change: a gentle re-swell
        [v.ga, v.gb].forEach((g) => { g.gain.setTargetAtTime(lvl * 0.78, t2, 0.12); g.gain.setTargetAtTime(lvl, t2 + 0.3, 0.6); });
      };
      return v;
    });
    const bassV = held((m, t) => {
      const f = mtof(m), a = O('sine', f), b = O('sine', f * 2), g = G(0), gb = G(0.22);
      g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(MIX.bass, t, 0.07);
      a.connect(g); b.connect(gb); gb.connect(g); g.connect(LY.bass.C);
      a.start(t); b.start(t);
      a.onended = () => kill(a, b, g, gb);
      let gone = false;
      return { m, release(t2) { if (gone) return; gone = true; t2 = Math.max(t2, t + 0.02); g.gain.setTargetAtTime(0, t2, 0.18); a.stop(t2 + 1.4); b.stop(t2 + 1.4); } };
    });
    const strNotes = (c) => { let cello = c.bass; while (cello < 41) cello += 12; return [cello].concat(c.pad); };

    /* legato violin line doubling the melody at the climax */
    let vln = null;
    function violinNote(m, t, dur) {
      const f = mtof(m), lvl = MIX.vln;
      if (!vln) vln = twoOscVoice('sawtooth', m, t, 5, 0, 0.1, LY.violin.L, LY.violin.R, true);
      else [vln.a, vln.b].forEach((o) => o.frequency.setTargetAtTime(f, t, 0.035)); // legato portamento
      [vln.ga, vln.gb].forEach((g) => {
        g.gain.setTargetAtTime(lvl, t, 0.09);
        g.gain.setTargetAtTime(lvl * 0.55, t + dur * 0.7, 0.35);
      });
    }

    /* ---- sequencer */
    const seq = { on: false, f: 0, b: 0, s: 0, next: 0, pass: 0, arp: ARPS[0], plan: [], cur: null, hist: [], lastSparse: 77, lastBell: 89 };
    function start(t) {
      stop(t);
      seq.on = true; seq.f = 0; seq.b = 0; seq.s = 0; seq.next = t; seq.pass = 0; seq.arp = ARPS[0]; seq.hist = [];
    }
    function stop(t) {
      seq.on = false;
      padV.releaseAll(t); strV.releaseAll(t); bassV.releaseAll(t);
      if (vln) { vln.release(t, 0.4); vln = null; }
    }
    function advance() {
      seq.next += stepDur(seq.b, seq.s);
      if (++seq.s >= 8) {
        seq.s = 0;
        if (++seq.b >= 8) {
          seq.b = 0;
          if (++seq.f >= FORM.length) { seq.f = 0; seq.pass++; }
          seq.arp = pick(ARPS);
        }
      }
    }
    const spanSecs = (b, s0, s1) => { let t = 0; for (let s = s0; s < s1; s++) t += s < 8 ? stepDur(b, s) : STEP; return t; };
    const chordIn = (bar, beat) => { for (let i = 0; i < bar.chords.length; i++) { const c = bar.chords[i]; if (beat < c.start + c.beats) return c; } return bar.chords[bar.chords.length - 1]; };
    const jit = () => rnd(0, 0.012);

    function nearest(list, prev, lo, hi) {
      const cands = list.filter((m) => m >= lo && m <= hi && m !== prev);
      if (!cands.length) return null;
      const w = cands.map((m) => { const d = Math.abs(m - prev); return d <= 2 ? 3 : d <= 5 ? 4 : d <= 8 ? 1.5 : 0.4; });
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; }
      return cands[cands.length - 1];
    }
    const notesFor = (pcs, lo, hi) => { const r = []; for (let m = lo; m <= hi; m++) if (pcs.indexOf(m % 12) >= 0) r.push(m); return r; };

    /* chord span following `c` (next chord in this bar, or the next bar's first) */
    function chordAfter(bar, c) {
      const i = bar.chords.indexOf(c);
      if (i < bar.chords.length - 1) return bar.chords[i + 1];
      const nb = seq.b < 7 ? SEC[FORM[seq.f]][seq.b + 1] : SEC[FORM[(seq.f + 1) % FORM.length]][0];
      return nb.chords[0];
    }
    function planBar(bar, b) {
      seq.plan = [];
      if (LY.sparse.on && !(b === 7 && Math.random() < 0.5)) {
        pick(SPARSE_RH).forEach((s) => {
          const c = chordIn(bar, s / 2), m = nearest(notesFor(c.decor, 68, 84), seq.lastSparse, 68, 84);
          if (m == null) return;
          seq.lastSparse = m;
          // damped at its chord's end so it never rings into a clashing harmony
          seq.plan.push({ s, kind: 'sparse', m, d: Math.min(rnd(1.5, 3), c.start + c.beats - s / 2 + 0.1), v: rnd(0.3, 0.42) });
        });
      }
      if (LY.bells.on) {
        pick(BELL_RH).forEach((s) => {
          const c = chordIn(bar, s / 2);
          let pcs = c.decor;
          if ((c.start + c.beats) * 2 - s <= 3) { // the bell tail crosses the change: must suit both chords
            const nx = chordAfter(bar, c).decor;
            pcs = pcs.filter((p) => nx.indexOf(p) >= 0);
          }
          const m = nearest(notesFor(pcs, 84, 96), seq.lastBell, 84, 96);
          if (m == null) return;
          seq.lastBell = m;
          seq.plan.push({ s, kind: 'bell', m, v: rnd(0.3, 0.46) });
        });
      }
    }

    function onChord(c, t, dur, now) {
      const ch = c.ch;
      seq.cur = ch;
      seq.hist.push([t, ch]); if (seq.hist.length > 16) seq.hist.shift();
      padV.set(ch.pad, t);
      if (LY.bass.on || !bassV.empty) bassV.set([ch.bass], t);
      if (LY.strings.on || !strV.empty) strV.set(strNotes(ch), t);
      const tEnd = t + dur + 0.12;
      const I = intensityAt(t);
      const lv = 0.5 + rnd(-0.04, 0.04);
      piano(LY.piano, ch.lh[0], t + jit(), tEnd, lv, 2);
      if (c.beats >= 4 || c.start === 0) piano(LY.piano, ch.lh[1], t + 0.05 + jit(), tEnd, lv * 0.78, 2);
      if (LY.full.on) {
        piano(LY.full, ch.lh[2], t + 0.1 + jit(), tEnd, 0.36, 1);
        piano(LY.full, ch.pad[0], t + 0.075 + jit(), tEnd, 0.3, 1);
      }
      const rv = 0.31 * (1 - 0.35 * Math.max(0, LY.arp.level)) * (0.9 + 0.2 * I);
      for (let i = 1; i < ch.pad.length; i++) piano(LY.piano, ch.pad[i], t + 0.08 + i * 0.028 + jit(), tEnd, rv + rnd(-0.03, 0.03), 2);
      void now;
    }

    function stepAt(t, now) {
      const key = FORM[seq.f], bars = SEC[key], b = seq.b, s = seq.s, bar = bars[b];
      if (s === 0) planBar(bar, b);
      const beat = s / 2, c = chordIn(bar, beat);
      const cs = c.start * 2, ce = (c.start + c.beats) * 2;
      if (s === cs) onChord(c, t, spanSecs(b, s, ce), now);
      const I = intensityAt(t);

      // flowing arpeggio
      if (LY.arp.on) {
        const k = s - cs, idx = seq.arp[k % 8], m = c.ch.arp[idx];
        const remain = spanSecs(b, s, ce);
        const v = 0.33 + (k === 0 ? 0.08 : 0) + 0.05 * (idx / 5) + rnd(-0.03, 0.03);
        piano(LY.arp, m, t + jit(), t + Math.min(remain + 0.15, BEAT * 1.8), v * (0.9 + 0.2 * I), 0);
      }
      // melody (+ grace notes on later passes, violin doubling at the top)
      if (LY.melody.on || LY.violin.on) {
        bar.notes.forEach((n) => {
          if (n.s !== s) return;
          const dur = n.d * BEAT * (b === 7 ? 1.06 : 1);
          if (LY.melody.on) {
            const tt = t + rnd(0.002, 0.014);
            if (seq.pass > 0 && n.d >= 1.5 && Math.random() < 0.22) {
              let g = n.m + 1; while (DB_SCALE.indexOf(g % 12) < 0) g++;
              piano(LY.melody, g, tt - 0.075, tt + 0.02, n.v * 0.6, 1);
            }
            piano(LY.melody, n.m, tt, tt + dur + 0.05, n.v * (0.9 + 0.18 * I) + rnd(-0.03, 0.03), 2);
          }
          if (LY.violin.on) violinNote(n.m, t, dur);
        });
      }
      // sparse high notes / music-box bells
      seq.plan.forEach((p) => {
        if (p.s !== s) return;
        if (p.kind === 'sparse') piano(LY.sparse, p.m, t + jit(), t + p.d * BEAT, p.v, 0);
        else bell([p.m % 2 ? LY.bells.L : LY.bells.R], p.m, t + jit(), p.v, 1.7, null);
      });
    }

    function ensureHeld(now) {
      const c = seq.cur;
      if (!c) return;
      if (LY.bass.on) { if (bassV.empty) bassV.set([c.bass], now + 0.03); }
      else if (!bassV.empty && now - LY.bass.lastOn > 2) bassV.releaseAll(now);
      if (LY.strings.on) { if (strV.empty) strV.set(strNotes(c), now + 0.03); }
      else if (!strV.empty && now - LY.strings.lastOn > 2.5) strV.releaseAll(now);
      if (vln && !LY.violin.on && now - LY.violin.lastOn > 2.5) { vln.release(now, 0.4); vln = null; }
    }

    function tick(now) {
      updateParams(now);
      if (!seq.on) return;
      if (seq.next < now - 0.25) seq.next = now + 0.05; // fell far behind (jank): skip, don't burst
      let guard = 0;
      while (seq.next < now + LOOK && guard++ < 48) { stepAt(seq.next, now); advance(); }
      ensureHeld(now);
    }

    /* chord sounding at time t (history for the past, simulate for the future) */
    function chordAt(t) {
      if (!seq.on || !seq.hist.length) return CH.Db;
      for (let i = seq.hist.length - 1; i >= 0; i--) if (seq.hist[i][0] <= t) {
        if (t <= seq.next) return seq.hist[i][1];
        break;
      }
      let f = seq.f, b = seq.b, s = seq.s, time = seq.next, guard = 0;
      while (guard++ < 400) {
        const d = stepDur(b, s);
        if (time + d > t) break;
        time += d;
        if (++s >= 8) { s = 0; if (++b >= 8) { b = 0; f = (f + 1) % FORM.length; } }
      }
      return chordIn(SEC[FORM[f]][b], s / 2).ch;
    }

    /* ---- one-shot cues */
    const cueDests = (rev, dly) => [cueBus].concat(rev ? [cueRev] : [], dly ? [cueDly] : []);
    function noise(t, dur) {
      const n = ctx.createBufferSource();
      n.buffer = NOISE; n.loop = true;
      n.start(t, Math.random() * 1.5); n.stop(t + dur);
      return n;
    }
    const CUES = {
      chime(t) {
        const ch = chordAt(t), list = notesFor(ch.decor, 77, 94).slice(0, 4);
        list.forEach((m, i) => bell(cueDests(true, true), m, t + [0, 0.11, 0.22, 0.36][i], [0.62, 0.55, 0.52, 0.62][i], 2.4, -0.25 + i * 0.17));
      },
      sparkle(t) {
        const ch = chordAt(t), list = notesFor(ch.decor, 82, 101).slice(0, 9);
        list.forEach((m, i) => bell(cueDests(true, true), m, t + i * 0.045, 0.4 - i * 0.022, 0.95, -0.6 + 1.2 * i / Math.max(1, list.length - 1)));
      },
      swell(t) {
        const T = 2.5, ch = chordAt(t + T);
        // airy noise riser
        const n = noise(t, T + 0.9), bp = F('bandpass', 350, 0.9), g = G(0);
        bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(4200, t + T - 0.15);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + T - 0.2); g.gain.setTargetAtTime(0, t + T - 0.12, 0.1);
        n.connect(bp); bp.connect(g); g.connect(cueBus); g.connect(cueRev);
        n.onended = () => kill(n, bp, g);
        // string-ish tonal rise into the coming chord, then a soft bloom
        const lp = F('lowpass', 300, 1.1), tg = G(0);
        lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(3000, t + T);
        tg.gain.setValueAtTime(0.0001, t); tg.gain.exponentialRampToValueAtTime(1, t + T); tg.gain.setTargetAtTime(0, t + T + 0.05, 1.1);
        lp.connect(tg); tg.connect(cueBus); tg.connect(cueRev);
        const notes = [ch.pad[0] + 12, ch.pad[1] + 12, ch.pad[2] + 12, ch.pad[3] + 12];
        notes.forEach((m, i) => {
          const a = O('sawtooth', mtof(m)), ga = G(0.011);
          a.detune.value = (i % 2 ? 6 : -6);
          a.connect(ga); ga.connect(lp); a.start(t); a.stop(t + T + 7);
          a.onended = i === 0 ? () => kill(a, ga, lp, tg) : () => kill(a, ga);
        });
        notesFor(ch.decor, 80, 92).slice(-3).forEach((m, i) => bell(cueDests(true, true), m, t + T + i * 0.07, 0.38, 2.6, -0.3 + i * 0.3));
      },
      heart(t) {
        [0, 0.3].forEach((dt, k) => {
          const tt = t + dt, a = k ? 0.7 : 1;
          const o = O('sine', 130), o2 = O('sine', 260), g = G(0), g2 = G(0.55), lp = F('lowpass', 420, 0.7);
          o.frequency.setValueAtTime(130, tt); o.frequency.exponentialRampToValueAtTime(69.3, tt + 0.09);   // → Db2
          o2.frequency.setValueAtTime(260, tt); o2.frequency.exponentialRampToValueAtTime(138.6, tt + 0.09);
          g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.16 * a, tt + 0.008); g.gain.setTargetAtTime(0, tt + 0.012, 0.075);
          o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(cueBus);
          const c = ctx.createBufferSource(), cg = G(0.08 * a);
          c.buffer = THUMP; c.playbackRate.value = 0.55; c.connect(cg); cg.connect(lp);
          o.start(tt); o2.start(tt); c.start(tt);
          o.stop(tt + 0.7); o2.stop(tt + 0.7);
          o.onended = () => kill(o, o2, g, g2, lp, c, cg);
        });
      },
      whoosh(t) {
        const n = noise(t, 1.65), bp = F('bandpass', 260, 0.8), g = G(0), p = P(-0.7);
        bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.6); bp.frequency.exponentialRampToValueAtTime(700, t + 1.5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.55); g.gain.linearRampToValueAtTime(0, t + 1.5);
        if (hasPan) { p.pan.setValueAtTime(-0.7, t); p.pan.linearRampToValueAtTime(0.7, t + 1.5); }
        n.connect(bp); bp.connect(g); g.connect(p); p.connect(cueBus); p.connect(cueRev);
        n.onended = () => kill(n, bp, g, p);
      },
    };
    function cue(name, t) {
      const fn = CUES[name];
      if (!fn) return false;
      if (cueFaded) { ramp(cueBus.gain, MIX.cue, t, 0.02); cueFaded = false; }
      fn(t);
      return true;
    }

    /* ---- smooth param ramps (fade / duck / mute / song) */
    function ramp(param, v, now, secs) {
      const cur = param.value;
      try { param.cancelScheduledValues(now); } catch (e) { /* noop */ }
      param.setValueAtTime(cur, now);
      if (secs > 0.01) param.linearRampToValueAtTime(v, now + secs);
      else param.setValueAtTime(v, now + 0.005);
    }
    function fadeTo(v, secs, now) {
      fades.forEach((g) => ramp(g.gain, v, now, secs));
      if (v <= 0) { ramp(cueBus.gain, 0, now, secs); cueFaded = true; }
      else if (cueFaded) { ramp(cueBus.gain, MIX.cue, now, 0.05); cueFaded = false; }
    }
    const duckTo = (v, secs, now) => ducks.forEach((g) => ramp(g.gain, v, now, secs));
    const mute = (m, now, secs) => ramp(master.gain, m ? 0 : 1, now, secs);

    function connectSong(node, vol) {
      const g = G(0), lp = F('lowpass', 8000, 0.5);
      node.connect(g); g.connect(lp); lp.connect(musicDry);
      return {
        set(I, secs, now) {
          ramp(g.gain, (0.45 + 0.55 * I) * vol, now, secs);
          ramp(lp.frequency, 3000 * Math.pow(20000 / 3000, I), now, secs);
        },
        disconnect() { kill(node, g, lp); },
      };
    }

    return {
      ctx, out, LY, MIX, nodes: { master, comp, conv, preDelay, dlyIn, shaper },
      tick, start, stop, cue, chordAt,
      setIntensity, intensityAt,
      fadeTo, duckTo, mute, connectSong,
      get running() { return seq.on; },
      info() { return { on: seq.on, section: FORM[seq.f], bar: seq.b, pass: seq.pass, voices: voiceEnds.length, I: intensityAt(ctx.currentTime) }; },
    };
  }

  /* ======================================================================
     PUBLIC API
     ====================================================================== */
  const music = (Love.config && Love.config.music) || {};
  const state = { unlocked: false, muted: false, intensity: 0, faded: false, duck: 1, mode: null, muteSettled: false };
  let ctx = null, eng = null, timer = 0, muteTimer = 0, fadeTimer = 0, song = null, unlockedAt = 0;
  const lastCue = {};

  /* The generated score is band-limited well below 16 kHz, so it runs at 32 kHz
     (≈⅓ less DSP on phones); a user song keeps the device rate. */
  function makeContext(forSong) {
    if (!AC) return null;
    const tries = forSong ? [{ latencyHint: 'playback' }] : [{ latencyHint: 'playback', sampleRate: 32000 }, { latencyHint: 'playback' }];
    for (let i = 0; i < tries.length; i++) { try { return new AC(tries[i]); } catch (e) { /* unsupported option */ } }
    try { return new AC(); } catch (e) { return null; }
  }

  function primeIOS() { // a silent buffer inside the gesture fully unlocks iOS output
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
      s.onended = () => { try { s.disconnect(); } catch (e) { /* noop */ } };
    } catch (e) { /* noop */ }
  }

  function shouldRun() { return state.unlocked && !document.hidden && !(state.muted && state.muteSettled); }
  function syncRun() {
    if (!state.unlocked) return;
    const run = shouldRun();
    if (ctx && ctx.state !== 'closed') {
      if (run && ctx.state !== 'running') settle(ctx.resume());
      else if (!run && ctx.state === 'running') settle(ctx.suspend());
    }
    if (song && !song.failed) {
      if (run && !state.faded) { if (song.el.paused) settle(song.el.play()); }
      else if (!run && !song.el.paused) song.el.pause();
    }
  }

  function loop() {
    clearTimeout(timer); timer = 0;
    if (!eng || state.mode !== 'score') return;
    try { eng.tick(ctx.currentTime); } catch (e) { warn(e); }
    timer = setTimeout(loop, TICK);
  }

  function startScore(fadeSecs) {
    if (!eng) return;
    state.mode = 'score';
    const t = ctx.currentTime;
    eng.setIntensity(state.intensity, 0, t);
    if (!eng.running) eng.start(t + 0.12);
    eng.fadeTo(state.faded ? 0 : 1, fadeSecs == null ? 3 : fadeSecs, t);
    loop();
  }

  /* ---- optional user song ------------------------------------------- */
  function songRoutable(src) {
    try {
      const u = new URL(src, location.href);
      return /^https?:$/.test(location.protocol) && u.origin === location.origin;
    } catch (e) { return false; }
  }
  // direct <audio>.volume control (file:// or cross-origin): JS-tweened factors
  function makeDirect(el) {
    const fac = { base: 0, fade: 0, duck: state.duck, mute: state.muted ? 0 : 1 };
    const tw = {};
    let iv = 0;
    function apply() {
      const t = performance.now();
      let moving = false;
      Object.keys(tw).forEach((k) => {
        const w = tw[k], p = clamp((t - w.t0) / w.dur, 0, 1);
        fac[k] = w.from + (w.to - w.from) * p;
        if (p >= 1) delete tw[k]; else moving = true;
      });
      try { el.volume = clamp(fac.base * fac.fade * fac.duck * fac.mute, 0, 1); } catch (e) { /* iOS: read-only */ }
      if (!moving) { clearInterval(iv); iv = 0; }
    }
    return {
      set(k, v, secs) {
        tw[k] = { from: fac[k], to: v, t0: performance.now(), dur: Math.max(1, (secs || 0) * 1000) };
        if (!iv) iv = setInterval(apply, 40);
        apply();
      },
      stop() { clearInterval(iv); iv = 0; },
    };
  }
  function applySongIntensity(secs) {
    if (!song || song.failed) return;
    const vol = clamp(music.volume == null ? 0.8 : +music.volume, 0, 1);
    if (song.ctl) song.ctl.set(state.intensity, secs, ctx.currentTime);
    else if (song.direct) song.direct.set('base', (0.45 + 0.55 * state.intensity) * vol, secs);
  }
  function songFail() {
    if (!song || song.failed) return;
    song.failed = true;
    try { song.el.pause(); song.el.removeAttribute('src'); song.el.load(); } catch (e) { /* noop */ }
    if (song.ctl) song.ctl.disconnect();
    if (song.direct) song.direct.stop();
    song = null;
    warn('song failed to load — falling back to the generated score');
    if (eng) startScore(2);
    else state.mode = null;
  }
  function startSong(src) {
    const el = new Audio();
    el.preload = 'auto'; el.loop = true; el.src = src;
    song = { el, failed: false, ctl: null, direct: null };
    if (eng && songRoutable(src)) {
      try { song.ctl = eng.connectSong(ctx.createMediaElementSource(el), clamp(music.volume == null ? 0.8 : +music.volume, 0, 1)); }
      catch (e) { song.ctl = null; }
    }
    if (!song.ctl) {
      song.direct = makeDirect(el);
      try { el.volume = 0; } catch (e) { /* noop */ }
    }
    el.addEventListener('error', songFail);
    state.mode = 'song';
    applySongIntensity(0);
    if (song.direct) song.direct.set('fade', 1, 3);
    if (eng) eng.fadeTo(1, song.ctl ? 3 : 0.05, ctx.currentTime); // cues + routed song
    const p = el.play();
    if (p && p.catch) p.catch((err) => {
      if (err && err.name === 'NotAllowedError') return; // retried on the next gesture (see below)
      if (err && err.name === 'AbortError') return;
      songFail();
    });
  }

  /* ---- methods ------------------------------------------------------- */
  function unlock() {
    if (state.unlocked) {
      syncRun();
      if (state.faded) fadeIn(3);
      return;
    }
    const src = music.src;
    if (!AC && !src) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* noop */ }
    ctx = makeContext(!!src);
    if (ctx) {
      try { eng = createEngine(ctx); }
      catch (e) { warn(e); eng = null; try { ctx.close(); } catch (e2) { /* noop */ } ctx = null; }
    }
    if (ctx) { settle(ctx.resume()); primeIOS(); }
    if (!eng && !src) return;
    state.unlocked = true;
    unlockedAt = performance.now();
    if (eng) { eng.mute(state.muted, ctx.currentTime, 0); eng.duckTo(state.duck, 0, ctx.currentTime); }
    if (src) startSong(src); else startScore(3);
    if (state.muted) muteTimer = setTimeout(() => { if (state.muted) { state.muteSettled = true; syncRun(); } }, 900);
    Love.emit('audio:unlocked');
  }

  function setIntensity(v, secs) {
    state.intensity = clamp(+v || 0, 0, 1);
    if (!state.unlocked) return;
    secs = secs == null ? 2 : Math.max(0, +secs || 0);
    if (state.mode === 'score' && eng) eng.setIntensity(state.intensity, secs, ctx.currentTime);
    if (state.mode === 'song') applySongIntensity(secs);
  }

  function cue(name) {
    if (!state.unlocked || !eng || state.muted || document.hidden || ctx.state === 'closed') return;
    if (ctx.state !== 'running') {
      settle(ctx.resume());
      // right after unlock() the context is still starting up asynchronously: schedule anyway
      // (it plays the moment the clock starts); otherwise don't queue stale one-shots
      if (performance.now() - unlockedAt > 1500) return;
    }
    const n = String(name), t = performance.now();
    if (lastCue[n] && t - lastCue[n] < 90) return;
    lastCue[n] = t;
    try { eng.cue(n, ctx.currentTime + 0.02); } catch (e) { warn(e); }
  }

  function duck(amount, secs) {
    if (!state.unlocked) return;
    amount = amount == null ? 0.5 : clamp(+amount || 0, 0, 1);
    secs = secs == null ? 1 : Math.max(0, +secs || 0);
    state.duck = 1 - amount;
    if (eng) eng.duckTo(state.duck, secs, ctx.currentTime);
    if (song && song.direct) song.direct.set('duck', state.duck, secs);
  }
  const unduck = (secs) => duck(0, secs == null ? 1 : secs);

  function fadeOut(secs) {
    if (!state.unlocked) return;
    secs = secs == null ? 2 : Math.max(0, +secs || 0);
    state.faded = true;
    if (eng) eng.fadeTo(0, secs, ctx.currentTime);
    if (song && song.direct) song.direct.set('fade', 0, secs);
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      if (!state.faded) return;
      if (eng && state.mode === 'score') eng.stop(ctx.currentTime);
      if (song && !song.failed) song.el.pause();
    }, secs * 1000 + 400);
  }

  function fadeIn(secs) {
    if (!state.unlocked) return;
    secs = secs == null ? 3 : Math.max(0, +secs || 0);
    clearTimeout(fadeTimer);
    state.faded = false;
    syncRun();
    if (state.mode === 'score' && eng) {
      const t = ctx.currentTime;
      if (!eng.running) { eng.setIntensity(state.intensity, 0, t); eng.start(t + 0.12); }
      eng.fadeTo(1, secs, t);
      loop();
    } else if (song && !song.failed) {
      if (song.el.paused) settle(song.el.play());
      if (song.direct) song.direct.set('fade', 1, secs);
      if (eng) eng.fadeTo(1, secs, ctx.currentTime);
    }
  }

  function setMuted(m) {
    m = !!m;
    state.muted = m;
    clearTimeout(muteTimer);
    if (state.unlocked) {
      if (!m) { state.muteSettled = false; syncRun(); }
      if (eng) eng.mute(m, ctx.currentTime, 0.6);
      if (song && song.direct) song.direct.set('mute', m ? 0 : 1, 0.6);
      if (m) muteTimer = setTimeout(() => { if (state.muted) { state.muteSettled = true; syncRun(); } }, 900);
    }
    Love.emit('audio:muted', m);
  }
  function toggle() { setMuted(!state.muted); return state.muted; }

  /* ---- environment hooks */
  document.addEventListener('visibilitychange', syncRun);
  window.addEventListener('pagehide', syncRun);
  window.addEventListener('pageshow', syncRun);
  // iOS can leave the context "interrupted" (calls, Siri, lock screen): any later gesture resumes it.
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, () => {
    if (!state.unlocked || !shouldRun()) return;
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') settle(ctx.resume());
    if (song && !song.failed && !state.faded && song.el.paused) settle(song.el.play());
  }, { capture: true, passive: true }));
  // each new stage starts un-ducked
  Love.on('stage:enter', () => { if (state.unlocked && state.duck < 1) unduck(1.2); });

  /* ---- offline preview (debug / verification) */
  function renderOffline(o) {
    o = o || {};
    if (!OAC) return Promise.reject(new Error('OfflineAudioContext unavailable'));
    const secs = o.seconds || 60, sr = o.sampleRate || 44100;
    const octx = new OAC(2, Math.ceil(secs * sr), sr);
    const e = createEngine(octx);
    const plan = (o.plan || []).slice().sort((a, b) => a[0] - b[0]);
    const cues = (o.cues || []).slice().sort((a, b) => a[0] - b[0]);
    e.setIntensity(o.start == null ? 0.2 : o.start, 0, 0);
    e.fadeTo(1, o.fadeIn == null ? 3 : o.fadeIn, 0);
    e.start(0.1);
    for (let t = 0; t < secs; t += TICK / 1000) {
      while (plan.length && plan[0][0] <= t) { const p = plan.shift(); e.setIntensity(p[1], p[2], p[0]); }
      while (cues.length && cues[0][0] <= t) { const c = cues.shift(); e.cue(c[1], c[0]); }
      e.tick(t);
    }
    return octx.startRendering();
  }

  const api = {
    get muted() { return state.muted; },
    get unlocked() { return state.unlocked; },
    get intensity() { return state.intensity; },
    unlock, setIntensity, cue, duck, unduck, fadeOut, fadeIn, setMuted, toggle,
    _debug: {
      get ctx() { return ctx; },
      get engine() { return eng; },
      get state() { return Object.assign({}, state, { ctxState: ctx && ctx.state }); },
      get song() { return song; },
      createEngine, renderOffline,
      score: { BPM, CH, PROG, MEL, FORM, SEC },
    },
  };
  Love.audio = api;
})();
