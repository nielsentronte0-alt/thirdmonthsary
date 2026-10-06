/* ==========================================================================
   stage3.js — "Wait… someone is coming"   (the main cinematic scene)

   A short animated film built from layered DOM / SVG / canvas:
     sky → sun + god-rays → clouds → hills ×3 → trees → hedges → garden
     (path, rose arch, HER, HIM, tulips) → blurred foreground → particles
   A virtual camera (S.camX / S.camY / S.camZ) is applied to every layer
   with its own parallax factor p (0 = infinitely far, 1 = the garden path,
   >1 = foreground). Everything visible is driven by ONE master timeline so
   seek(t) shows the correct frame (the walk frame is derived from the
   timeline's walk clock S.wk, see walkPose()).

   Shot list (seconds):
     0–4    title card on black, letterbox slides in
     4–9    wide establishing pan → HER under the rose arch, backlit
     9–12   whip back to the start of the path, HIM appears far away, standing
     11.9–27 the walk: hand-drawn frames (assets/character/walk/) — start from
            standing, 23 steps at 20 fps with planted feet locked to the path,
            stop on the left heel strike, settle into his standing pose
            (camera follows + pushes in, beats, wind, music builds)
            17–19 cut-in: his determined face
            22.5–24.8 the reverse cut-in: HER (Sazzi) notices him — a surprised
            glance over her shoulder toward him, a blink, her happy smile (hard
            cuts; hides the camera cut to the two-shot)
     25–29  arrival two-shot: she leans toward him, then reacts (hands fly to her
            heart through an in-between, she laughs, a happy bounce), flare, hearts
            27.05 his sprite is swapped (invisibly) for the 3-layer stack
            him-side-empty + bouquet + him-side-hands so the bouquet can leave
     29–31  close-up: his happy face (behind it his profile gets the softened
            face patch him-face-soft.webp: relaxed brow, slight smile)
     31–35  THE HANDOFF on a tighter two-shot: she lowers her hands, he leans in
            and holds the flowers out, she leans toward him and reaches out (her
            live arms), her hand comes onto the wrap beside his fists, both hold it
            a beat, he lets go and she draws it in — the bouquet rides on her hand
            (IK), swinging in low and turning toward her — her other hand meets it
            at the neck → her2-hold + her2-hold-arms, chime, hearts, bloom (his lean
            pivots the upper body at the shirt hem over him-side-legs.webp)
     35–42  slow push-in on HER holding the flowers and smiling, text; at this
            zoom her head is the bust-resolution plate (her2-cu-*: happy, blink,
            a giggle with the laughing face)
     42–45  pull back to the two of them under the arch
     45–48  glow, letterbox opens → Love.next()

   HER is Sazzi (images/sazzi.png) as a raster rig (assets/character/her2.json):
   full-figure poses on one 360×600 canvas (1 px = 1 of his sprite px) that only
   differ in the forearms, flipped by a pose clock (herPose) with 50 ms
   dissolves; for the handoff her forearms are live parts (ARM: turned about the
   elbow, foreshortened, the hand bent at the wrist) so her hand can hold on to
   the bouquet; blink / smile overlays and the bust-resolution head plates on the
   same canvas (from the two-shot on: eyes on him, then on the camera in her
   close-up; every expression change is a hard cut through closed eyes);
   breathing + a slow weight-shift sway about her feet. All of it is a function
   of the timeline clock S.clk, so seek(t) shows the right frame.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.Love || !window.gsap) return;

  const { util } = Love;
  const CONF = Love.config || {};
  const C3 = CONF.stage3 || {};
  const CHAR = 'assets/character/';
  const TAU = Math.PI * 2;
  const P_SUN = 0.05;                       // parallax of the sun / sky dome

  /* --------------------------------------------------------- shot timing */
  /* ------------------------------------------------------------ the walk
     Numbers from assets/character/walk/walk.json (inlined: no fetch over
     file://). Cells are 320×618 at him-side.png's pixel scale; every cell has
     his hip at x = 132 and the ground (near sole) at y = 614, the far foot
     plants 10 px higher. walk-stand (= start frame 0 = the last stop frame) is
     him-side.png placed at (46, 10) in the cell, so the box centre of the
     standing sprite (him-side, 255 px wide) sits 41.5 px right of the hip.
     The cycle strip has 24 frames per stride (288 px): one frame per 12 px,
     20 fps → 240 px/s; the sprite is drawn snapped to that 12 px grid so a
     planted foot never creeps. Feet rows: [nearHeel, nearToe, nearLift,
     farHeel, farToe, farLift] in cell px (lift 0 = planted). */
  const WD = 'assets/character/walk/';
  const WALK_STEPS = 23;                    // heel strikes after the start (odd → ends on the left heel)
  const WK = {
    cellW: 320, cellH: 618, hipX: 132, standX: 46, standY: 10, boxW: 255, boxH: 604,
    fps: 20, step: 12, n: 24, speed: 240,
    cycle: {
      src: 'walk-strip-24.webp',
      feet: [[164.2, 282.6, 0, 26.1, 144.5, 0], [152.2, 272.8, 0, 17.3, 132.5, 0], [140.4, 262.2, 0, 9.4, 120.5, 0], [128.5, 250.4, 0, 11.8, 116.5, 4], [116.5, 238.5, 0, 23.5, 130, 4.2], [104.5, 226.5, 0, 49.4, 160.3, 3.1], [92.5, 214.5, 0, 80.4, 196.5, 3.2], [80.6, 202.5, 0, 108.5, 228, 5.9], [68.7, 190.5, 0, 133.9, 255.4, 8.8], [56.9, 178.5, 0, 155.1, 277, 10.4], [45.3, 166.5, 0, 169.3, 290.1, 8.2], [34.3, 154.5, 0, 171.5, 290.6, 3.2],
        [24.1, 142.5, 0, 166.2, 284.6, 0], [15.3, 130.5, 0, 154.2, 274.8, 0], [7.4, 118.5, 0, 142.4, 264.2, 0], [9.8, 114.5, 4, 130.5, 252.4, 0], [21.5, 128, 4.2, 118.5, 240.5, 0], [47.4, 158.3, 3.1, 106.5, 228.5, 0], [78.4, 194.5, 3.2, 94.5, 216.5, 0], [106.5, 226, 5.9, 82.6, 204.5, 0], [131.9, 253.4, 8.8, 70.7, 192.5, 0], [153.1, 275, 10.4, 58.9, 180.5, 0], [167.3, 288.1, 8.2, 47.3, 168.5, 0], [169.5, 288.6, 3.2, 36.3, 156.5, 0]],
    },
    start: {
      src: 'walk-start-strip.webp', join: 73,
      dx: [0, 1.12, 3, 5.56, 9, 13.5, 19, 25.5, 33, 41.5, 51, 61.62],
      feet: [[52.5, 174.5, 0, 95.5, 217.5, 0], [51.9, 173.4, 0, 94.4, 216.4, 0], [51.5, 171.5, 0, 92.5, 214.5, 0], [52.3, 168.9, 0, 89.9, 211.9, 0], [52.9, 165.5, 0, 86.5, 208.5, 0], [41.2, 148.5, 0.5, 82.1, 204, 0], [35, 136.2, 2, 76.7, 198.5, 0], [52.6, 158.1, 0.5, 70.3, 192, 0], [80.2, 193.4, 2, 63, 184.5, 0], [112.8, 231.8, 2.7, 55.1, 176, 0], [142.9, 264.7, 7.4, 46.5, 166.5, 0], [158.8, 279.8, 7.1, 36.4, 155.9, 0]],
    },
    stopL: {                                  // after cycle frame 12 (left heel strike)
      src: 'walk-stop-l-strip.webp',
      dx: [10.88, 21, 30.44, 39, 46.5, 53, 58.5, 63, 66.5, 69, 70.38, 71],
      feet: [[17.4, 131.6, 0, 155.3, 275.9, 0], [12, 121.5, 0, 145.4, 267.2, 0], [7.2, 113.3, 0.5, 136, 258, 0], [7.2, 110.7, 2, 127.5, 249.5, 0], [19.6, 130.7, 0.5, 120, 242, 0], [35.9, 154.2, 2, 113.5, 235.5, 0], [47.2, 168.4, 2.6, 108, 230, 0], [54.9, 176.9, 2.6, 103.5, 225.5, 0], [56.1, 178.1, 1.3, 100, 222, 0], [54.5, 176.5, 0, 97.5, 219.5, 0], [53.1, 175.1, 0, 96.1, 218.1, 0], [52.5, 174.5, 0, 95.5, 217.5, 0]],
    },
    stopR: {                                  // after cycle frame 0 (right heel strike)
      src: 'walk-stop-r-strip.webp',
      dx: [11.69, 23, 33.75, 44, 53.81, 63, 71.38, 79, 85.88, 92, 97.38, 102, 105.94, 109, 110.94, 112],
      feet: [[152.5, 273.1, 0, 18.6, 132.8, 0], [141.4, 263.2, 0, 12, 121.5, 0], [130.7, 252.7, 0, 11.3, 116.8, 0.5], [120.5, 242.5, 0, 17, 118.2, 2], [110.7, 232.7, 0, 34.2, 140.3, 0.5], [101.5, 223.5, 0, 55.2, 168.4, 2], [93.1, 215.1, 0, 73.7, 191.3, 0.5], [85.5, 207.5, 0, 90, 210.5, 4.1], [78.6, 200.6, 0, 102.5, 224.4, 6.4], [72.5, 194.5, 0, 110.2, 232.1, 6.2], [67.1, 189.1, 0, 109.6, 231.5, 3], [62.5, 184.5, 0, 105.5, 227.5, 0], [58.6, 180.6, 0, 101.6, 223.6, 0], [55.5, 177.5, 0, 98.5, 220.5, 0], [53.6, 175.6, 0, 96.6, 218.6, 0], [52.5, 174.5, 0, 95.5, 217.5, 0]],
    },
  };
  WK.stop = WALK_STEPS % 2 ? WK.stopL : WK.stopR;
  WK.stand = WK.stop.feet[WK.stop.feet.length - 1];
  WK.dist = WALK_STEPS * WK.n / 2 * WK.step;                     // cycle distance (sprite px), ends on a heel strike
  WK.tStart = WK.start.dx.length / WK.fps;                        // 0.6 s from standing to cycle frame 0
  WK.tStop = WK.tStart + WK.dist / WK.speed + 1 / WK.fps;          // the contact frame is held one frame
  WK.dur = WK.tStop + (WK.stop.dx.length - 1) / WK.fps;            // …then the stop; its last frame is the stand
  WK.total = WK.start.join + WK.dist + WK.stop.dx[WK.stop.dx.length - 1];   // hip travel, start → stand (sprite px)

  const T = {
    barsIn: 0.15, title: 0.55, titleOut: 3.3, fadeUp: 3.75, estab: 3.4,
    whip: 8.95, himIn: 9.6,
    walk0: 11.9,                             // the start sequence begins (he stands still before)
    cutA: 16.9, cutAOut: 19.3,
    cutH: 22.55, cutHSoft: 23.5, cutHOut: 24.75,   // her cut-in: surprised → happy
    two: 24.6, arrive: 26.95, swap: 27.05,
    cutB: 29.35, hand: 31.0,                 // his smile, then back on a tighter two-shot
    reach: 31.35, grip: 33.0, rel: 33.36, land: 34.15,   // he offers (and holds it out) → her hand closes on it → he lets go, she draws it in → in her arms
    smile: 35.1, line1: 36.5, line2: 38.5, giggle: 39.85, pull: 42.1,
    glow: 44.9, end: 48.3,
  };
  T.walk1 = T.walk0 + WK.dur;                // 26.9: standing in front of her (him-side takes over)
  T.react = T.arrive + 0.35;                 // her hands fly to her heart (the arrival burst)
  T.lower = 31.7;                            // she lowers her hands as he leans in…
  T.reachOut = 32.3;                         // …and reaches out for the flowers
  T.pass = T.land - 0.05 - T.rel;            // the bouquet travels from his hands into her arms
  T.touch = 32.55;                           // her far hand reaches the wrap (it goes over it from here)
  // beats avoid both cut-ins (the third, "…a little closer", plays over his approach)
  const BEAT_WINDOWS = [[12.3, 16.5], [19.6, 22.35], [24.95, 27.25]];

  /* The bouquet, in sprite space. him-side.webp is 255×604 and the bouquet
     sits in it at box (109,154) 146×269. HER (her2, Sazzi) is laid out on a
     360×600 canvas at the same pixel scale (1 her2 px = 1 sprite px, so
     k = U/604), feet centred on x 180, soles on y 600; her2-hold.json puts the
     (mirrored, -14°) bouquet at (85,157.5) w 146 — the same on-screen size.
     Keep HOLD in sync with assets/character/her2-hold.json. */
  const BQ = { x: 109, y: 154, w: 146, h: 269 };
  const HOLD = { x: 85, y: 157.5, w: 146, rot: -14 };
  const HER = {
    w: 360, h: 600, ax: 180,                 // canvas; (ax, h) sits on (xHer, groundY)
    face: [150, 100],                        // face centre (her2.json head.faceCenter)
    plate: [70, 0, 212, 172],                // head plates (her2-cu-*.webp) box on the canvas (= .s3-her__plate in CSS)
    scale: 1,                                // her size vs his sprite scale (1 = the sheet's proportions)
  };
  /* her walk cut-in: the busts are separate drawings, registered onto the happy
     bust (296×301) by their faces: [w, h, centre dx, centre dy, scale, rotate°].
     They are the sheet's own orientation (her2-cutR-*: face turned a little to
     screen-right, irises looking screen-LEFT, toward him: a glance over her
     shoulder); -blink is the happy drawing with closed eyes (the bridge frame). */
  const BUST = {
    happy: [296, 301, 0, 0, 1, 0],
    blink: [296, 301, 0, 0, 1, 0],
    surprised: [302, 301, 8, 2, 0.96, 1],
  };
  /* HER LIVE ARMS (the handoff): her forearms as separate parts (her2-arm-*,
     assets/character/her2.json "liveArms"), turned about the elbow (deg, and
     foreshortened along the forearm's source axis by s) with the hand bent at the
     wrist (h) — the 2D rig of the arm drawings, evaluated per frame so her far
     hand stays exactly on the bouquet while she takes it and draws it in.
     Boxes are [x, y, w, h] on her 360×600 canvas; params are [deg, s, h]. */
  const ARM = {
    far: {
      elbow: [106, 278], wrist: [92.5, 337], axis: 103, palm: [87, 360],
      cap: [95, 267, 22, 22], sleeve: [77, 276, 39, 65], hand: [72, 332, 31, 61],
      wait: [0, 1, 0], reach1: [30, 0.95, 6], reach2: [62, 0.86, 14], hold: [-64.0546, 0.7, 0],
    },
    near: {
      elbow: [226, 258], wrist: [221.5, 344], axis: 93, palm: [217, 368],
      cap: [206, 238, 40, 40], sleeve: [204, 256, 46, 92], hand: [197, 339, 42, 61],
      wait: [0, 1, 0], reach1: [26, 0.95, 4], reach2: [54, 0.88, 8], hold: [32.7988, 0.7, 0],
    },
  };
  /* where her far hand takes the bouquet while it is still in his hands: the
     right-hand side of the wrap cone, just above his fists (display px from the
     bouquet box centre, bouquet.webp orientation) */
  const GRIP0 = [29, -19];
  const GRIP_H = 5;                          // her wrist bend once she holds it (deg)
  const BQ_DIP = 0.018;                      // her forearm comes a little toward the camera mid-pass (× 604 her px)
  const D2R = Math.PI / 180;
  const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* front-loaded eases that still START AT REST (unlike power2.out): speed
     20p(1-p)^3 peaks at p = .25 (lead4), 30p(1-p)^4 at p = .2 (lead5) */
  const easeLead4 = (p) => 1 - Math.pow(1 - p, 4) * (1 + 4 * p);
  const easeLead5 = (p) => 1 - Math.pow(1 - p, 5) * (1 + 5 * p);

  /* ------------------------------------------------------------- helpers */
  function rng(seed) {                       // deterministic (same art every visit)
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const n1 = (v) => Math.round(v * 10) / 10;
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  function audio(fn) {
    const A = Love.audio, args = Array.prototype.slice.call(arguments, 1);
    if (A && typeof A[fn] === 'function') { try { A[fn].apply(A, args); } catch (e) { /* audio is optional */ } }
  }

  /* ------------------------------------------------------------- state */
  let root = null;            // .s3 container
  const R = {};               // element refs
  let layers = [];            // [{el, p, k, last}]
  let L = null;               // layout numbers (viewport-derived)
  let S = null;               // animated scalars (camera, walk…)
  let tl = null, fx = null, offResize = null;
  let active = false, ended = false;
  const WIMG = {};            // walk strips: { start, cycle, stop } → HTMLImageElement
  let walkReady = null;       // Promise: every strip decoded (enter() waits on it before the walk)
  let gated = false;          // the timeline is holding on the title card for the strips
  let HERK = [[0, 'wait']];   // her pose keys [[t, pose]] on the timeline clock (buildTimeline)
  let BLINKS = [];            // her closed-eye windows [[t0, t1]] (blinks + "eyes closed in joy")
  const POSE_XF = 0.05;       // dissolve between two drawings (s): reads as motion, never a double exposure
  const POSES = ['wait', 'mid', 'react', 'hold'];
  const POSE_SRC = {
    wait: 'her2-wait.webp', mid: 'her2-react-mid.webp', react: 'her2-react.webp', hold: 'her2-hold.webp',
  };
  /* pose keys may also be 'live': her body is the 'hold' drawing (forearms removed,
     elbow caps) and her forearms are the live arm parts above the bouquet; 'hold'
     shows the her2-hold-arms drawing there instead */
  const bodyOf = (p) => (p === 'live' ? 'hold' : p);
  const armsOf = (p) => (p === 'live' ? 'live' : (p === 'hold' ? 'img' : ''));

  /* ===================================================================
     STATIC MARKUP (init)
     =================================================================== */
  const ROSE_SVG =
    '<svg class="s3-rose" viewBox="0 0 40 64" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="s3-rose-g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f7c1cd"/><stop offset=".5" stop-color="#e05a7a"/><stop offset="1" stop-color="#9e1034"/></linearGradient></defs>' +
    '<path class="s3-rose__stem" d="M20 30.5c-.6 9 .4 20 1.4 31"/>' +
    '<path class="s3-rose__leaf" d="M20.4 45.5c-6.2.4-11-3-12.6-8.6 6-.6 10.8 2.6 12.6 8.6z"/>' +
    '<path class="s3-rose__leaf" d="M21.1 52c5.2-1.4 8.6-5 9.4-10-5 .8-8.6 4.6-9.4 10z"/>' +
    '<path class="s3-rose__bloom" d="M20 31.5c-7.3 0-12.3-5.1-12.3-12 0-6.3 4.4-11.4 10.4-12.1 4.1-.5 7.6.9 10.2 3.6 2.4 2.4 4 5.3 4 8.6 0 6.8-5 11.9-12.3 11.9z"/>' +
    '<path class="s3-rose__line" d="M20.6 12.2c-2.9-.2-5.3 1.8-5.3 4.6 0 2.5 2 4.4 4.7 4.4 2.5 0 4.3-1.8 4.3-4 0-1.9-1.4-3.3-3.2-3.3-1.6 0-2.8 1.2-2.6 2.8"/>' +
    '<path class="s3-rose__line" d="M10.2 21.4c1.9 3.6 5.6 5.9 9.8 5.9 4.3 0 8-2.4 9.9-6M11.7 13.6c1.7-2.9 4.8-4.8 8.4-4.8"/>' +
    '<path class="s3-rose__hi" d="M23.4 8.6c3.3 1 6 3.6 7 7"/>' +
    '</svg>';

  const BIRD_SVG = '<svg viewBox="0 0 24 10" aria-hidden="true"><path d="M1 7.5Q6 1 12 6.2Q18 1 23 7.5"/></svg>';

  /** Soft out-of-focus light discs (CSS only). */
  function bokehHTML(seed, n, palette, area, size) {
    const r = rng(seed);
    const a = area || { x: 0, y: 0, w: 100, h: 100 };
    const sz = size || [3, 16];
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = a.x + r() * a.w, y = a.y + r() * a.h;
      const d = sz[0] + r() * (sz[1] - sz[0]);
      const c = pick(r, palette);
      const al = (0.16 + r() * 0.38).toFixed(2);
      s += `<i class="s3-bokeh" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${d.toFixed(1)}vmax;height:${d.toFixed(1)}vmax;--c:${c};--a:${al}"></i>`;
    }
    return s;
  }
  const WARM = ['255,206,150', '255,178,170', '255,226,186', '242,140,160', '255,190,120'];
  function template() {
    const herCustom = !!(CONF.her && CONF.her.sprite);
    const im = (cls, src) => `<img class="${cls}" src="${CHAR}${src}" alt="" draggable="false" decoding="async">`;
    // her live forearms (ARM): elbow cap, then the forearm turned about the elbow
    // with the hand (under the cuff) bent about the wrist; all boxes on her canvas
    const pc = (v, d) => (v / d * 100).toFixed(4) + '%';
    const box = (b) => `left:${pc(b[0], HER.w)};top:${pc(b[1], HER.h)};width:${pc(b[2], HER.w)};height:${pc(b[3], HER.h)}`;
    const armHTML = (side) => {
      const A = ARM[side], src = (p) => `${CHAR}her2-arm-${side}-${p}.webp`;
      const part = (p) => `<img class="s3-herarm__${p}" src="${src(p)}" style="${box(A[p])}" alt="" draggable="false" decoding="async">`;
      return `<div class="s3-herarm s3-herarm--${side}">${part('cap')}` +
        `<div class="s3-herarm__fore" style="transform-origin:${pc(A.elbow[0], HER.w)} ${pc(A.elbow[1], HER.h)}">` +
        `<div class="s3-herarm__wrist" style="transform-origin:${pc(A.wrist[0], HER.w)} ${pc(A.wrist[1], HER.h)}">${part('hand')}</div>` +
        `${part('sleeve')}</div></div>`;
    };
    /* HER: every pose of the rig on one canvas (only the forearms differ), the
       face overlays, then the close-up head plates; her forearms in the hold
       live in .s3-herhands, above the bouquet. A custom sprite (config) is a
       single still image instead. */
    const herRig = herCustom
      ? `<img class="s3-her__img s3-her__p" data-pose="wait" src="${util.escapeHTML(CONF.her.sprite)}" alt="" draggable="false" decoding="async">`
      : POSES.map((p) => `<img class="s3-her__img s3-her__p" data-pose="${p}" src="${CHAR}${POSE_SRC[p]}" alt="" draggable="false" decoding="async">`).join('') +
        im('s3-her__img s3-her__smile', 'her2-smile.webp') + im('s3-her__img s3-her__blink', 'her2-blink.webp') +
        // her live forearms while they are beside her (in her stack: her silhouette's rim)
        `<div class="s3-herarms-back">${armHTML('far')}${armHTML('near')}</div>` +
        // close-up head plates: happy (looks at the camera), look (irises toward him), closed eyes, laugh
        `<div class="s3-her__plate">${im('s3-her__pl s3-her__pl--happy', 'her2-cu-happy.webp')}${im('s3-her__pl s3-her__pl--look', 'her2-cu-look.webp')}` +
        `${im('s3-her__pl s3-her__pl--blink', 'her2-cu-blink.webp')}${im('s3-her__pl s3-her__pl--laugh', 'her2-cu-laugh.webp')}</div>`;
    // her walk cut-in: the surprised, closed-eye and happy busts, registered by the face (BUST)
    const bustImg = (k, cls) => {
      const b = BUST[k], w = b[0] * b[4], h = b[1] * b[4];
      const st = `left:${(((148 + b[2]) - w / 2) / 296 * 100).toFixed(3)}%;top:${(((150.5 + b[3]) - h / 2) / 301 * 100).toFixed(3)}%;` +
        `width:${(w / 296 * 100).toFixed(3)}%;height:${(h / 301 * 100).toFixed(3)}%;transform:rotate(${b[5]}deg)`;
      // her2-cutR-*: the sheet busts with matte specks / eye-white holes cleaned
      return `<img class="s3-cut__face s3-cut__bustimg ${cls}" src="${CHAR}her2-cutR-${k}.webp" style="${st}" alt="" draggable="false" decoding="async">`;
    };
    // each standing part carries the full sprite and the bouquet-less one (handoff)
    const himImg = im('s3-him__full', 'him-side.webp') + im('s3-him__empty', 'him-side-empty.webp');
    const birds = new Array(5).fill(`<i class="s3-bird">${BIRD_SVG}</i>`).join('');
    const titleSrc = util.fill(C3.title || 'Wait… someone is coming');
    const cut = titleSrc.search(/…|\.\.\./);
    const l1 = cut >= 0 ? titleSrc.slice(0, cut + (titleSrc[cut] === '…' ? 1 : 3)) : titleSrc;
    const l2 = cut >= 0 ? titleSrc.slice(l1.length).trim() : '';
    const beats = (Array.isArray(C3.beats) ? C3.beats : []).filter(Boolean);
    return `
<div class="s3" data-orient="portrait">
  <div class="s3-world" aria-hidden="true">
    <div class="s3-sky"></div>
    <div class="s3-dusk"></div>
    <canvas class="s3-sun"></canvas>
    <div class="s3-birds">${birds}</div>
    <div class="s3-layer s3-layer--soft" data-p="0.1" data-k="clouds"></div>
    <div class="s3-layer s3-layer--soft" data-p="0.2" data-k="hills1"></div>
    <div class="s3-layer s3-layer--soft" data-p="0.3" data-k="hills2"></div>
    <canvas class="s3-rays"></canvas>
    <div class="s3-layer s3-layer--soft" data-p="0.42" data-k="hills3"></div>
    <div class="s3-layer s3-layer--soft" data-p="0.64" data-k="trees"></div>
    <div class="s3-layer s3-layer--soft" data-p="0.85" data-k="hedge"></div>
    <div class="s3-layer s3-layer--soft" data-p="1" data-k="ground">
      <div class="s3-ground-art"></div>
      <div class="s3-archglow"></div>
    </div>
    <!-- the cast gets its own camera layer WITHOUT will-change, so the browser
         re-rasters them at the current zoom (crisp in her close-up) while the
         garden keeps its cheap cached raster (soft = shallow depth of field) -->
    <div class="s3-layer s3-layer--cast" data-p="1" data-k="cast">
      <div class="s3-her${herCustom ? ' s3-her--custom' : ''}">
        <div class="s3-her__halo"></div>
        <div class="s3-her__shadow"></div>
        <i class="s3-her__foot s3-her__foot--far"></i><i class="s3-her__foot s3-her__foot--near"></i>
        <div class="s3-her__idle">${herRig}</div>
      </div>
      <div class="s3-him">
        <div class="s3-him__shadow"></div>
        <i class="s3-him__foot s3-him__foot--far"></i><i class="s3-him__foot s3-him__foot--near"></i>
        <div class="s3-him__haze"><div class="s3-him__body">
          <canvas class="s3-him__walk"></canvas>
          <div class="s3-him__stand">
            <div class="s3-him__part s3-him__legs">${im('s3-him__legsimg', 'him-side-legs.webp')}</div>
            <div class="s3-him__part s3-him__upper">${himImg}${im('s3-him__soft', 'him-face-soft.webp')}</div>
          </div>
        </div></div>
      </div>
      <div class="s3-bq">${im('s3-bq__a', 'her2-bouquet.webp')}${im('s3-bq__b', 'her2-bouquet.webp')}</div>
      <div class="s3-hands"><div class="s3-hands__body"><div class="s3-hands__upper">${im('s3-hands__img', 'him-side-hands.webp')}</div></div></div>
      ${herCustom ? '' : `<div class="s3-herhands"><div class="s3-herhands__idle">${im('s3-herhands__img', 'her2-hold-arms.webp')}${armHTML('far')}${armHTML('near')}</div></div>`}
    </div>
    <div class="s3-layer s3-layer--soft" data-p="1" data-k="front"><div class="s3-front"></div></div>
    <div class="s3-layer s3-layer--soft" data-p="1.5" data-k="fg"></div>
    <div class="s3-flare"><canvas class="s3-flare__core"></canvas><div class="s3-flare__streak"></div><div class="s3-flare__ghost"></div></div>
  </div>

  <div class="s3-cut s3-cut--a" aria-hidden="true">
    <div class="s3-cut__bg"></div>
    <div class="s3-cut__bokeh">${bokehHTML(71, 16, WARM)}</div>
    <div class="s3-cut__sun"></div>
    <div class="s3-cut__dolly"><img class="s3-cut__face" src="${CHAR}face-determined.webp" alt="" draggable="false" decoding="async"></div>
  </div>
  ${herCustom ? '' : `<div class="s3-cut s3-cut--her" aria-hidden="true">
    <div class="s3-cut__bg"></div>
    <div class="s3-cut__bokeh">${bokehHTML(97, 16, WARM)}</div>
    <div class="s3-cut__sun"></div>
    <div class="s3-cut__dolly"><div class="s3-cut__bust">${bustImg('surprised', 's3-cut__b1')}${bustImg('blink', 's3-cut__b3')}${bustImg('happy', 's3-cut__b2')}</div></div>
    <div class="s3-cut__bloom"></div>
  </div>`}
  <div class="s3-cut s3-cut--b" aria-hidden="true">
    <div class="s3-cut__bg"></div>
    <div class="s3-cut__bokeh">${bokehHTML(83, 18, WARM)}</div>
    <div class="s3-cut__sun"></div>
    <div class="s3-cut__dolly"><img class="s3-cut__face" src="${CHAR}face-happy.webp" alt="" draggable="false" decoding="async"></div>
    <div class="s3-cut__bloom"></div>
  </div>

  <div class="s3-bloom" aria-hidden="true"></div>
  <div class="s3-scrim" aria-hidden="true"></div>
  <canvas class="s3-fx" aria-hidden="true"></canvas>
  <div class="s3-leak s3-leak--a" aria-hidden="true"></div>
  <div class="s3-leak s3-leak--b" aria-hidden="true"></div>
  <div class="s3-flash" aria-hidden="true"></div>
  <div class="s3-glow" aria-hidden="true"></div>
  <div class="s3-vig" aria-hidden="true"></div>
  <div class="s3-black" aria-hidden="true"></div>

  <div class="s3-title">
    <div class="s3-title__inner">
      <p class="eyebrow s3-title__eyebrow">${util.text(C3.eyebrow || 'Chapter three')}</p>
      <h2 class="display s3-title__h">
        <span class="s3-title__l1">${util.escapeHTML(l1)}</span>
        ${l2 ? `<span class="s3-title__l2"><span class="s3-title__l2t">${util.escapeHTML(l2)}</span>${ROSE_SVG}</span>` : ROSE_SVG}
      </h2>
    </div>
  </div>

  <div class="s3-beats" aria-live="polite">
    ${beats.map((b) => `<p class="s3-beat">${util.text(b)}</p>`).join('')}
  </div>

  <div class="s3-words">
    <p class="display s3-words__l1">${util.text(C3.arrival || 'These are for you.')}</p>
    <p class="script s3-words__l2">${util.text(C3.arrivalSub || 'Always for you.')}</p>
  </div>

  <div class="s3-bar s3-bar--top" aria-hidden="true"></div>
  <div class="s3-bar s3-bar--bot" aria-hidden="true"></div>
  <button class="s3-skip" type="button" aria-label="Skip this scene">Skip <span aria-hidden="true">›</span></button>
</div>`;
  }

  /* ===================================================================
     ART (generated per layout, in layer coordinates; deterministic)
     =================================================================== */
  function svgWrap(x0, w, h, body, cls) {
    return `<svg class="s3-svg${cls ? ' ' + cls : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="${n1(x0)} 0 ${n1(w)} ${n1(h)}" ` +
      `width="${n1(w)}" height="${n1(h)}" style="left:${n1(x0)}px" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  /** Smooth silhouette ridge closed to `bottom`. */
  function ridgePath(r, X0, X1, yMean, amp, bottom, opt) {
    const o = opt || {};
    const B = L.B;
    const f1 = 1 / (B * (0.9 + r() * 0.6)), f2 = 1 / (B * (0.3 + r() * 0.2)), f3 = 1 / (B * (0.1 + r() * 0.05));
    const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU;
    const step = Math.max(5, B * 0.01);
    const pts = [];
    for (let x = X0; x <= X1 + step; x += step) {
      let y = yMean - amp * (0.6 * Math.sin(x * f1 * TAU + p1) + 0.3 * Math.sin(x * f2 * TAU + p2) + 0.1 * Math.sin(x * f3 * TAU + p3));
      if (o.bumps) y -= o.bumps * Math.pow(Math.abs(Math.sin(x / o.bumpW + p3)), 0.55);
      if (o.dip) o.dip.forEach((dp) => { const k = Math.exp(-Math.pow((x - dp[0]) / dp[1], 2)); y += k * dp[2]; });
      pts.push([x, y]);
    }
    let d = `M${n1(X0)} ${n1(bottom)}`;
    pts.forEach((p) => { d += `L${n1(p[0])} ${n1(p[1])}`; });
    d += `L${n1(pts[pts.length - 1][0])} ${n1(bottom)}Z`;
    let top = '';
    pts.forEach((p, i) => { top += (i ? 'L' : 'M') + n1(p[0]) + ' ' + n1(p[1]); });
    return { d, top, pts };
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  /** A small rose head: darker outer petals, cupped centre, spiral, rim light. */
  function roseSVG(x, y, rad, color) {
    const dk = shade(color, -0.42), lt = shade(color, 0.35);
    if (rad < 2.6) {
      return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(rad)}" fill="${color}"/>`;
    }
    const sw = n1(Math.max(0.5, rad * 0.15));
    return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(rad)}" fill="${dk}"/>` +
      `<ellipse cx="${n1(x + rad * 0.04)}" cy="${n1(y - rad * 0.1)}" rx="${n1(rad * 0.84)}" ry="${n1(rad * 0.72)}" fill="${color}"/>` +
      `<path d="M${n1(x - rad * 0.48)} ${n1(y + rad * 0.08)}a${n1(rad * 0.46)} ${n1(rad * 0.4)} 0 1 1 ${n1(rad * 0.7)} ${n1(rad * 0.26)}" stroke="${dk}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>` +
      `<path d="M${n1(x - rad * 0.12)} ${n1(y - rad * 0.14)}a${n1(rad * 0.18)} ${n1(rad * 0.15)} 0 1 0 ${n1(rad * 0.3)} ${n1(rad * 0.06)}" stroke="${dk}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>` +
      `<path d="M${n1(x + rad * 0.1)} ${n1(y - rad * 0.86)}A${n1(rad * 0.86)} ${n1(rad * 0.86)} 0 0 1 ${n1(x + rad * 0.84)} ${n1(y - rad * 0.08)}" stroke="${lt}" stroke-width="${sw}" fill="none" stroke-linecap="round" opacity=".85"/>`;
  }
  const ROSE_COLORS = ['#b3123a', '#c8284f', '#e05a7a', '#f1a9b9', '#c8284f', '#fbe3e6', '#8e0f2c'];
  const LEAF_COLORS = ['#2a1c12', '#1f2414', '#2e1a16', '#1a1410', '#262a16'];

  /** A clump of foliage: dark mass + rotated leaf ellipses with warm rim light. */
  function leafClump(r, cx, cy, size, n, rim) {
    let s = `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(size * 0.42)}" ry="${n1(size * 0.3)}" fill="#1b0f0c"/>`;
    for (let i = 0; i < n * 3; i++) {
      const x = cx + (r() - 0.5) * size * 1.0, y = cy + (r() - 0.5) * size * 0.62;
      const lw = size * (0.09 + r() * 0.08), lh = lw * (0.42 + r() * 0.14), a = n1(r() * 180);
      if (rim && r() < 0.45) s += `<ellipse cx="${n1(x + 1.1)}" cy="${n1(y - 1)}" rx="${n1(lw)}" ry="${n1(lh)}" fill="${rim}" transform="rotate(${a} ${n1(x + 1.1)} ${n1(y - 1)})"/>`;
      s += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(lw)}" ry="${n1(lh)}" fill="${pick(r, LEAF_COLORS)}" transform="rotate(${a} ${n1(x)} ${n1(y)})"/>`;
    }
    return s;
  }

  /** Organic closed outline (tree canopy) around (cx, cy). */
  function blobPts(r, cx, cy, rx, ry, lobes) {
    const n = 30, ph = r() * TAU, ph2 = r() * TAU, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + 0.08 * Math.sin(a * lobes + ph) + 0.045 * Math.sin(a * (lobes * 2 + 1) + ph2) + (r() - 0.5) * 0.07;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }
  /** Italian cypress outline: soft base, widest low, tapering to a tip. */
  function cypressPts(r, x, base, h, w) {
    const n = 16, L1 = [], R1 = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const wid = w * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.75) * (1 - t * 0.25);
      const y = base - h * t;
      L1.push([x - wid * (1 + (r() - 0.5) * 0.22), y]);
      R1.push([x + wid * (1 + (r() - 0.5) * 0.22), y]);
    }
    return L1.concat(R1.reverse());
  }
  const ptsPath = (pts, dx, dy) => 'M' + pts.map((p) => n1(p[0] + (dx || 0)) + ' ' + n1(p[1] + (dy || 0))).join('L') + 'Z';

  function tulipSVG(r, x, base, h, w, color) {
    const lean = (r() - 0.35) * w * 1.6;
    const hx = x + lean, hy = base - h;
    const side = r() < 0.5 ? -1 : 1;
    const cw = w, ch = w * 1.5;
    return `<path d="M${n1(x)} ${n1(base)}q${n1(side * w * 1.7)} ${n1(-h * 0.36)} ${n1(side * w * 0.7)} ${n1(-h * 0.66)}q${n1(-side * w * 0.15)} ${n1(h * 0.32)} ${n1(-side * w * 0.7)} ${n1(h * 0.66)}z" fill="#232c17"/>` +
      `<path d="M${n1(x)} ${n1(base)}Q${n1(x + lean * 0.15)} ${n1(base - h * 0.5)} ${n1(hx)} ${n1(hy)}" stroke="#2c3519" stroke-width="${n1(Math.max(1, w * 0.26))}" fill="none" stroke-linecap="round"/>` +
      `<path d="M${n1(hx - cw)} ${n1(hy)}C${n1(hx - cw)} ${n1(hy - ch)} ${n1(hx - cw * 0.35)} ${n1(hy - ch * 1.15)} ${n1(hx)} ${n1(hy - ch * 0.8)}C${n1(hx + cw * 0.35)} ${n1(hy - ch * 1.15)} ${n1(hx + cw)} ${n1(hy - ch)} ${n1(hx + cw)} ${n1(hy)}C${n1(hx + cw)} ${n1(hy + ch * 0.45)} ${n1(hx - cw)} ${n1(hy + ch * 0.45)} ${n1(hx - cw)} ${n1(hy)}Z" fill="${color}"/>` +
      `<path d="M${n1(hx + cw * 0.2)} ${n1(hy - ch * 0.72)}C${n1(hx + cw * 0.75)} ${n1(hy - ch * 0.66)} ${n1(hx + cw * 0.85)} ${n1(hy)} ${n1(hx + cw * 0.3)} ${n1(hy + ch * 0.26)}" stroke="rgba(255,236,214,.6)" stroke-width="${n1(Math.max(0.8, cw * 0.2))}" fill="none" stroke-linecap="round"/>`;
  }

  /** Ranges (in layer coords) kept free of tall trees so the sun shows. */
  function sunClearings(p) {
    const out = [];
    [[L.xMid, L.z2], [L.xB, L.zWide * 1.035]].forEach(([cx, z]) => {
      const zs = 1 + (z - 1) * P_SUN, zp = 1 + (z - 1) * p;
      const sx = L.W / 2 + (L.sunX - cx * P_SUN) * zs;          // sun on screen
      const X = (sx - L.W / 2) / zp + cx * p;                     // that screen x in layer p
      out.push([X - L.sunD * 0.42 / zp, X + L.sunD * 0.42 / zp]);
    });
    return out;
  }
  const inRanges = (x, rs) => rs.some((q) => x > q[0] && x < q[1]);

  function artClouds(X0, X1) {
    const r = rng(11), { B, bar, hz, H, W } = L;
    let s = '<defs>' +
      '<linearGradient id="s3c-hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a1230" stop-opacity=".5"/><stop offset=".55" stop-color="#a8405f" stop-opacity=".62"/><stop offset="1" stop-color="#ffb38f" stop-opacity=".85"/></linearGradient>' +
      '<linearGradient id="s3c-lo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b24a66" stop-opacity=".55"/><stop offset=".6" stop-color="#f08a7a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd9a6" stop-opacity=".95"/></linearGradient>' +
      `<filter id="s3c-b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="${n1(Math.max(1, B * 0.0035))}"/></filter>` +
      '</defs><g filter="url(#s3c-b)">';
    const n = Math.max(4, Math.ceil((X1 - X0) / (W * 0.3)));
    const top = bar + B * 0.05, low = hz - B * 0.15;
    for (let i = 0; i < n; i++) {
      const cx = X0 + (i + 0.15 + r() * 0.7) * (X1 - X0) / n;
      const yN = r();
      const cy = top + yN * (low - top);
      const len = B * (0.22 + r() * 0.5) * (L.portrait ? 1 : 1.35);
      const th = B * (0.008 + r() * 0.016);
      const g = yN > 0.55 ? 's3c-lo' : 's3c-hi';
      const k = 3 + Math.floor(r() * 4);
      for (let j = 0; j < k; j++) {
        s += `<ellipse cx="${n1(cx + (r() - 0.5) * len * 0.9)}" cy="${n1(cy + (r() - 0.5) * th * 2.4)}" rx="${n1(len * (0.18 + r() * 0.32))}" ry="${n1(th * (0.55 + r() * 0.8))}" fill="url(#${g})"/>`;
      }
    }
    s += '</g>';
    return svgWrap(X0, X1 - X0, H * 1.2, s);
  }

  function artHills(key, X0, X1) {
    const { B, hz, H } = L;
    const bottom = H * 2.4;
    let s = '';
    if (key === 'hills1') {
      const r = rng(21);
      const g = ridgePath(r, X0, X1, hz - B * 0.06, B * 0.075, bottom);
      s += `<defs><linearGradient id="s3h1" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(hz - B * 0.15)}" x2="0" y2="${n1(hz + B * 0.05)}">` +
        '<stop offset="0" stop-color="#a5476a"/><stop offset=".6" stop-color="#df7f80"/><stop offset="1" stop-color="#ffc39b"/></linearGradient></defs>' +
        `<path d="${g.d}" fill="url(#s3h1)" opacity=".92"/>`;
    } else if (key === 'hills2') {
      const r = rng(22);
      const g = ridgePath(r, X0, X1, hz - B * 0.008, B * 0.05, bottom);
      s += `<defs><linearGradient id="s3h2" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(hz - B * 0.08)}" x2="0" y2="${n1(hz + B * 0.08)}">` +
        '<stop offset="0" stop-color="#712647"/><stop offset="1" stop-color="#c0636f"/></linearGradient>' +
        `<linearGradient id="s3h2haze" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(hz - B * 0.06)}" x2="0" y2="${n1(hz + B * 0.14)}">` +
        '<stop offset="0" stop-color="#ffb890" stop-opacity="0"/><stop offset=".55" stop-color="#ffbf95" stop-opacity=".42"/><stop offset="1" stop-color="#ffbf95" stop-opacity="0"/></linearGradient></defs>' +
        `<path d="${g.d}" fill="url(#s3h2)"/>` +
        `<rect x="${n1(X0)}" y="${n1(hz - B * 0.06)}" width="${n1(X1 - X0)}" height="${n1(B * 0.2)}" fill="url(#s3h2haze)"/>`;
    } else {
      const r = rng(23);
      const g = ridgePath(r, X0, X1, hz + B * 0.045, B * 0.022, bottom, { bumps: B * 0.018, bumpW: B * 0.012 });
      s += `<defs><linearGradient id="s3h3" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(hz)}" x2="0" y2="${n1(hz + B * 0.14)}">` +
        '<stop offset="0" stop-color="#4b1531"/><stop offset="1" stop-color="#2a0a1c"/></linearGradient></defs>' +
        `<path d="${g.d}" fill="url(#s3h3)"/>` +
        `<path d="${g.top}" stroke="#ff9e80" stroke-opacity=".26" stroke-width="1.1" fill="none"/>`;
    }
    return svgWrap(X0, X1 - X0, bottom, s);
  }

  function artTrees(X0, X1) {
    const r = rng(31), { U, B, hz, H } = L;
    const base = hz + B * 0.1, bottom = H * 2.4;
    const clear = sunClearings(0.64);
    let s = '<defs>' +
      `<linearGradient id="s3t-g" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(base - B * 0.03)}" x2="0" y2="${n1(base + B * 0.3)}"><stop offset="0" stop-color="#2c0c18"/><stop offset="1" stop-color="#14040b"/></linearGradient>` +
      '<linearGradient id="s3t-f" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#57203a"/><stop offset=".5" stop-color="#3a1228"/><stop offset="1" stop-color="#26091a"/></linearGradient>' +
      '<linearGradient id="s3t-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e2a45"/><stop offset="1" stop-color="#4a1731"/></linearGradient>' +
      '</defs>';
    const rim = 'rgba(255,164,122,.5)';
    // far, hazier row first (depth inside the layer)
    let far = '';
    for (let x = X0; x < X1;) {
      x += U * (0.14 + r() * 0.3);
      const small = inRanges(x, clear);
      const h = U * (0.35 + r() * 0.4) * (small ? 0.45 : 1);
      if (r() < 0.45) far += `<path d="${ptsPath(cypressPts(r, x, base - B * 0.012, h * 1.25, h * 0.11))}" fill="url(#s3t-far)"/>`;
      else far += `<path d="${ptsPath(blobPts(r, x, base - B * 0.012 - h * 0.45, h * 0.32, h * 0.42, 5))}" fill="url(#s3t-far)"/>`;
    }
    // near row with rim light on the sun side
    let trees = '';
    let x = X0;
    while (x < X1) {
      x += U * (0.28 + r() * 0.6);
      if (r() < 0.14) { x += U * 0.7; continue; }
      const tall = !inRanges(x, clear);
      const cyp = r() < 0.45;
      let h = U * (cyp ? 0.85 + r() * 0.6 : 0.6 + r() * 0.45);
      if (!tall) h *= 0.38;
      if (cyp) {
        const pts = cypressPts(r, x, base, h, h * (0.1 + r() * 0.035));
        trees += `<path d="${ptsPath(pts, 1.5, -1.1)}" fill="${rim}"/><path d="${ptsPath(pts)}" fill="url(#s3t-f)"/>`;
      } else {
        const cw = h * (0.46 + r() * 0.22);
        const tw = Math.max(1.5, h * 0.03);
        trees += `<path d="M${n1(x - tw)} ${n1(base)}L${n1(x - tw * 0.45)} ${n1(base - h * 0.5)}L${n1(x + tw * 0.45)} ${n1(base - h * 0.5)}L${n1(x + tw)} ${n1(base)}Z" fill="#26091a"/>`;
        const cy0 = base - h * 0.66;
        const blobs = [blobPts(r, x, cy0, cw * 0.5, h * 0.3, 6)];
        if (r() < 0.75) blobs.push(blobPts(r, x + (r() - 0.5) * cw * 0.5, base - h * (0.5 + r() * 0.1), cw * 0.36, h * 0.2, 5));
        trees += blobs.map((b) => `<path d="${ptsPath(b, 1.5, -1.2)}" fill="${rim}"/>`).join('') +
          blobs.map((b) => `<path d="${ptsPath(b)}" fill="url(#s3t-f)"/>`).join('');
        // sunlit foliage clusters on the sun side give the canopy volume
        for (let i = 0; i < 4; i++) {
          const a = -0.9 + r() * 1.3;
          const lx = x + Math.cos(a) * cw * 0.3, ly = cy0 + Math.sin(a) * h * 0.18;
          trees += `<path d="${ptsPath(blobPts(r, lx, ly, cw * (0.1 + r() * 0.08), h * (0.06 + r() * 0.05), 4))}" fill="rgba(150,62,74,.32)"/>`;
        }
      }
    }
    s += far + `<rect x="${n1(X0)}" y="${n1(base - B * 0.016)}" width="${n1(X1 - X0)}" height="${n1(B * 0.02)}" fill="#3a1226" opacity=".7"/>` +
      trees + `<rect x="${n1(X0)}" y="${n1(base - B * 0.008)}" width="${n1(X1 - X0)}" height="${n1(bottom)}" fill="url(#s3t-g)"/>`;
    return svgWrap(X0, X1 - X0, bottom, s);
  }

  function artHedge(X0, X1) {
    const r = rng(41), { U, H, groundY } = L;
    const base = groundY - 0.1 * U, bottom = H * 2.4;
    const g = ridgePath(r, X0, X1, base - 0.3 * U, 0.06 * U, bottom, { bumps: 0.06 * U, bumpW: 0.14 * U });
    let s = '<defs>' +
      `<linearGradient id="s3hd" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(base - 0.45 * U)}" x2="0" y2="${n1(base + 0.1 * U)}"><stop offset="0" stop-color="#3a1a1a"/><stop offset="1" stop-color="#1a080b"/></linearGradient>` +
      '</defs>' +
      `<path d="${g.d}" fill="url(#s3hd)"/>` +
      `<path d="${g.top}" stroke="#f3a37c" stroke-opacity=".3" stroke-width="1.2" fill="none"/>`;
    // roses peeking from the hedge
    for (let i = 0; i < g.pts.length; i += 2) {
      if (r() > 0.42) continue;
      const p = g.pts[i];
      const y = p[1] + 0.03 * U + r() * 0.2 * U;
      s += roseSVG(p[0] + (r() - 0.5) * 6, y, U * (0.016 + r() * 0.012), pick(r, ROSE_COLORS));
    }
    s += `<rect x="${n1(X0)}" y="${n1(base - 0.02 * U)}" width="${n1(X1 - X0)}" height="${n1(bottom)}" fill="#1b070d"/>`;
    return svgWrap(X0, X1 - X0, bottom, s);
  }

  function artArch(r) {
    const { U, groundY: g, xArch: cx } = L;
    const hw = 0.66 * U, postTop = g - 0.95 * U, base = g + 0.02 * U;
    const sw = Math.max(2, 0.028 * U);
    const frame = `M${n1(cx - hw)} ${n1(base)}L${n1(cx - hw)} ${n1(postTop)}A${n1(hw)} ${n1(hw)} 0 0 1 ${n1(cx + hw)} ${n1(postTop)}L${n1(cx + hw)} ${n1(base)}`;
    const inner = `M${n1(cx - hw + sw * 2.2)} ${n1(base)}L${n1(cx - hw + sw * 2.2)} ${n1(postTop)}A${n1(hw - sw * 2.2)} ${n1(hw - sw * 2.2)} 0 0 1 ${n1(cx + hw - sw * 2.2)} ${n1(postTop)}L${n1(cx + hw - sw * 2.2)} ${n1(base)}`;
    let s = `<path d="${frame}" stroke="#ffb27c" stroke-opacity=".45" stroke-width="${n1(sw)}" fill="none" transform="translate(1.4 -0.8)"/>` +
      `<path d="${frame}" stroke="#2a0f12" stroke-width="${n1(sw)}" fill="none"/>` +
      `<path d="${inner}" stroke="#2a0f12" stroke-width="${n1(sw * 0.5)}" fill="none"/>`;
    // lattice rungs on the posts
    for (let y = base - 0.08 * U; y > postTop; y -= 0.11 * U) {
      [-1, 1].forEach((sd) => { s += `<path d="M${n1(cx + sd * hw)} ${n1(y)}L${n1(cx + sd * (hw - sw * 2.2))} ${n1(y - 0.04 * U)}" stroke="#2a0f12" stroke-width="${n1(sw * 0.4)}"/>`; });
    }
    // sample points along posts + arc for foliage
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.035) {
      const a = Math.PI * (1 - t);
      pts.push([cx + hw * Math.cos(a), postTop - hw * Math.sin(a), 1]);
    }
    for (let y = postTop; y < base - 0.12 * U; y += 0.06 * U) {
      const k = 1 - (y - postTop) / (base - postTop);
      if (r() < 0.25 + k * 0.7) pts.push([cx - hw, y, k]);
      if (r() < 0.25 + k * 0.7) pts.push([cx + hw, y, k]);
    }
    let leaves = '', roses = '';
    pts.forEach((p) => {
      leaves += leafClump(r, p[0], p[1], U * 0.16 * (0.6 + p[2] * 0.5), 3, 'rgba(255,170,120,.28)');
      if (r() < 0.55) roses += roseSVG(p[0] + (r() - 0.5) * U * 0.1, p[1] + (r() - 0.5) * U * 0.08, U * (0.022 + r() * 0.016), pick(r, ROSE_COLORS));
    });
    // a few hanging tendrils inside the arch
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.18 + r() * 0.64);
      const x = cx + hw * 0.92 * Math.cos(a), y = postTop - hw * 0.92 * Math.sin(a);
      const len = U * (0.08 + r() * 0.16);
      leaves += `<path d="M${n1(x)} ${n1(y)}q${n1((r() - 0.5) * 6)} ${n1(len * 0.5)} ${n1((r() - 0.5) * 4)} ${n1(len)}" stroke="#2b1712" stroke-width="${n1(Math.max(1, U * 0.006))}" fill="none"/>`;
      leaves += `<circle cx="${n1(x)}" cy="${n1(y + len)}" r="${n1(U * 0.012)}" fill="#331c14"/>`;
    }
    // string lights draped across the arch
    const lx0 = cx - hw * 0.86, lx1 = cx + hw * 0.86, ly = postTop - hw * 0.42, sag = 0.16 * U;
    let lights = `<path d="M${n1(lx0)} ${n1(ly)}Q${n1(cx)} ${n1(ly + sag * 2)} ${n1(lx1)} ${n1(ly)}" stroke="#3a1a10" stroke-width="${n1(Math.max(0.7, U * 0.004))}" fill="none"/>`;
    const nB = 11;
    for (let i = 0; i <= nB; i++) {
      const t = i / nB;
      const x = (1 - t) * (1 - t) * lx0 + 2 * (1 - t) * t * cx + t * t * lx1;
      const y = (1 - t) * (1 - t) * ly + 2 * (1 - t) * t * (ly + sag * 2) + t * t * ly;
      lights += `<circle cx="${n1(x)}" cy="${n1(y + U * 0.012)}" r="${n1(U * 0.06)}" fill="url(#s3g-bulb)"/><circle cx="${n1(x)}" cy="${n1(y + U * 0.012)}" r="${n1(Math.max(1, U * 0.009))}" fill="#fff4d6"/>`;
    }
    // little lantern hanging on the right
    const la = Math.PI * 0.3, lxx = cx + hw * Math.cos(la), lyy = postTop - hw * Math.sin(la);
    const lw = U * 0.045, lh = U * 0.07, drop = U * 0.14;
    lights += `<path d="M${n1(lxx)} ${n1(lyy)}L${n1(lxx)} ${n1(lyy + drop)}" stroke="#2a0f12" stroke-width="1"/>` +
      `<circle cx="${n1(lxx)}" cy="${n1(lyy + drop + lh * 0.55)}" r="${n1(U * 0.22)}" fill="url(#s3g-bulb)" opacity=".8"/>` +
      `<path d="M${n1(lxx - lw * 0.7)} ${n1(lyy + drop + lh * 0.12)}L${n1(lxx)} ${n1(lyy + drop - lh * 0.1)}L${n1(lxx + lw * 0.7)} ${n1(lyy + drop + lh * 0.12)}Z" fill="#2a0f12"/>` +
      `<rect x="${n1(lxx - lw / 2)}" y="${n1(lyy + drop + lh * 0.12)}" width="${n1(lw)}" height="${n1(lh)}" rx="${n1(lw * 0.15)}" fill="#ffcf8a" stroke="#2a0f12" stroke-width="${n1(Math.max(1, lw * 0.12))}"/>`;
    return s + leaves + roses + lights;
  }

  function artGround(X0, X1) {
    const r = rng(51), { U, H, groundY: g, xArch, D } = L;
    const bottom = H * 2.4;
    let s = '<defs>' +
      `<linearGradient id="s3g-lawn" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(g - 0.16 * U)}" x2="0" y2="${n1(g + 0.9 * U)}"><stop offset="0" stop-color="#2e0f17"/><stop offset=".35" stop-color="#22090f"/><stop offset="1" stop-color="#0f0306"/></linearGradient>` +
      `<linearGradient id="s3g-path" gradientUnits="userSpaceOnUse" x1="${n1(Math.min(0, X0 + U))}" y1="0" x2="${n1(xArch + 0.4 * U)}" y2="0"><stop offset="0" stop-color="#3f1d24"/><stop offset=".55" stop-color="#7a4140"/><stop offset=".9" stop-color="#cf8b67"/><stop offset="1" stop-color="#f4bd8a"/></linearGradient>` +
      `<linearGradient id="s3g-pathv" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(g - 0.05 * U)}" x2="0" y2="${n1(g + 0.09 * U)}"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset="1" stop-color="#140308" stop-opacity=".45"/></linearGradient>` +
      '<radialGradient id="s3g-bulb"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".85"/><stop offset=".35" stop-color="#ffc277" stop-opacity=".3"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    s += `<rect x="${n1(X0)}" y="${n1(g - 0.16 * U)}" width="${n1(X1 - X0)}" height="${n1(bottom)}" fill="url(#s3g-lawn)"/>`;
    // distant flower dots in the lawn strip behind the path
    for (let x = X0; x < X1; x += U * 0.05) {
      if (r() < 0.45) s += `<circle cx="${n1(x + r() * U * 0.05)}" cy="${n1(g - 0.14 * U + r() * 0.07 * U)}" r="${n1(U * (0.006 + r() * 0.007))}" fill="${pick(r, ['#e05a7a', '#f1a9b9', '#c8284f', '#ffd7a8', '#fbe3e6'])}" opacity=".85"/>`;
    }
    // rose bushes along the back edge of the path
    let x = X0;
    while (x < X1) {
      x += U * (0.55 + r() * 0.8);
      if (Math.abs(x - xArch) < 0.95 * U) continue;
      const sz = U * (0.22 + r() * 0.12), cy = g - 0.12 * U;
      s += leafClump(r, x, cy, sz, 6, 'rgba(255,165,120,.3)');
      const k = 3 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) s += roseSVG(x + (r() - 0.5) * sz, cy + (r() - 0.6) * sz * 0.5, U * (0.024 + r() * 0.014), pick(r, ROSE_COLORS));
    }
    // lantern posts along the path
    for (let px = 0.9 * U; px < D - 1.0 * U; px += 2.3 * U) {
      const top = g - 1.0 * U;
      s += `<circle cx="${n1(px)}" cy="${n1(top + 0.04 * U)}" r="${n1(U * 0.3)}" fill="url(#s3g-bulb)" opacity=".7"/>` +
        `<rect x="${n1(px - 0.011 * U)}" y="${n1(top + 0.08 * U)}" width="${n1(0.022 * U)}" height="${n1(0.86 * U)}" fill="#1c090c"/>` +
        `<path d="M${n1(px - 0.05 * U)} ${n1(top)}L${n1(px)} ${n1(top - 0.035 * U)}L${n1(px + 0.05 * U)} ${n1(top)}Z" fill="#1c090c"/>` +
        `<rect x="${n1(px - 0.035 * U)}" y="${n1(top)}" width="${n1(0.07 * U)}" height="${n1(0.085 * U)}" rx="2" fill="#ffd796" stroke="#1c090c" stroke-width="${n1(Math.max(1, 0.008 * U))}"/>`;
    }
    // the garden path
    const pTop = [], pBot = [];
    for (let px = X0; px <= X1 + 20; px += 20) {
      pTop.push(`${n1(px)} ${n1(g - 0.05 * U + Math.sin(px / (U * 0.9)) * 0.006 * U)}`);
      pBot.push(`${n1(px)} ${n1(g + 0.085 * U + Math.sin(px / (U * 0.7) + 1) * 0.008 * U)}`);
    }
    const pathD = 'M' + pTop.join('L') + 'L' + pBot.reverse().join('L') + 'Z';
    s += `<path d="${pathD}" fill="url(#s3g-path)"/><path d="${pathD}" fill="url(#s3g-pathv)"/>`;
    s += `<path d="M${pTop.join('L')}" stroke="#ffd2a2" stroke-opacity=".38" stroke-width="1" fill="none"/>`;
    for (let i = 0; i < (X1 - X0) / (U * 0.12); i++) {
      s += `<ellipse cx="${n1(X0 + r() * (X1 - X0))}" cy="${n1(g - 0.02 * U + r() * 0.09 * U)}" rx="${n1(U * (0.02 + r() * 0.03))}" ry="${n1(U * (0.005 + r() * 0.006))}" fill="rgba(255,226,196,.07)"/>`;
    }
    // fallen petals leading to the arch
    for (let i = 0; i < 26; i++) {
      const px = xArch - 1.6 * U + r() * 2.3 * U, py = g - 0.03 * U + r() * 0.1 * U;
      s += `<ellipse cx="${n1(px)}" cy="${n1(py)}" rx="${n1(U * 0.014)}" ry="${n1(U * 0.007)}" fill="${pick(r, ['#c8284f', '#e05a7a', '#b3123a', '#f1a9b9'])}" transform="rotate(${n1(r() * 180)} ${n1(px)} ${n1(py)})"/>`;
    }
    // grass texture in the near lawn
    let grass = '';
    for (let gx = X0; gx < X1; gx += U * 0.022) {
      const gy = g + 0.1 * U + r() * 0.75 * U, gh = U * (0.02 + r() * 0.035), gl = (r() - 0.4) * gh * 0.6;
      grass += `M${n1(gx)} ${n1(gy)}q${n1(gl * 0.3)} ${n1(-gh * 0.5)} ${n1(gl)} ${n1(-gh)}`;
    }
    s += `<path d="${grass}" stroke="#4a1f22" stroke-opacity=".45" stroke-width="${n1(Math.max(0.7, U * 0.004))}" fill="none" stroke-linecap="round"/>`;
    // front flower bed: rose bushes + baby's breath along the path's front edge
    for (let bx = X0; bx < X1;) {
      bx += U * (0.3 + r() * 0.5);
      const cy = g + U * (0.17 + r() * 0.2), sz = U * (0.2 + r() * 0.16);
      s += leafClump(r, bx, cy, sz, 5, 'rgba(255,160,120,.22)');
      const k = 2 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) s += roseSVG(bx + (r() - 0.5) * sz * 0.9, cy - sz * 0.18 + (r() - 0.5) * sz * 0.34, U * (0.026 + r() * 0.016), pick(r, ROSE_COLORS));
    }
    let dots = '';
    for (let i = 0; i < (X1 - X0) / (U * 0.03); i++) {
      dots += `<circle cx="${n1(X0 + r() * (X1 - X0))}" cy="${n1(g + 0.1 * U + r() * 0.32 * U)}" r="${n1(U * (0.004 + r() * 0.004))}"/>`;
    }
    s += `<g fill="#fff2e6" opacity=".55">${dots}</g>`;
    s += artArch(r);
    return svgWrap(X0, X1 - X0, bottom, s);
  }

  /** Tulip strips in front of the path (each strip sways on its own). */
  function artFront(X0, X1) {
    const r = rng(61), { U, groundY: g, W } = L;
    const sw = Math.max(W * 0.5, U * 2);
    const top = g + 0.0 * U, hgt = 0.62 * U;
    const out = [];
    for (let sx = X0; sx < X1; sx += sw) {
      let s = '';
      for (let x = 0.04 * U; x < sw; x += U * (0.04 + r() * 0.09)) {
        if (r() < 0.12) { x += U * 0.2; continue; }
        const base = 0.24 * U + r() * 0.3 * U;            // local y (from `top`)
        const maxH = base - 0.075 * U;
        const h = Math.min(maxH, U * (0.12 + r() * 0.14));
        s += tulipSVG(r, x, base, h, U * (0.018 + r() * 0.009), pick(r, ['#e05a7a', '#f1a9b9', '#c8284f', '#ffd7b0', '#f6c3cf', '#b3123a']));
      }
      out.push(`<div class="s3-sway" style="left:${n1(sx)}px;top:${n1(top)}px;width:${n1(sw)}px;height:${n1(hgt)}px">` +
        `<svg viewBox="0 0 ${n1(sw)} ${n1(hgt)}" width="${n1(sw)}" height="${n1(hgt)}" aria-hidden="true" focusable="false">${s}</svg></div>`);
    }
    return out.join('');
  }

  /** Out-of-focus foreground clumps (big, dark, blurred) — sway individually. */
  function artFg(X0, X1) {
    const r = rng(71), { W, H, B } = L;
    const out = [];
    let x = X0 + W * 0.2;
    let side = 0;
    while (x < X1) {
      const cw = W * (0.28 + r() * 0.3);
      const hTop = B * (0.16 + r() * 0.16);
      const hh = hTop + H * 0.9;
      const blur = Math.max(2.5, W * 0.006 + B * 0.004);
      let s = `<defs><filter id="s3fg-${side}" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="${n1(blur)}"/></filter></defs><g filter="url(#s3fg-${side})">`;
      const nb = 12 + Math.floor(r() * 10);
      for (let i = 0; i < nb; i++) {
        const bx = cw * (0.1 + r() * 0.8), bw = cw * (0.025 + r() * 0.03), th = hTop * (0.45 + r() * 0.6);
        const lean = (r() - 0.5) * cw * 0.25;
        s += `<path d="M${n1(bx - bw)} ${n1(hh)}Q${n1(bx + lean * 0.3)} ${n1(hh - th)} ${n1(bx + lean)} ${n1(hTop - th + hTop * 0.05 + (hh - hTop) * 0)}Q${n1(bx + lean * 0.5 + bw)} ${n1(hh - th * 0.6)} ${n1(bx + bw)} ${n1(hh)}Z" fill="${pick(r, ['#0e0306', '#160509', '#1d070c'])}"/>`;
      }
      if (r() < 0.7) {
        const k = 1 + Math.floor(r() * 2);
        for (let i = 0; i < k; i++) {
          const fx0 = cw * (0.25 + r() * 0.5), fy = hTop * (0.1 + r() * 0.5), fr = B * (0.02 + r() * 0.025);
          s += `<path d="M${n1(fx0)} ${n1(hh)}L${n1(fx0)} ${n1(fy)}" stroke="#12040a" stroke-width="${n1(fr * 0.25)}"/>` +
            `<circle cx="${n1(fx0)}" cy="${n1(fy)}" r="${n1(fr)}" fill="${pick(r, ['#5e0c20', '#7a1129', '#8e1a36'])}"/>` +
            `<circle cx="${n1(fx0 + fr * 0.3)}" cy="${n1(fy - fr * 0.3)}" r="${n1(fr * 0.45)}" fill="rgba(255,150,150,.25)"/>`;
        }
      }
      s += '</g>';
      out.push(`<div class="s3-fgclump" style="left:${n1(x - cw / 2)}px;top:${n1(H - hTop)}px;width:${n1(cw)}px;height:${n1(hh)}px">` +
        `<svg viewBox="0 0 ${n1(cw)} ${n1(hh)}" width="${n1(cw)}" height="${n1(hh)}" aria-hidden="true" focusable="false">${s}</svg></div>`);
      x += W * (0.55 + r() * 0.6);
      side++;
    }
    return out.join('');
  }

  /* ===================================================================
     SOFT LIGHT (painted once into small canvases, GPU-scaled: cheap on
     high-DPR phones compared with huge CSS gradient layers)
     =================================================================== */
  function paintSun(disc) {
    const px = 256, c = R.sun, g = c.getContext('2d');
    c.width = c.height = px;
    const rad = px * 0.7071;
    const grd = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, rad);
    const st = (f, col) => grd.addColorStop(Math.min(1, f), col);
    st(0, '#fffdf6'); st(disc * 0.22, '#fff4d8'); st(disc * 0.36, '#ffe1a2');
    st(disc * 0.44, 'rgba(255,196,128,0.85)'); st(disc * 0.56, 'rgba(255,170,120,0.42)');
    st(disc * 1.05, 'rgba(255,150,120,0.16)'); st(0.5, 'rgba(255,140,120,0)'); st(1, 'rgba(255,140,120,0)');
    g.clearRect(0, 0, px, px);
    g.fillStyle = grd;
    g.fillRect(0, 0, px, px);
  }
  function paintRays() {
    const px = 512, c = R.rays, g = c.getContext('2d');
    c.width = c.height = px;
    const cx = px / 2, len = px * 0.75, D2R = Math.PI / 180;
    const wedge = (deg, half, a) => {
      [[1.9, 0.35], [1.35, 0.6], [1, 1]].forEach(([k, m]) => {
        const h = half * k * D2R, a0 = deg * D2R;
        g.fillStyle = `rgba(255,222,176,${(a * m * 0.5).toFixed(3)})`;
        g.beginPath(); g.moveTo(cx, cx);
        g.lineTo(cx + Math.cos(a0 - h) * len, cx + Math.sin(a0 - h) * len);
        g.lineTo(cx + Math.cos(a0 + h) * len, cx + Math.sin(a0 + h) * len);
        g.closePath(); g.fill();
      });
    };
    g.clearRect(0, 0, px, px);
    for (let k = 0; k < 360; k += 27) { wedge(k + 8, 1.1, 0.42); wedge(k + 18.75, 0.75, 0.24); }
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(cx, cx, 0, cx, cx, px * 0.7071);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.14, 'rgba(0,0,0,0.7)');
    m.addColorStop(0.32, 'rgba(0,0,0,0.25)'); m.addColorStop(0.52, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, px, px);
    g.globalCompositeOperation = 'source-over';
  }
  function paintFlare() {
    const px = 256, c = R.flareCore, g = c.getContext('2d');
    c.width = c.height = px;
    const grd = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    grd.addColorStop(0, 'rgba(255,240,214,0.5)'); grd.addColorStop(0.4, 'rgba(255,196,150,0.16)'); grd.addColorStop(1, 'rgba(255,160,140,0)');
    g.clearRect(0, 0, px, px); g.fillStyle = grd; g.fillRect(0, 0, px, px);
  }

  /* ===================================================================
     LAYOUT (enter + resize)
     =================================================================== */
  function layout() {
    const W = Math.max(280, root.clientWidth || window.innerWidth);
    const H = Math.max(280, root.clientHeight || window.innerHeight);
    const portrait = H >= W;
    const rm = Love.reducedMotion;
    const bar = portrait ? Math.round(H * 0.052) : Math.round(util.clamp((H - W / 2.39) / 2, H * 0.045, H * 0.13));
    const B = H - bar * 2;
    const U = B * (portrait ? 0.27 : 0.36);
    const groundY = bar + B * (portrait ? 0.79 : 0.8);
    const hz = bar + B * (portrait ? 0.6 : 0.55);
    const Ay = groundY - U * 0.5;

    // he stands at x = 0 (his box centre) and walks a whole number of steps: the
    // arrival mark D in front of her is where the stop sequence settles (≈5.7 U)
    const sp = U / WK.boxH;                                   // layer px per sprite px
    const D = WK.total * sp;
    const gap = 0.43 * U, xHer = D + gap, xArch = xHer - 0.25 * U, xMid = D + gap / 2;

    const zWide = rm ? 0.86 : (portrait ? 0.74 : 0.7);
    const zStart = rm ? 0.9 : (portrait ? 0.82 : 0.78);
    const zVert = Math.min((Ay - bar - 0.025 * B) / (1.12 * U), (H - bar - 0.03 * B - Ay) / (0.5 * U));
    const z2 = Math.min(1.3, (W * 0.94) / (1.36 * U), zVert);
    const z3 = rm ? z2 : Math.min(z2 * 1.12, (W * 0.96) / (gap + 0.62 * U), zVert);
    const xB = xHer - 0.16 * W / zWide;
    const xA = xB - Math.min(0.85 * W / zWide, 0.65 * D) * (rm ? 0.35 : 1);
    const xS = 0.1 * W / zStart;
    const zps2 = 1 + (z2 - 1) * P_SUN;
    const sunX = xMid * P_SUN + (portrait ? 0.07 : 0.06) * W / zps2;

    L = {
      W, H, portrait, bar, B, U, groundY, hz, Ay, D, sp,
      gap, xHer, xArch, xMid, zWide, zStart, z2, z3, xA, xB, xS,
      crane: rm ? 0 : B * (portrait ? 0.1 : 0.08),
      sunX, sunY: hz - 0.035 * B, sunD: B * (portrait ? 0.2 : 0.22),
      wHim: U * 255 / 604,
    };

    root.dataset.orient = portrait ? 'portrait' : 'landscape';
    const st = root.style;
    st.setProperty('--s3-bar', bar + 'px');
    st.setProperty('--s3-band', B + 'px');
    st.setProperty('--s3-u', U + 'px');
    // Skip lives in the bottom letterbox, centred, shrunk to fit it (≥ 26 px tall;
    // its hit area stays larger, see CSS): in the picture it would cover the
    // lower-third beats and "Always for you." on real phone-browser heights.
    // Only a thin landscape bar (phone landscape, ~18 px) puts it in the picture,
    // just above the bar, where the words sit at the right-hand side instead.
    const skipInBar = portrait || bar >= 32;
    const skipH = skipInBar ? util.clamp(bar - 6, 26, 44) : 44;
    st.setProperty('--s3-skip-h', skipH.toFixed(1) + 'px');
    st.setProperty('--s3-skip-b', (skipInBar ? (bar - skipH) / 2 : bar + 8).toFixed(1) + 'px');
    st.setProperty('--s3-skip-fs', skipH < 40 ? '10px' : '0.68rem');
    st.setProperty('--s3-skip-px', skipH < 40 ? '12px' : '16px');

    /* ---- layer extents & art ---- */
    const cxMin = Math.min(xA, xS) - 20, cxMax = Math.max(xB, xMid, D + 0.1 * W) + 20;
    const zMin = Math.min(zWide, zStart);
    const extent = (p) => {
      const zp = 1 + (zMin - 1) * p;
      const half = W / 2 / zp;
      return [cxMin * p - half - W * 0.12 - 40, cxMax * p + half + W * 0.12 + 40];
    };
    layers.forEach((ly) => {
      const [X0, X1] = extent(ly.p);
      ly.last = '';
      switch (ly.k) {
        case 'clouds': ly.el.innerHTML = artClouds(X0, X1); break;
        case 'hills1': case 'hills2': case 'hills3': ly.el.innerHTML = artHills(ly.k, X0, X1); break;
        case 'trees': ly.el.innerHTML = artTrees(X0, X1); break;
        case 'hedge': ly.el.innerHTML = artHedge(X0, X1); break;
        case 'ground': R.groundArt.innerHTML = artGround(X0, X1); break;
        case 'front': R.front.innerHTML = artFront(X0, X1); break;
        case 'fg': ly.el.innerHTML = artFg(X0, X1); break;
      }
    });
    R.sways = Array.from(R.front.querySelectorAll('.s3-sway'));
    R.fgClumps = Array.from(root.querySelectorAll('.s3-fgclump'));

    /* ---- sky ---- */
    R.sky.style.background = `linear-gradient(180deg, #14030b 0px, #2a0712 ${n1(bar + B * 0.03)}px, #561127 ${n1(hz - B * 0.43)}px, ` +
      `#8f2648 ${n1(hz - B * 0.29)}px, #cc4d69 ${n1(hz - B * 0.17)}px, #ef8a70 ${n1(hz - B * 0.08)}px, #ffc286 ${n1(hz - B * 0.02)}px, ` +
      `#ffe2ab ${n1(hz + B * 0.03)}px, #ffd09a 100%)`;
    R.dusk.style.background = `linear-gradient(180deg, rgba(12,2,14,.95) 0px, rgba(34,6,30,.7) ${n1(hz - B * 0.38)}px, rgba(80,16,46,.22) ${n1(hz - B * 0.12)}px, rgba(80,16,46,0) ${n1(hz + B * 0.04)}px)`;

    /* ---- sun / rays / flare sizes ---- */
    const sunBox = B * 1.1;
    R.sun.style.width = R.sun.style.height = sunBox + 'px';
    const raysBox = Math.max(W, H) * 1.15;
    R.rays.style.width = R.rays.style.height = raysBox + 'px';
    L.sunBox = sunBox; L.raysBox = raysBox;
    paintSun(L.sunD / sunBox);

    /* ---- characters (+ the handoff overlays, in the very same boxes) ----
       HIM, his hands and the bouquet are laid out in whole SPRITE pixels and
       scaled by sp in their transform: no fractional rects, so the browser never
       pixel-snaps the walk canvas and the him-side sprites differently (the
       walk → stand handover and the bouquet swap stay sub-pixel exact) */
    const himBox = { left: '0px', top: '0px', width: WK.boxW + 'px', height: WK.boxH + 'px' };
    // her canvas (360×600 her2 px) with (180, 600) on (xHer, groundY); k = layer px per her2 px
    const k = sp * HER.scale;
    L.k = k;
    const herBox = { left: (xHer - HER.ax * k) + 'px', top: (groundY - HER.h * k) + 'px', width: (HER.w * k) + 'px', height: (HER.h * k) + 'px' };
    Object.assign(R.him.style, himBox);
    Object.assign(R.hands.style, himBox);
    Object.assign(R.her.style, herBox);
    if (R.herHands) Object.assign(R.herHands.style, herBox);
    Object.assign(R.bq.style, { left: '0px', top: '0px', width: BQ.w + 'px', height: BQ.h + 'px' });
    st.setProperty('--s3-sp', sp.toFixed(6));
    // her palms in her2-hold-arms, as display offsets from the held bouquet's centre
    // (her2-hold.json: centre (158, 292), turned HOLD.rot): where the live hands end up
    const hc = [HOLD.x + HOLD.w / 2, HOLD.y + HOLD.w * BQ.h / BQ.w / 2], hr = -HOLD.rot * D2R;
    const toBq = (P) => { const dx = P[0] - hc[0], dy = P[1] - hc[1]; return [dx * Math.cos(hr) - dy * Math.sin(hr), dx * Math.sin(hr) + dy * Math.cos(hr)]; };
    L.grip1 = { far: toBq(palmAt(ARM.far, ARM.far.hold)), near: toBq(palmAt(ARM.near, ARM.near.hold)) };
    R.him._t = R.hands._t = R.bq._t = '';

    /* ---- camera framings for the handoff / her close-up / the last wide ----
       aim(): the camera that puts layer point (X, Y) on screen at (sx, sy), zoom z */
    const aim = (X, Y, z, sx, sy) => ({ x: X - (sx - W / 2) / z, y: sy - Ay - (Y - Ay) * z, z });
    const zH = Math.min(portrait ? 2.1 : 2.0, (W * 0.92) / (gap + 0.36 * U), (0.84 * B) / U);
    L.camH = aim(xMid - 0.03 * U, groundY - 0.5 * U, zH, W / 2, bar + B * 0.53);
    L.camH2 = aim(xMid + 0.02 * U, groundY - 0.52 * U, zH * (rm ? 1.02 : 1.08), W / 2, bar + B * 0.53);
    // her close-up: the bouquet (and her rig) stay ≤ ~1.55× native (1 her2 px = k
    // layer px), so her bust-resolution head plate shows at ~0.95× (crisp)
    const zCmax = Math.min(1.55 / k, (W * 0.9) / (0.34 * U), (0.7 * B) / (0.52 * U), 4.2);
    const zC = rm ? Math.min(zCmax, zH * 1.3) : zCmax;
    const faceX = xHer + (HER.face[0] - HER.ax) * k, faceY = groundY - (HER.h - HER.face[1]) * k;   // her face in layer space
    L.camC = portrait
      ? aim(faceX + 0.03 * U, faceY, zC, W / 2, bar + B * 0.27)
      : aim(faceX + 0.03 * U, faceY, zC, W * 0.4, bar + B * 0.3);
    // portrait: a clean single — the frame's left edge clears his front-most pixel
    // (his cap brim, 0.143 U ahead of his box centre in the settled lean, + rim light),
    // or short phone screens keep a sliver of brim and fingertips beside her smile
    if (portrait) L.camC.x = Math.max(L.camC.x, D + 0.15 * U + (W / 2 + 3) / zC);
    L.camE = { x: xMid, y: 0, z: z3 };
    Object.assign(R.archGlow.style, { left: n1(xArch - 0.9 * U) + 'px', top: n1(groundY - 1.75 * U) + 'px', width: n1(1.8 * U) + 'px', height: n1(1.4 * U) + 'px' });

    /* ---- birds (screen space) ---- */
    R.birdEls.forEach((b, i) => {
      const flock = i < 3 ? 0 : 1;
      const k = flock ? i - 3 : i;
      const y = (flock ? hz - B * 0.42 : hz - B * 0.27) + [0, B * 0.012, -B * 0.01][k];
      b.style.top = n1(y) + 'px';
      b.style.width = n1(B * (flock ? 0.021 : 0.028) * (1 - k * 0.12)) + 'px';
    });

    /* ---- close-ups ---- */
    const faceW = portrait ? Math.min(W * 0.96, B * 0.6) : B * 0.95 * 0.904;
    const faceH = faceW / 0.904;
    const faceTop = portrait ? bar + B * 0.2 : bar + B * 0.06;
    R.cutAFace.parentNode.style.cssText = `left:${n1((portrait ? W / 2 : W * 0.42) - faceW / 2)}px;top:${n1(faceTop)}px;width:${n1(faceW)}px;height:${n1(faceH)}px`;
    R.cutBFace.parentNode.style.cssText = `left:${n1(W / 2 - faceW / 2)}px;top:${n1(faceTop)}px;width:${n1(faceW)}px;height:${n1(faceH)}px`;
    // her cut-in mirrors his determined one: same head size, look room on the other side
    if (R.cutH) {
      const bH = faceH * 0.97, bW = bH * 296 / 301;
      const bx = (portrait ? W / 2 : W * 0.58) - bW / 2, by = faceTop + faceH - bH;
      R.cutHDolly.style.cssText = `left:${n1(bx)}px;top:${n1(by)}px;width:${n1(bW)}px;height:${n1(bH)}px`;
      // her head on the happy bust (bandana + face ≈ 166, 110 of 296×301), under the dolly's ~1.06 push
      L.cutHFace = { x: bx + bW * (0.5 + (166 / 296 - 0.5) * 1.06), y: by + bH * (0.4 + (110 / 301 - 0.4) * 1.06), rx: bW * 0.44, ry: bH * 0.46 };
    } else {
      L.cutHFace = null;
    }

    const bloomD = U * 0.95;
    Object.assign(R.bloom.style, { width: bloomD + 'px', height: bloomD + 'px', marginLeft: (-bloomD / 2) + 'px', marginTop: (-bloomD / 2) + 'px' });

    /* ---- where the words sit (particles keep clear of them in her close-up) ---- */
    const rr = root.getBoundingClientRect(), wr = R.words.getBoundingClientRect();
    L.words = { x: wr.left - rr.left + wr.width / 2, y: wr.top - rr.top + wr.height / 2, rx: wr.width / 2, ry: wr.height / 2 };
    R.walk._key = '';
  }

  /* ===================================================================
     RENDER (every frame + after seek): camera → layers, walk cycle
     =================================================================== */
  function camX() {
    const fw = S.followW;
    if (fw <= 0) return S.camX;
    // follow his continuous travel (the sprite itself steps on the 12 px grid)
    const follow = S.himXc + 0.1 * L.W / S.camZ;
    return S.camX * (1 - fw) + follow * fw;
  }

  /** The walk at clock w (s since the start sequence began), all in sprite px:
      which strip + frame to draw, his hip offset from the standing start
      (snapped = where the frame is drawn, cont = smooth, for the camera), feet. */
  function walkPose(w) {
    const fps = WK.fps, st = WK.start, sq = WK.stop;
    const base = st.join + WK.dist;                    // where the final heel-strike frame is drawn
    const tContact = WK.tStop - 1 / fps;               // …and when (held one frame)
    const lerpArr = (arr, f) => {
      const i = Math.max(0, Math.min(arr.length - 1, Math.floor(f)));
      const b = arr[Math.min(arr.length - 1, i + 1)];
      return arr[i] + (b - arr[i]) * Math.max(0, Math.min(1, f - i));
    };
    // (the clock is tweened by GSAP, which rounds: compare with a small epsilon)
    if (w <= 1e-4) return { k: 'stand', f: 0, off: 0, offC: 0, feet: WK.stand };
    if (w >= WK.dur - 1e-4) return { k: 'stand', f: 0, off: WK.total, offC: WK.total, feet: WK.stand };
    if (w < WK.tStart) {                               // from standing: the start sequence
      const f = w * fps, i = Math.min(st.dx.length - 1, Math.floor(f + 1e-6));
      return { k: 'start', f: i, off: st.dx[i], offC: lerpArr(st.dx.concat([st.join]), f), feet: st.feet[i] };
    }
    if (w < WK.tStop) {                                // the cycle, drawn on the 12 px grid
      const d = Math.min(WK.dist, (w - WK.tStart) * WK.speed);
      const j = Math.floor(d / WK.step + 1e-6), f = j % WK.n;
      const cont = w < tContact;                       // mid-stride (not the held heel-strike frame)
      const offC = cont ? st.join + d : base + sq.dx[0] * (w - tContact) * fps;
      return { k: 'cycle', f, off: st.join + j * WK.step, offC, cont, feet: WK.cycle.feet[f] };
    }
    // the stop sequence (frame i at tStop + i/fps; its last frame IS the stand → him-side)
    const f = (w - WK.tStop) * fps, i = Math.min(sq.dx.length - 2, Math.floor(f + 1e-6));
    return { k: 'stop', f: i, off: base + sq.dx[i], offC: base + lerpArr(sq.dx, f), feet: sq.feet[i] };
  }

  const stripOk = (img) => !!(img && img.complete && img.naturalWidth > 0);

  /** Draw one walk cell into the canvas at about device resolution. */
  function drawWalk(img, f) {
    const c = R.walk;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const need = WK.cellW * L.sp * Math.max(0.5, S.camZ) * dpr;
    const bw = Math.min(WK.cellW, Math.max(32, Math.ceil(need / 8) * 8));
    if (c.width !== bw) {
      c.width = bw;
      c.height = Math.round(bw * WK.cellH / WK.cellW);
      c._key = '';
    }
    const key = img.src + '#' + f;
    if (c._key === key) return;
    c._key = key;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, f * WK.cellW, 0, WK.cellW, WK.cellH, 0, 0, c.width, c.height);
  }

  function setVis(el, on) {
    if (el._v !== on) { el._v = on; el.style.visibility = on ? '' : 'hidden'; }
  }
  function setDisp(el, on) {
    if (el._d !== on) { el._d = on; el.style.display = on ? 'block' : 'none'; }
  }

  /** HIM: the walk canvas (or his standing sprite) + contact shadows. */
  function renderHim(pose) {
    const img = pose.k === 'stand' ? null : WIMG[pose.k];
    const walking = stripOk(img);
    if (walking) drawWalk(img, pose.f);
    setDisp(R.walk, walking);
    setVis(R.himStand, !walking);
    // standing: one whole sprite (pixel-identical to the last stop frame);
    // split into legs + upper only while he leans in to offer the flowers
    const split = S.offer > 0.0005;
    if (R.himStand._split !== split) { R.himStand._split = split; R.himStand.classList.toggle('is-split', split); }

    // contact shadows under each foot: firm when planted, fading as it lifts
    const ft = pose.feet;
    for (let k = 0; k < 2; k++) {
      const el = k ? R.himFootNear : R.himFootFar, o = k ? 0 : 3;
      const heel = ft[o], toe = ft[o + 1], lift = ft[o + 2], len = toe - heel;
      const x = (heel - 0.1 * len - WK.standX) / WK.boxW * 100, w = 1.2 * len / WK.boxW;
      const sy = lift > 0 ? Math.max(0.55, 1 - lift * 0.04) : 1;
      setT(el, '_t', `translateX(${x.toFixed(2)}%) scale(${w.toFixed(4)},${sy.toFixed(3)})`);
      const a = (lift > 0 ? Math.max(0.12, 0.75 - lift * 0.07) : 1).toFixed(2);
      if (el._o !== a) { el._o = a; el.style.opacity = a; }
    }
  }

  /** Particles keep off her face and the words: feathered holes in the fx canvas
      (petals drift "behind" her head), combined by mask-composite: intersect.
      Her head's hole in the garden is on from the two-shot to the last pull-back,
      weighted by how much of the garden shows (a cut-in fading in or out over it
      takes it along), so it never switches on while a petal sits on her face. */
  const opOf = (el) => (el && el.style.visibility !== 'hidden' ? (parseFloat(el.style.opacity) || 0) : 0);
  function renderFxHole() {
    const c = R.fxCanvas, U = L.U, ms = [];
    const hc = L.cutHFace ? S.holeH : 0;
    if (hc > 0.003) {                          // her cut-in: her bust's face (screen space)
      const q = L.cutHFace;
      ms.push(`radial-gradient(${n1(q.rx)}px ${n1(q.ry)}px at ${n1(q.x)}px ${n1(q.y)}px, rgba(0,0,0,${(1 - hc).toFixed(3)}) 50%, #000 100%)`);
    }
    const hw = S.hole * (1 - Math.max(opOf(R.cutA), opOf(R.cutH), opOf(R.cutB)));
    if (hw > 0.003) {
      // her whole head (bandana to chin, her2 px ≈ 100–240 × 9–131), not just the face
      const f = herPt(154, 78), p = toScreen(f.x, f.y, 1);
      ms.push(`radial-gradient(${n1(0.17 * U * p.z)}px ${n1(0.19 * U * p.z)}px at ${n1(p.x)}px ${n1(p.y)}px, rgba(0,0,0,${(1 - hw).toFixed(3)}) 50%, #000 100%)`);
    }
    if (S.holeW > 0.003) {
      const w = L.words;
      ms.push(`radial-gradient(${n1(w.rx * 1.35 + 24)}px ${n1(w.ry * 1.45 + 24)}px at ${n1(w.x)}px ${n1(w.y)}px, rgba(0,0,0,${(1 - S.holeW).toFixed(3)}) 62%, #000 100%)`);
    }
    if (!ms.length) {
      if (c._m) { c._m = ''; c.style.webkitMaskImage = c.style.maskImage = ''; c.classList.remove('is-holed'); }
      return;
    }
    const m = ms.join(', ');
    if (c._m !== m) {
      c._m = m;
      c.style.webkitMaskImage = c.style.maskImage = m;
      c.classList.add('is-holed');
    }
  }

  function toScreen(X, Y, p) {
    const pp = p == null ? 1 : p;
    const zp = 1 + (S.camZ - 1) * pp;
    return { x: L.W / 2 + (X - camX() * pp) * zp, y: L.Ay + (Y - L.Ay) * zp + S.camY * pp, z: zp };
  }

  /* ------------------------------------------------------------ HER (rig)
     Her life is a function of the timeline clock S.clk (seek-safe): a slow
     weight-shift sway about her feet (two incommensurate sines, so it never
     reads as a metronome) and breathing (a 0.8 % rise from the feet, 3.6 s). */
  const HL = { rot: 0, br: 1 };          // this frame's total rotation (deg) + breath scale
  function herLife() {
    const t = S.clk;
    const sway = S.swayA * (0.62 * Math.sin(TAU * t / 5.8) + 0.26 * Math.sin(TAU * t / 2.45 + 1.3));
    HL.rot = S.herRot + sway;
    HL.br = 1 + 0.008 * S.breathA * (0.5 - 0.5 * Math.cos(TAU * t / 3.6));
  }
  /** A point of her canvas (her2 px) in layer space, with her lean/bounce/breath. */
  function herPt(hx, hy) {
    const k = L.k, r = HL.rot * D2R, cr = Math.cos(r), sr = Math.sin(r);
    const ux = (hx - HER.ax) * k, uy = (hy - HER.h) * k * HL.br;
    return { x: L.xHer + ux * cr - uy * sr, y: L.groundY + S.herY + ux * sr + uy * cr };
  }

  function setOp(el, o) {               // opacity + visibility, written only when changed
    if (!el) return;
    const v = o <= 0.001 ? 0 : (o >= 0.999 ? 1 : Math.round(o * 1000) / 1000);
    if (el._op === v) return;
    el._op = v;
    el.style.opacity = String(v);
    el.style.visibility = v ? 'visible' : 'hidden';
  }
  function setZ(el, z) {
    if (el._z !== z) { el._z = z; el.style.zIndex = String(z); }
  }

  /** A layer point back onto her canvas (inverse of herPt). */
  function herCanvas(x, y) {
    const k = L.k, r = HL.rot * D2R, cr = Math.cos(r), sr = Math.sin(r);
    const dx = x - L.xHer, dy = y - L.groundY - S.herY;
    const ux = dx * cr + dy * sr, uy = -dx * sr + dy * cr;
    return [ux / k + HER.ax, uy / (k * HL.br) + HER.h];
  }

  /* ------------------------------------------------ her live forearms (ARM)
     The arm drawings' 2D rig (her-rig/pose.py), per frame: M = rotate(deg) ·
     scale(s along the source forearm axis) about the elbow; the hand is bent by
     h about the wrist first. */
  function armM(A, p) {                       // 2×2 of the forearm transform
    const a = A.axis * D2R, ux = Math.cos(a), uy = Math.sin(a), s1 = p[1] - 1;
    const S11 = 1 + s1 * ux * ux, S12 = s1 * ux * uy, S22 = 1 + s1 * uy * uy;
    const r = p[0] * D2R, c = Math.cos(r), s = Math.sin(r);
    return [c * S11 - s * S12, c * S12 - s * S22, s * S11 + c * S12, s * S12 + c * S22];
  }
  /** The hand's palm point (her canvas px) for arm params p = [deg, s, h]. */
  function palmAt(A, p) {
    const h = p[2] * D2R, ch = Math.cos(h), sh = Math.sin(h);
    const qx = A.palm[0] - A.wrist[0], qy = A.palm[1] - A.wrist[1];
    const wx = A.wrist[0] + qx * ch - qy * sh - A.elbow[0], wy = A.wrist[1] + qx * sh + qy * ch - A.elbow[1];
    const m = armM(A, p);
    return [A.elbow[0] + m[0] * wx + m[1] * wy, A.elbow[1] + m[2] * wx + m[3] * wy];
  }
  /** IK: the [deg, s, h] that puts the palm on canvas point P (s clamped). */
  function armIK(A, P, h) {
    const hr = h * D2R, ch = Math.cos(hr), sh = Math.sin(hr);
    const qx = A.palm[0] - A.wrist[0], qy = A.palm[1] - A.wrist[1];
    const wx = A.wrist[0] + qx * ch - qy * sh - A.elbow[0], wy = A.wrist[1] + qx * sh + qy * ch - A.elbow[1];
    const a = A.axis * D2R, ux = Math.cos(a), uy = Math.sin(a);
    const ca = wx * ux + wy * uy, cb = -wx * uy + wy * ux;             // along / across the axis
    const tx = P[0] - A.elbow[0], ty = P[1] - A.elbow[1], d2 = tx * tx + ty * ty;
    const s = Math.min(1.05, Math.max(0.42, Math.sqrt(Math.max(0, d2 - cb * cb)) / Math.abs(ca)));
    const vx = ux * ca * s - uy * cb, vy = uy * ca * s + ux * cb;      // S·w
    const deg = (Math.atan2(ty, tx) - Math.atan2(vy, vx)) / D2R;
    return [((deg + 540) % 360) - 180, s, h];
  }
  const lerpP = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  function setArm(el, A, p) {
    const fore = el._fore || (el._fore = el.querySelector('.s3-herarm__fore'));
    const wr = el._wr || (el._wr = el.querySelector('.s3-herarm__wrist'));
    setT(fore, '_t', `rotate(${(p[0] + A.axis).toFixed(3)}deg) scaleX(${p[1].toFixed(4)}) rotate(${(-A.axis).toFixed(3)}deg)`);
    setT(wr, '_t', `rotate(${p[2].toFixed(3)}deg)`);
  }

  /** Her forearms while she takes the flowers (pose 'live'): both reach out from
      hanging (the wait drawing) through the reach-1 and reach-2 drawings' poses
      (S.reach), the far hand then comes onto the wrap (S.grip) and IK keeps its palm
      on the bouquet's grip point (L.bqGrip) wherever the bouquet goes; the near hand
      comes from her belly to the bouquet's neck (S.nearA). At S.bq = 1 both are
      exactly the her2-hold-arms drawing. */
  const ARMP = { far: ARM.far.wait, near: ARM.near.wait };
  function reachPose(A, r) {                  // wait → reach-1 (at .45) → reach-2
    return r < 0.45 ? lerpP(A.wait, A.reach1, r / 0.45) : lerpP(A.reach1, A.reach2, (r - 0.45) / 0.55);
  }
  function liveArms() {
    const F = ARM.far, N = ARM.near, q = S.bq, r = Math.min(1, Math.max(0, S.reach));
    const bf = reachPose(F, r), bn = reachPose(N, r);
    const hFar = (bf[2] + (GRIP_H - bf[2]) * S.grip) * (1 - sstep(0.25, 1, q));
    let far = bf;
    if (S.grip > 0 && L.bqGrip) {
      const ik = armIK(F, herCanvas(L.bqGrip.far[0], L.bqGrip.far[1]), hFar);
      far = S.grip >= 1 ? ik : lerpP([bf[0], bf[1], hFar], ik, S.grip);
    }
    let near = bn;
    if (S.nearA > 0 && L.bqGrip) near = lerpP(bn, armIK(N, herCanvas(L.bqGrip.near[0], L.bqGrip.near[1]), 0), S.nearA);
    ARMP.far = far; ARMP.near = near;
    setArm(R.armFar, F, far);
    setArm(R.armNear, N, near);
    setArm(R.armFarB, F, far);
    setArm(R.armNearB, N, near);
  }

  /** Which drawing she is in at clock t: the current key's pose dissolves in
      (POSE_XF) over the previous one, which stays opaque underneath. */
  function herPose(t) {
    let i = 0;
    while (i + 1 < HERK.length && HERK[i + 1][0] <= t + 1e-6) i++;
    const b = HERK[i][1], a = i > 0 ? HERK[i - 1][1] : b;
    const f = i > 0 && a !== b ? Math.min(1, Math.max(0, (t - HERK[i][0]) / POSE_XF)) : 1;
    return { a, b, f };
  }
  const inBlink = (t) => BLINKS.some((w) => t >= w[0] && t < w[1]);

  function renderHer() {
    const t = S.clk, ps = herPose(t);
    // her body drawing ('live' and 'hold' share the hold body: no dissolve between them)
    const ba = bodyOf(ps.a), bb = bodyOf(ps.b), bf = ba === bb ? 1 : ps.f;
    for (let i = 0; i < R.herPoses.length; i++) {
      const el = R.herPoses[i], p = el._pose || (el._pose = el.getAttribute('data-pose'));
      let o = 0, z = 0;
      if (p === bb) { o = bf; z = 2; } else if (p === ba && bf < 1) { o = 1; z = 1; }
      setOp(el, o);
      setZ(el, z);
    }
    // her forearms above the bouquet: the live arms, or the hold drawing
    if (R.herHands) {
      const ma = armsOf(ps.a), mb = armsOf(ps.b), mf = ma === mb ? 1 : ps.f;
      const vis = (m) => (mb === m ? mf : (ma === m && mf < 1 ? 1 : 0));
      const ol = vis('live'), oi = vis('img');
      // the live arms are drawn in her stack (beside her they get her silhouette's
      // rim) and, once they have to be over the bouquet, again in front of it: the
      // far one from the touch (its stack copy stays on underneath — where the arm
      // is over the background the rim still shows, over the bouquet it is hidden),
      // the near one as it comes up to the neck
      const ff = S.farF >= 0.5, nf = S.nearF >= 0.5;
      setOp(R.herHands, Math.max(ol, oi));
      setOp(R.herHandsImg, oi);
      setOp(R.armFar, ff ? ol : 0);
      setOp(R.armNear, nf ? ol : 0);
      setOp(R.armFarB, ol);
      setOp(R.armNearB, nf ? 0 : ol);
      if (ol > 0) liveArms();
    }
    const closed = inBlink(t);
    setOp(R.herSmile, S.smile);
    setOp(R.herBlink, closed ? 1 : 0);
    // close-up head plates (bust resolution): happy (camera), look (toward him),
    // the closed-eye twin, the laugh — all hard cuts
    setOp(R.herPlate, S.plate);
    if (S.plate > 0.001) {
      setOp(R.plLook, S.look);
      setOp(R.plBlink, closed ? 1 : 0);
      setOp(R.plLaugh, S.laugh);
    }
    const herT = `translate3d(0,${S.herY.toFixed(2)}px,0) rotate(${HL.rot.toFixed(3)}deg) scaleY(${HL.br.toFixed(5)})`;
    setT(R.herIdle, '_t', herT);
    if (R.herHandsIdle) setT(R.herHandsIdle, '_t', herT);
  }

  function setT(el, key, v) {           // write transform only when changed
    if (el[key] !== v) { el[key] = v; el.style.transform = v; }
  }

  function render() {
    if (!L || !S) return;
    // HIM first: the camera follows his walk
    const pose = walkPose(S.wk);
    // his standing-sprite box centre (start = 0, arrival = D). Mid-stride, while the
    // camera follows his continuous travel, the frames are drawn at a position blended
    // toward it (by the follow weight): on the 12 px grid the whole figure would
    // otherwise jitter against the tracking camera in a 20 Hz sawtooth. The planted
    // foot then slips < 12 sprite px under a moving background (follow-pan practice);
    // start, stop and standing stay snapped, and the snap returns as followW → 0.
    const drawOff = pose.cont ? pose.off + (pose.offC - pose.off) * S.followW : pose.off;
    S.himX = drawOff * L.sp;
    S.himXc = pose.offC * L.sp;
    const z = S.camZ, cx = camX();
    for (let i = 0; i < layers.length; i++) {
      const ly = layers[i];
      const zp = 1 + (z - 1) * ly.p;
      let tx = L.W / 2 - cx * ly.p * zp;
      if (ly.k === 'clouds') tx += S.cloud;
      const ty = L.Ay * (1 - zp) + S.camY * ly.p;
      const v = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${zp.toFixed(5)})`;
      if (v !== ly.last) { ly.last = v; ly.el.style.transform = v; }
    }

    /* sun, rays, flare follow the sun's screen position */
    const sp = toScreen(L.sunX, L.sunY + S.sunSink, P_SUN);
    setT(R.sun, '_t', `translate3d(${(sp.x - L.sunBox / 2).toFixed(1)}px,${(sp.y - L.sunBox / 2).toFixed(1)}px,0)`);
    setT(R.rays, '_t', `translate3d(${(sp.x - L.raysBox / 2).toFixed(1)}px,${(sp.y - L.raysBox / 2).toFixed(1)}px,0) rotate(${S.rays.toFixed(2)}deg)`);
    setT(R.flare, '_t', `translate3d(${sp.x.toFixed(1)}px,${sp.y.toFixed(1)}px,0) scale(${(0.85 + S.flare * 0.5).toFixed(3)})`);
    const fo = (0.32 + S.flare * 0.68).toFixed(3);
    if (R.flare._o !== fo) { R.flare._o = fo; R.flare.style.opacity = fo; }

    /* HIM — hand-drawn walk frames, derived from the walk clock (seek-safe) */
    // (box in sprite px, scaled by sp: see layout)
    const himT = `translate3d(${(S.himX - L.wHim / 2).toFixed(3)}px,${(L.groundY - L.U).toFixed(3)}px,0) scale(${L.sp.toFixed(6)})`;
    // arrival / handoff: he leans in and holds the bouquet out to her
    // (mostly a rotation about the hip; only a little forward shift, or the waist would slide off his hips)
    const off = S.offer, upRot = off * 4.5, upXs = off * WK.boxW * 0.025, upX = upXs * L.sp;
    const upT = `translateX(${upXs.toFixed(3)}px) rotate(${upRot.toFixed(2)}deg)`;
    setT(R.him, '_t', himT);
    setT(R.himUpper, '_t', upT);
    renderHim(pose);
    // his hands, layered above the bouquet, ride the exact same transforms
    setT(R.hands, '_t', himT);
    setT(R.handsUpper, '_t', upT);

    /* HER — lean / happy bounce / sway / breath about her feet; THE BOUQUET (hidden
       by the timeline until the swap) first: her live hands hold on to it */
    herLife();
    renderBouquet(upRot, upX);
    renderHer();
    // his hands overlay (identical pixels to his empty-handed sprite, above the
    // bouquet) only drops once the wrap has left his fingers
    if (R.hands) setDisp(R.hands, S.bq < 0.6);
    renderFxHole();
  }

  /** Bouquet pose: q=0 exactly in his hands (his upper-body transform),
      q=1 exactly at her2-hold.json (her lean/bounce/breath included); between,
      it hangs from her far hand, which swings it in on an arc about her elbow,
      and it turns around (mirror) toward her on the way. */
  function renderBouquet(upRot, upX) {
    const U = L.U, s = U / 604;
    // his pose: bouquet centre in his sprite box → his upper-body transform (origin 35% 62%)
    const hx = S.himX - L.wHim / 2, hy = L.groundY - U;
    const ox = hx + 0.35 * L.wHim, oy = hy + 0.62 * U;
    const px = hx + (BQ.x + BQ.w / 2) * s - ox, py = hy + (BQ.y + BQ.h / 2) * s - oy;
    const cr = Math.cos(upRot * D2R), sr = Math.sin(upRot * D2R);
    const x0 = ox + upX + px * cr - py * sr, y0 = oy + px * sr + py * cr, r0 = upRot;
    // her pose: the her2-hold.json box centre on her canvas → her idle transform
    // her pose (q = 1): her2-hold.json, turned with her (its centre follows from her hand)
    const r1 = HOLD.rot + HL.rot;

    const q = S.bq, arc = Math.sin(Math.PI * q);
    const rot = r0 + (r1 - r0) * q;
    // turn-around: narrows (never to a sliver) while the mirrored copy takes over
    const f = sstep(0.4, 0.97, q);
    const m = 0.36 + 0.64 * Math.abs(Math.cos(Math.PI * f));
    const sc = 1 + 0.05 * arc;
    // (the bouquet box is BQ.w × BQ.h sprite px, scaled by sp about its centre; in
    // her arms by her scale k, the same unless HER.scale ≠ 1)
    const ks = sc * (L.sp + (L.k - L.sp) * q);
    /* SHE carries it: the point her far hand holds (display px from the box centre)
       slides from the wrap cone (GRIP0, beside his fists) to its place in the hold;
       that point travels on an arc about her far elbow — her forearm swings it in
       low and toward her (radius dips a little: the forearm comes toward the
       camera) — and the bouquet hangs from it. q=0 is exactly his hold, q=1 exactly
       her2-hold.json. */
    const G1 = L.grip1, wg = sstep(0.2, 1, q);
    const gd = [GRIP0[0] + (G1.far[0] - GRIP0[0]) * wg, GRIP0[1] + (G1.far[1] - GRIP0[1]) * wg];
    const off = (g, rr, mm, kk) => { const c = Math.cos(rr * D2R), sn = Math.sin(rr * D2R); return [c * g[0] * mm * kk - sn * g[1] * kk, sn * g[0] * mm * kk + c * g[1] * kk]; };
    let x = x0, y = y0;
    if (q > 0) {
      const o0 = off(GRIP0, r0, 1, L.sp), c0 = herCanvas(x0 + o0[0], y0 + o0[1]);
      const E = ARM.far.elbow, c1 = palmAt(ARM.far, ARM.far.hold);
      const a0 = Math.atan2(c0[1] - E[1], c0[0] - E[0]) / D2R, a1 = Math.atan2(c1[1] - E[1], c1[0] - E[0]) / D2R;
      const A0 = a0 < 0 ? a0 + 360 : a0;                       // from the left (≈185°) down through 90° …
      const A1 = a1 > 180 ? a1 - 360 : a1;                      // … to the front of her belly (≈39°)
      const rad = Math.hypot(c0[0] - E[0], c0[1] - E[1]) * (1 - q) + Math.hypot(c1[0] - E[0], c1[1] - E[1]) * q - BQ_DIP * 604 * arc;
      const an = (A0 + (A1 - A0) * q) * D2R;
      const gp = herPt(E[0] + rad * Math.cos(an), E[1] + rad * Math.sin(an));
      const o = off(gd, rot, m, ks);
      x = gp.x - o[0]; y = gp.y - o[1];
    }
    setT(R.bq, '_t', `translate3d(${(x - BQ.w / 2).toFixed(3)}px,${(y - BQ.h / 2).toFixed(3)}px,0) rotate(${rot.toFixed(3)}deg) scale(${(m * ks).toFixed(5)},${ks.toFixed(5)})`);
    // where her hands hold it (layer px): the far hand on gd; the near hand's place
    // is the hold one throughout (it only comes in at the end)
    const og = off(gd, rot, m, ks), on2 = off(G1.near, rot, m, ks);
    L.bqGrip = { far: [x + og[0], y + og[1]], near: [x + on2[0], y + on2[1]] };
    // the mirrored copy (later in the DOM, on top) fades in over a fully opaque
    // original, which drops out only once it is covered: never see-through
    const oa = f < 0.6 ? '1' : '0', ob = sstep(0.4, 0.6, f).toFixed(3);
    if (R.bqA._o !== oa) { R.bqA._o = oa; R.bqA.style.opacity = oa; }
    if (R.bqB._o !== ob) { R.bqB._o = ob; R.bqB.style.opacity = ob; }
    L.bqX = x; L.bqY = y;                     // for bursts / bloom

    // warm bloom (screen space) sits on the bouquet
    const on = S.bloom > 0.002, bl = on ? S.bloom.toFixed(3) : '0';
    if (R.bloom._o !== bl) { R.bloom._o = bl; R.bloom.style.opacity = bl; R.bloom.style.visibility = on ? 'visible' : 'hidden'; }
    if (on) {
      const p = toScreen(x, y - 0.1 * U, 1);
      setT(R.bloom, '_t', `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) scale(${(p.z * (0.85 + 0.3 * S.bloom)).toFixed(3)})`);
    }
  }

  /* ===================================================================
     MASTER TIMELINE
     =================================================================== */
  function beatSlots(n) {
    if (!n) return [];
    const preset = [[12.3, 15.5], [19.6, 22.35], [24.95, 27.25]];
    if (n <= 3) return preset.slice(0, n);
    const total = BEAT_WINDOWS.reduce((t, w) => t + (w[1] - w[0]), 0);
    const each = total / n;
    const out = [];
    let wi = 0, t = BEAT_WINDOWS[0][0];
    for (let i = 0; i < n; i++) {
      if (t + each > BEAT_WINDOWS[wi][1] + 0.01 && wi < BEAT_WINDOWS.length - 1) { wi++; t = BEAT_WINDOWS[wi][0]; }
      out.push([t, t + each - 0.2]);
      t += each;
    }
    return out;
  }

  function buildTimeline() {
    const P = L, rm = Love.reducedMotion;
    const tl = gsap.timeline({ paused: true });
    const ft = (target, from, to, pos) => tl.fromTo(target, from, Object.assign({ immediateRender: false }, to), pos);
    // a hard cut (zero-duration fromTo: seeking back before it restores `from`)
    const cut = (target, from, to, pos) => ft(target, from, Object.assign({ duration: 0 }, to), pos);
    const call = (fn, pos) => tl.call(fn, null, pos);

    S = {
      camX: P.xA, camY: P.crane, camZ: P.zWide, followW: 0,
      wk: 0, himX: 0, himXc: 0, offer: 0, sunSink: 0, rays: 0, cloud: 0, flare: 0,
      bq: 0, bloom: 0, hole: 0, holeW: 0, holeH: 0,
      // her: clock for her procedural life, lean/bounce, sway + breath amounts,
      // smile overlay, close-up head plate (+ its look-at-him eyes and laugh),
      // her live arms (far hand onto the bouquet, near hand to its neck)
      clk: 0, herRot: 0, herY: 0, swayA: rm ? 0 : 1, breathA: rm ? 0 : 1, smile: 0, plate: 0, look: 0, laugh: 0,
      reach: 0, grip: 0, nearA: 0, farF: 0, nearF: 0,
    };

    /* ---- her drawings on the pose clock, and when her eyes are closed ---- */
    HERK = R.herRig ? [
      [0, 'wait'],
      [T.react, 'mid'], [T.react + 0.07, 'react'],             // hands fly to her heart (cut on action)
      [T.lower, 'mid'], [T.lower + 0.18, 'wait'],               // …come down as he leans in to offer
      [T.reachOut, 'live'],                                     // her live arms: she reaches out, takes hold, draws it in
      [T.land - 0.03, 'hold'],                                  // in her arms (= the live arms at that frame)
    ] : [[0, 'wait']];
    const blink = (t, d) => [t, t + (d || 0.13)];
    // expression changes on her head plate are hard cuts bridged through closed eyes
    const bridge = (t, d) => [t, t + (d || 0.1)];
    BLINKS = [
      blink(5.1), blink(7.9), blink(8.12),                       // waiting under the arch (a double blink)
      blink(25.55),                                              // the two-shot (the plate cuts in here)
      bridge(T.react - 0.06, 0.06), bridge(T.react + 0.95),      // into / out of the arrival laugh
      blink(30.4), blink(31.45),
      [T.land + 0.2, T.land + 0.8],                              // eyes closed in joy, the flowers in her arms
      blink(35.85), blink(37.6),
      bridge(T.giggle - 0.06, 0.06), bridge(T.giggle + 0.95),    // into / out of the giggle
      blink(41.45), blink(43.4), blink(46.2),
    ];

    /* ---- initial states (direct, so every seek has a clean baseline) ---- */
    gsap.set([R.cutA, R.cutB, R.flash, R.glow, R.words, R.scrim, R.skip, R.him, R.bq, R.hands], { autoAlpha: 0 });
    if (R.cutH) { gsap.set(R.cutH, { autoAlpha: 0 }); gsap.set([R.cutHB2, R.cutHB3], { opacity: 0 }); gsap.set(R.cutHB1, { opacity: 1 }); }
    gsap.set(R.himFull, { autoAlpha: 1 });
    gsap.set(R.himEmpty, { autoAlpha: 0 });
    gsap.set(R.himSoft, { autoAlpha: 0 });
    gsap.set([R.black, R.title, R.world], { autoAlpha: 1 });
    gsap.set(R.titleInner, { autoAlpha: 1, y: 0, filter: 'blur(0px)' });
    gsap.set([R.eyebrow, R.rose, R.l2].concat(R.l1Words), { autoAlpha: 0 });
    gsap.set(R.titleChars, { autoAlpha: rm ? 1 : 0 });
    if (rm) gsap.set(R.titleLines, { autoAlpha: 0 });
    gsap.set(R.dusk, { opacity: 0 });
    gsap.set(R.herHalo, { opacity: 0.6, scale: 1 });
    gsap.set(R.leakB, { autoAlpha: 0 });
    gsap.set(R.world, { visibility: 'visible' });
    gsap.set(R.barTop, { y: 0, yPercent: -101 });
    gsap.set(R.barBot, { y: 0, yPercent: 101 });
    gsap.set(R.beats, { autoAlpha: 0 });

    /* ---- 0–4 · title on black, letterbox ---- */
    ft(R.barTop, { yPercent: -101 }, { yPercent: 0, duration: 2.2, ease: 'expo.inOut' }, T.barsIn);
    ft(R.barBot, { yPercent: 101 }, { yPercent: 0, duration: 2.2, ease: 'expo.inOut' }, T.barsIn);
    ft(R.eyebrow, { autoAlpha: 0, y: 8, letterSpacing: '0.55em' }, { autoAlpha: 1, y: 0, letterSpacing: '0.32em', duration: 1.8, ease: 'power3.out' }, T.title - 0.3);
    if (rm) {
      ft(R.titleLines, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.0, stagger: 0.4, ease: 'sine.out' }, T.title);
    } else {
      ft(R.titleChars, { autoAlpha: 0, yPercent: 35, filter: 'blur(8px)' },
        { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.05, ease: 'power3.out', stagger: 0.042 }, T.title);
    }
    ft(R.rose, { autoAlpha: 0, scale: 0.5, rotation: -14, y: 6 }, { autoAlpha: 1, scale: 1, rotation: 0, y: 0, duration: 1.3, ease: 'back.out(1.7)' }, T.title + 1.45);
    ft(R.titleInner, { autoAlpha: 1, y: 0, filter: 'blur(0px)' }, { autoAlpha: 0, y: -10, filter: 'blur(6px)', duration: 0.95, ease: 'power2.in' }, T.titleOut);
    ft(R.black, { autoAlpha: 1 }, { autoAlpha: 0, duration: 2.0, ease: 'sine.inOut' }, T.fadeUp);
    ft(R.skip, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, ease: 'sine.out' }, 3.0);
    call(() => audio('setIntensity', 0.3, 3), 0.01);
    // the walk strips must be decoded before he walks: hold on the title card if not yet
    call(holdForStrips, T.titleOut - 0.2);

    /* ---- atmosphere over the whole scene ---- */
    ft(S, { sunSink: 0 }, { sunSink: P.B * 0.045, duration: T.end, ease: 'none' }, 0);
    ft(S, { rays: 0 }, { rays: rm ? 0 : 30, duration: T.end, ease: 'none' }, 0);
    ft(S, { cloud: 0 }, { cloud: -P.W * 0.08, duration: T.end, ease: 'none' }, 0);
    ft(R.dusk, { opacity: 0 }, { opacity: 0.55, duration: T.hand - 6, ease: 'sine.in' }, 6);
    ft(R.leakA, { opacity: 0.22 }, { opacity: 0.5, duration: 3.6, ease: 'sine.inOut', repeat: Math.ceil(T.end / 3.6), yoyo: true }, 0);
    ft(R.archGlow, { opacity: 0.55 }, { opacity: 1, duration: 2.4, ease: 'sine.inOut', repeat: Math.ceil(T.end / 2.4), yoyo: true }, 0);
    // her clock: breathing, weight-shift sway, blinks and her drawings all derive from it
    ft(S, { clk: 0 }, { clk: T.end, duration: T.end, ease: 'none' }, 0);
    if (!rm) {
      R.fgClumps.forEach((el, i) => ft(el, { rotation: -1.3 + (i % 3) * 0.4 }, { rotation: 1.4, duration: 2.4 + (i % 4) * 0.45, ease: 'sine.inOut', repeat: Math.ceil(T.end / 2.4), yoyo: true }, 0));
      R.sways.forEach((el, i) => ft(el, { skewX: -2.2 + (i % 3) * 0.9 }, { skewX: 2.6, duration: 2.0 + (i % 5) * 0.35, ease: 'sine.inOut', repeat: Math.ceil(T.end / 2.0), yoyo: true }, 0));
    }
    // birds
    R.birdEls.forEach((b, i) => {
      const flock = i < 3 ? 0 : 1, k = flock ? i - 3 : i;
      const t0 = flock ? 17.5 : 4.4, dur = flock ? 13 : 12;
      const dx = [0, -P.B * 0.04, -P.B * 0.07][k];
      ft(b, { x: -P.W * 0.08 + dx, y: 0 }, { x: P.W * 1.08 + dx, y: -P.B * 0.05, duration: dur, ease: 'none' }, t0);
      ft(b.firstChild, { scaleY: 1 }, { scaleY: 0.32, duration: 0.17 + k * 0.02, ease: 'sine.inOut', repeat: Math.ceil(dur / 0.17), yoyo: true }, t0);
    });

    /* ---- 4–9 · establishing pan (crane down, drift right) ---- */
    ft(S, { camX: P.xA, camY: P.crane }, { camX: P.xB, camY: 0, duration: T.whip - T.estab, ease: 'sine.inOut' }, T.estab);
    ft(S, { camZ: P.zWide }, { camZ: P.zWide * 1.035, duration: T.whip - T.estab, ease: 'none' }, T.estab);
    call(() => audio('setIntensity', 0.38, 3), 4.2);

    /* ---- 9–11 · whip back to the start of the path ---- */
    if (rm) {
      ft(S, { camX: P.xB }, { camX: P.xS, duration: 0.01 }, T.whip + 0.9);
      ft(S, { camZ: P.zWide * 1.035 }, { camZ: P.zStart, duration: 0.01 }, T.whip + 0.9);
    } else {
      ft(S, { camX: P.xB }, { camX: P.xS, duration: 1.9, ease: 'power3.inOut' }, T.whip);
      ft(S, { camZ: P.zWide * 1.035 }, { camZ: P.zStart, duration: 1.9, ease: 'power2.inOut' }, T.whip);
    }
    ft(R.leakB, { xPercent: -55 }, { xPercent: 55, duration: 2.0, ease: 'power2.inOut' }, T.whip - 0.05);
    ft(R.leakB, { autoAlpha: 0 }, { autoAlpha: rm ? 1 : 0.9, duration: 0.9, ease: 'sine.in' }, T.whip - 0.05);
    ft(R.leakB, { autoAlpha: rm ? 1 : 0.9 }, { autoAlpha: 0, duration: 1.1, ease: 'sine.out' }, T.whip + 0.85);
    call(() => audio('cue', 'whoosh'), T.whip + 0.05);
    tl.set(S, { followW: 1 }, T.whip + 1.95);
    ft(R.him, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.3, ease: 'sine.out' }, T.himIn);
    ft(R.himHaze, { filter: 'brightness(1.3) saturate(0.5) contrast(0.7)' }, { filter: 'brightness(1) saturate(1) contrast(1)', duration: 6, ease: 'sine.inOut' }, T.himIn);
    tl.set(R.himHaze, { filter: 'none' }, T.himIn + 6.05);

    /* ---- 11.9–26.9 · the walk: one linear clock drives start → cycle → stop ---- */
    ft(S, { wk: 0 }, { wk: WK.dur, duration: WK.dur, ease: 'none' }, T.walk0);
    ft(S, { camZ: P.zStart }, { camZ: 1, duration: T.two - 11.0, ease: 'sine.inOut' }, 11.0);
    [[T.walk0, 0.45, 1.5], [14, 0.6, 4], [18, 0.72, 4], [22, 0.85, 3], [25.4, 0.95, 2]].forEach((q) => call(() => audio('setIntensity', q[1], q[2]), q[0]));

    // beats in the lower third
    const slots = beatSlots(R.beats.length);
    R.beats.forEach((b, i) => {
      const sl = slots[i];
      if (!sl) return;
      ft(b, { autoAlpha: 0, y: 14, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out' }, sl[0]);
      ft(b, { autoAlpha: 1, y: 0, filter: 'blur(0px)' }, { autoAlpha: 0, y: -8, filter: 'blur(6px)', duration: 0.8, ease: 'power1.in' }, sl[1] - 0.8);
    });

    // wind gusts carry the petals
    if (fx) {
      const w = fx.state;
      ft(w, { wind: 30 }, { wind: 30, duration: 0.01 }, 0);
      ft(w, { wind: 30 }, { wind: rm ? 60 : 175, duration: 1.5, ease: 'sine.inOut' }, 13.0);
      ft(w, { wind: rm ? 60 : 175 }, { wind: 40, duration: 2.6, ease: 'sine.inOut' }, 14.5);
      ft(w, { wind: 40 }, { wind: rm ? 60 : 190, duration: 1.4, ease: 'sine.inOut' }, 21.2);
      ft(w, { wind: rm ? 60 : 190 }, { wind: 35, duration: 2.4, ease: 'sine.inOut' }, 22.6);
      ft(w, { wind: 35 }, { wind: rm ? 10 : -95, duration: 1.1, ease: 'sine.inOut', repeat: 3, yoyo: true }, T.arrive + 0.3);
    }

    /* ---- 17–19 · cut-in: a deep breath ---- */
    ft(R.cutA, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power1.inOut' }, T.cutA);
    ft(R.cutADolly, { scale: 1.0, yPercent: 2 }, { scale: rm ? 1.02 : 1.1, yPercent: -1, duration: T.cutAOut - T.cutA + 0.4, ease: 'sine.out' }, T.cutA);
    ft(R.cutAFace, { scaleY: 1, y: 0 }, { scaleY: 1.014, y: -3, duration: 1.0, ease: 'sine.inOut', yoyo: true, repeat: 1 }, T.cutA + 0.25);
    ft(R.cutABokeh, { x: 0, scale: 1.05 }, { x: -P.W * 0.03, scale: 1.0, duration: T.cutAOut - T.cutA + 0.4, ease: 'sine.out' }, T.cutA);
    ft(R.cutA, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35, ease: 'power1.inOut' }, T.cutAOut);
    tl.set(R.world, { visibility: 'hidden' }, T.cutA + 0.4);
    tl.set(R.world, { visibility: 'visible' }, T.cutAOut - 0.05);

    /* ---- 22.5–24.8 · the reverse cut-in: HER. She notices him coming (her
       surprised face, glancing over her shoulder toward him, a quick small
       push-in), blinks, and opens her eyes smiling (hard cuts between the
       registered drawings: surprised → closed eyes → happy, plus a little head
       tilt). It also hides the camera's cut from following him to the two-shot
       (T.two). ---- */
    if (R.cutH) {
      const tH = T.cutH, tS = T.cutHSoft, tO = T.cutHOut;
      ft(R.cutH, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.inOut' }, tH);
      ft(R.cutHDolly, { scale: 1.0, yPercent: 1.5 }, { scale: rm ? 1.01 : 1.045, yPercent: 0, duration: 0.5, ease: 'power3.out' }, tH);
      ft(R.cutHDolly, { scale: rm ? 1.01 : 1.045, yPercent: 0 }, { scale: rm ? 1.03 : 1.1, yPercent: -1, duration: tO - tH - 0.15, ease: 'sine.inOut' }, tH + 0.5);
      ft(R.cutHBust, { scaleY: 1 }, { scaleY: 1.012, duration: 0.85, ease: 'sine.inOut', yoyo: true, repeat: 1 }, tH + 0.3);
      cut(R.cutHB1, { opacity: 1 }, { opacity: 0 }, tS - 0.09);
      cut(R.cutHB3, { opacity: 0 }, { opacity: 1 }, tS - 0.09);
      cut(R.cutHB2, { opacity: 0 }, { opacity: 1 }, tS);
      cut(R.cutHB3, { opacity: 1 }, { opacity: 0 }, tS);
      ft(R.cutHBust, { rotation: 0, y: 0 }, { rotation: rm ? 0.5 : 1.4, y: 2, duration: 0.8, ease: 'sine.out' }, tS - 0.09);
      ft(R.cutHBloom, { opacity: 0.3 }, { opacity: 0.8, duration: 1.1, ease: 'sine.inOut' }, tS - 0.2);
      ft(R.cutHBokeh, { x: 0, scale: 1.05 }, { x: P.W * 0.03, scale: 1.0, duration: tO - tH + 0.4, ease: 'sine.out' }, tH);
      ft(R.cutH, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35, ease: 'power1.inOut' }, tO);
      // petals drift behind her face, not across it
      ft(S, { holeH: 0 }, { holeH: 1, duration: 0.3, ease: 'sine.out' }, tH);
      ft(S, { holeH: 1 }, { holeH: 0, duration: 0.3, ease: 'sine.in' }, tO + 0.05);
      tl.set(R.world, { visibility: 'hidden' }, tH + 0.35);
      tl.set(R.world, { visibility: 'visible' }, tO - 0.05);
      // back in the garden she is smiling (the open smile, from the happy bust)
      ft(S, { smile: 0 }, { smile: 1, duration: 0.01 }, tH + 1.0);
    } else {
      ft(S, { smile: 0 }, { smile: 1, duration: 0.3 }, T.two + 0.5);
    }
    // from the two-shot on, petals and hearts keep off her head (the hole follows
    // the garden's visibility: it comes in under the cut-in's dissolve, never on her face)
    cut(S, { hole: 0 }, { hole: 1 }, T.two);
    // in the two-shot her head becomes the bust-resolution plate (cut inside a
    // blink), its eyes looking at HIM (her2-cu-look) until the close-up
    if (R.herRig) {
      cut(S, { plate: 0, look: 0 }, { plate: 1, look: 1 }, 25.56);
      cut(S, { look: 1 }, { look: 0 }, T.land + 0.5);         // her eyes reopen in the close-up on the camera
    }

    /* ---- 25–29 · arrival two-shot ---- */
    tl.set(S, { camX: P.xMid }, T.two);
    ft(S, { followW: 1 }, { followW: 0, duration: 3.0, ease: 'sine.inOut' }, T.two);
    ft(S, { camZ: 1 }, { camZ: P.z2, duration: 3.0, ease: 'sine.inOut' }, T.two);
    ft(S, { camZ: P.z2 }, { camZ: P.z3, duration: T.cutB + 0.4 - T.two - 3.0, ease: 'sine.inOut' }, T.two + 3.0);
    ft(S, { camY: 0 }, { camY: 0, duration: T.hand - T.whip, ease: 'none' }, T.whip);   // hold: keeps backward seeks exact
    call(() => audio('cue', 'heart'), T.arrive);
    // as he comes up the path she leans toward him (her weight on her toes)…
    const LEAN0 = rm ? -0.5 : -1.1;
    ft(S, { herRot: 0 }, { herRot: LEAN0, duration: 1.4, ease: 'sine.inOut' }, 25.4);
    // …and her reaction is a CUT ON ACTION on the frame of the arrival burst: her hands
    // fly to her heart through an in-between drawing (HERK), she bursts out laughing
    // (the laugh plate; in and out through closed eyes, BLINKS), rocks back a touch
    // with two happy bounces
    const tR = T.react;
    ft(S, { herRot: LEAN0 }, { herRot: rm ? 0 : 0.6, duration: 0.22, ease: 'power2.out' }, tR);
    ft(S, { herRot: rm ? 0 : 0.6 }, { herRot: 0, duration: 1.3, ease: 'sine.inOut' }, tR + 0.3);
    if (R.herRig) {
      cut(S, { laugh: 0 }, { laugh: 1 }, tR);
      cut(S, { laugh: 1 }, { laugh: 0 }, tR + 0.95);
    }
    if (!rm) ft(S, { herY: 0 }, { herY: -P.U * 0.012, duration: 0.15, ease: 'power2.out', yoyo: true, repeat: 3 }, tR);
    // he has stopped: his sprite becomes empty-body + bouquet + hands (identical pixels)
    tl.set(R.himFull, { autoAlpha: 0 }, T.swap);
    tl.set(R.himEmpty.concat([R.bq, R.hands]), { autoAlpha: 1 }, T.swap);
    ft(S, { offer: 0 }, { offer: rm ? 0.3 : 0.4, duration: 1.5, ease: 'power2.inOut' }, T.arrive + 0.35);
    ft(R.herHalo, { opacity: 0.6, scale: 1 }, { opacity: 1, scale: 1.25, duration: 2.4, ease: 'power2.out' }, T.arrive);
    ft(S, { flare: 0 }, { flare: 0.9, duration: 1.4, ease: 'power2.out' }, T.arrive + 0.1);
    ft(S, { flare: 0.9 }, { flare: 0.25, duration: 2.4, ease: 'sine.inOut' }, T.arrive + 1.5);
    call(() => burstArrival(), T.arrive + 0.35);

    /* ---- 29–31 · close-up: his smile ---- */
    ft(R.cutB, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.inOut' }, T.cutB);
    ft(R.cutBDolly, { scale: 1.02, yPercent: 1 }, { scale: rm ? 1.04 : 1.09, yPercent: -1, duration: T.hand - T.cutB + 0.35, ease: 'sine.out' }, T.cutB);
    ft(R.cutBBloom, { opacity: 0.35 }, { opacity: 0.85, duration: 1.6, ease: 'sine.inOut' }, T.cutB);
    ft(R.cutBBokeh, { x: 0, scale: 1.05 }, { x: P.W * 0.025, scale: 1.0, duration: 2.0, ease: 'sine.out' }, T.cutB);
    tl.set(R.world, { visibility: 'hidden' }, T.cutB + 0.35);
    // while the world is hidden behind his smile, his profile takes on that smile
    // (relaxed brow, lifted mouth corner): he is no longer stern beside her
    tl.set(R.himSoft, { autoAlpha: 1 }, T.cutB + 0.5);
    tl.set(R.world, { visibility: 'visible' }, T.hand - 0.05);
    ft(R.cutB, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35, ease: 'power1.inOut' }, T.hand);

    /* ---- 31–35 · THE HANDOFF (tighter two-shot, gentle push) ---- */
    const H = P.camH, H2 = P.camH2, CU = P.camC, E = P.camE;
    ft(S, { camX: H.x, camY: H.y, camZ: H.z }, { camX: H2.x, camY: H2.y, camZ: H2.z, duration: T.smile - T.hand, ease: 'sine.out' }, T.hand);
    // he leans in and holds the flowers out to her (peak 1.25 → 5.6°: the hip split
    // stays clean) and keeps them there for a beat…
    const OFFER = rm ? 1.0 : 1.25;
    ft(S, { offer: rm ? 0.3 : 0.4 }, { offer: OFFER, duration: 1.45, ease: 'power2.inOut' }, T.reach);
    call(() => audio('setIntensity', 1, 1.5), T.reach);
    call(() => audio('cue', 'swell'), T.reach + 0.1);
    // …she lowers her hands from her heart (T.lower, through the in-between, with a
    // little settle), reaches out for them (T.reachOut: her live arms swing up through
    // the reach-1 and reach-2 poses) leaning toward him, and her far hand comes onto
    // the wrap just above his fists (S.grip; her wrist straightens as it closes).
    // Both hold it for a beat (her lean and sway held still)…
    if (!rm) ft(S, { herY: 0 }, { herY: P.U * 0.004, duration: 0.1, ease: 'sine.out', yoyo: true, repeat: 1 }, T.lower + 0.18);
    const LEAN_R = rm ? -2 : -4;
    ft(S, { herRot: 0 }, { herRot: LEAN_R, duration: T.grip - T.reachOut, ease: 'sine.inOut' }, T.reachOut);
    if (!rm) ft(S, { swayA: 1 }, { swayA: 0.12, duration: 0.6, ease: 'sine.inOut' }, T.reachOut);
    ft(S, { reach: 0 }, { reach: 1, duration: 0.5, ease: 'power2.inOut' }, T.reachOut);
    ft(S, { grip: 0 }, { grip: 1, duration: T.grip - 0.08 - (T.reachOut + 0.12), ease: 'sine.inOut' }, T.reachOut + 0.12);
    cut(S, { farF: 0 }, { farF: 1 }, T.touch);               // her hand comes onto the wrap: in front of it
    // …then he lets go and she draws them in: the bouquet rides on her far hand (IK in
    // liveArms: its palm stays on the wrap) along a short, low pass, turning toward
    // her on the way; her near hand comes up to its neck; she straightens up with it
    ft(S, { bq: 0 }, { bq: 1, duration: T.pass, ease: 'power1.inOut' }, T.rel);
    ft(S, { nearA: 0 }, { nearA: 1, duration: T.pass * 0.6, ease: 'sine.inOut' }, T.rel + T.pass * 0.4);
    cut(S, { nearF: 0 }, { nearF: 1 }, T.rel + T.pass * 0.4);
    ft(S, { herRot: LEAN_R }, { herRot: rm ? 0.4 : 1.1, duration: 1.0, ease: 'sine.inOut' }, T.rel + 0.05);
    // his hands let go and settle back (upright, just a hint of lean left: he clears
    // her close-up sooner); his hands overlay drops once the wrap is clear of his
    // fingers (render: q ≥ .6), so the bouquet never pops in front of them
    ft(S, { offer: OFFER }, { offer: rm ? 0.15 : 0.2, duration: 2.0, ease: 'sine.inOut' }, T.rel + 0.04);
    call(() => burstFlip(), T.rel + 0.6 * T.pass);                          // at the narrowest point of the turn
    ft(S, { bloom: 0 }, { bloom: 0.5, duration: 1.0, ease: 'sine.inOut' }, T.land - 1.3);
    ft(S, { bloom: 0.5 }, { bloom: 0.85, duration: 0.45, ease: 'power2.out' }, T.land - 0.3);
    ft(S, { bloom: 0.85 }, { bloom: 0.32, duration: 2.6, ease: 'sine.inOut' }, T.land + 0.15);
    // (as it lands the live arms are exactly her2-hold-arms — HERK swaps to the
    // drawing at T.land - 0.03, under the landing sparkle — then her eyes close in joy)
    call(() => audio('cue', 'chime'), T.land - 0.1);
    call(() => burstHandoff(), T.land);
    // (her head's petal hole is on since the two-shot); in the close-up also the words
    ft(S, { holeW: 0 }, { holeW: 1, duration: 0.8, ease: 'sine.inOut' }, T.line1 - 0.8);
    call(() => fxDensity(T.land), T.land);
    ft(S, { flare: 0.25 }, { flare: 1, duration: 0.6, ease: 'power2.out' }, T.land - 0.2);
    ft(S, { flare: 1 }, { flare: 0.35, duration: 3.0, ease: 'sine.inOut' }, T.land + 0.4);
    ft(R.herHalo, { opacity: 1, scale: 1.25 }, { opacity: 1, scale: 1.5, duration: 0.9, ease: 'power2.out' }, T.land - 0.1);
    ft(R.herHalo, { opacity: 1, scale: 1.5 }, { opacity: 0.85, scale: 1.3, duration: 2.6, ease: 'sine.inOut' }, T.land + 0.8);
    // a happy little bounce, then she sways with her flowers
    if (!rm) ft(S, { herY: 0 }, { herY: -P.U * 0.012, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 3 }, T.land + 0.12);
    const swayN = Math.ceil((T.end - T.rel - 1.05) / 1.7);
    ft(S, { herRot: rm ? 0.4 : 1.1 }, { herRot: rm ? -0.3 : -0.7, duration: 1.7, ease: 'sine.inOut', repeat: swayN, yoyo: true }, T.rel + 1.05);

    /* ---- 35–42 · slow push-in on HER, smiling with the flowers (the hero
       line resolves by ~40.5 and is held ~1.6 s before the pull) ---- */
    // starts from rest (the H → H2 move ends at rest: no lurch), the sideways reframe
    // leads (she settles clear of the words early, he leaves the frame in one clean
    // move), then the push-in creeps
    ft(S, { camX: H2.x }, { camX: CU.x, duration: T.pull - T.smile, ease: easeLead5 }, T.smile);
    ft(S, { camY: H2.y, camZ: H2.z }, { camY: CU.y, camZ: CU.z, duration: T.pull - T.smile, ease: easeLead4 }, T.smile);
    ft(R.scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.8, ease: 'sine.inOut' }, T.line1 - 0.7);
    tl.set(R.words, { autoAlpha: 1 }, T.line1 - 0.05);
    ft(R.l1Words, { autoAlpha: 0, y: 14, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out', stagger: 0.14 }, T.line1);
    ft(R.l2, { autoAlpha: 0, scale: 0.94, filter: 'blur(12px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 2.0, ease: 'power3.out' }, T.line2);
    call(() => audio('cue', 'sparkle'), T.line2 + 0.2);
    call(() => burstLove(10), T.line1 + 0.4);
    call(() => burstLove(8), T.line2 + 0.6);
    call(() => burstLove(7), T.line2 + 2.2);
    // she blinks now and then in her close-up (BLINKS), and as "Always for you."
    // resolves she giggles: the laughing face, little shoulder bounces
    if (R.herRig) {
      cut(S, { laugh: 0 }, { laugh: 1 }, T.giggle);              // (in / out through closed eyes: BLINKS)
      cut(S, { laugh: 1 }, { laugh: 0 }, T.giggle + 0.95);
      if (!rm) ft(S, { herY: 0 }, { herY: -P.U * 0.0045, duration: 0.11, ease: 'sine.inOut', yoyo: true, repeat: 5 }, T.giggle + 0.03);
    }

    /* ---- 42–45 · pull back: the two of them under the arch ----
       the pull lands on the wide two-shot by 45.5 (both fully in frame while
       the glow is still faint), then keeps easing out very slowly */
    const tPull = 3.4;
    ft(S, { camX: CU.x, camY: CU.y, camZ: CU.z }, { camX: E.x, camY: E.y, camZ: E.z, duration: tPull, ease: 'power2.inOut' }, T.pull);
    ft(S, { camZ: E.z }, { camZ: E.z * (rm ? 0.99 : 0.95), duration: T.end - T.pull - tPull, ease: 'sine.out' }, T.pull + tPull);
    ft(R.words, { autoAlpha: 1 }, { autoAlpha: 0, duration: 1.0, ease: 'power1.in' }, T.pull);
    ft(R.scrim, { autoAlpha: 1 }, { autoAlpha: 0, duration: 1.4, ease: 'sine.inOut' }, T.pull);
    ft(S, { bloom: 0.32 }, { bloom: 0, duration: 1.6, ease: 'sine.inOut' }, T.pull);
    ft(S, { hole: 1, holeW: 1 }, { hole: 0, holeW: 0, duration: 1.6, ease: 'sine.inOut' }, T.pull + 0.6);
    call(() => burstLove(9), T.pull + 1.2);

    /* ---- 45–48 · glow, letterbox opens, on to stage 4 ---- */
    ft(R.glow, { autoAlpha: 0 }, { autoAlpha: 1, duration: T.end - T.glow - 0.15, ease: 'sine.in' }, T.glow);
    ft(R.skip, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, ease: 'sine.in' }, T.glow);
    ft(R.barTop, { yPercent: 0 }, { yPercent: -101, duration: 1.8, ease: 'expo.inOut' }, T.glow + 0.5);
    ft(R.barBot, { yPercent: 0 }, { yPercent: 101, duration: 1.8, ease: 'expo.inOut' }, T.glow + 0.5);
    call(() => audio('setIntensity', 0.7, 3), T.glow + 1);
    call(finish, T.end);

    if (rm) tl.timeScale(1.2);
    return tl;
  }

  /* -------------------------------------------------------- particle FX */
  function burstArrival() {
    if (!fx || !L) return;
    const p = toScreen((L.D + L.xHer) / 2, L.groundY - 0.62 * L.U, 1);
    fx.burst(p.x, p.y, { type: 'petals', count: 26, spread: 1.1 });
    fx.burst(p.x, p.y, { type: 'hearts', count: 14, spread: 0.55, angle: -Math.PI / 2, scale: 0.85 });
    fx.burst(p.x, p.y - L.U * 0.2, { type: 'sparkles', count: 16, spread: 0.7 });
  }
  /** Screen point on the bouquet (dy, in U, moves it toward the flower heads). */
  function bqScreen(dy, dx) {
    return toScreen(L.bqX + (dx || 0) * L.U, L.bqY - (dy || 0) * L.U, 1);
  }
  /** Hearts rise from both sides of her (never straight up through her smile). */
  function heartsBeside(dy, dx, o) {
    const n = o.count, a = Math.ceil(n / 2);
    [[-dx, -0.4, a], [dx, 0.4, n - a]].forEach(([ox, tilt, c]) => {
      const p = bqScreen(dy, ox);
      if (c > 0) fx.burst(p.x, p.y, Object.assign({}, o, { type: 'hearts', count: c, angle: -Math.PI / 2 + tilt }));
    });
  }
  function burstFlip() {                       // the turn-around in mid-air
    if (!fx || !L || L.bqX == null) return;
    const p = bqScreen(0.04);
    fx.burst(p.x, p.y, { type: 'sparkles', count: 16, spread: 0.45 });
  }
  function burstHandoff() {                    // the flowers land in her arms
    if (!fx || !L || L.bqX == null) return;
    heartsBeside(0.1, 0.12, { count: 16, spread: 0.6, scale: 0.95 });
    // petals + sparkles fan out sideways (a little downward), never up over her chin
    [[-1, Math.PI - 0.22], [1, 0.22]].forEach(([sd, ang]) => {
      const p = bqScreen(0.02, sd * 0.07);
      fx.burst(p.x, p.y, { type: 'petals', count: 11, spread: 0.8, angle: ang });
      fx.burst(p.x, p.y, { type: 'sparkles', count: 9, spread: 0.55, angle: ang - sd * 0.15 });
    });
  }
  function burstLove(n) {                      // a few hearts drifting up while she smiles
    if (!fx || !L || L.bqX == null) return;
    heartsBeside(0.12, 0.17, { count: n, spread: 0.38, scale: 0.8, life: 1.5 });
  }

  /** Fewer ambient petals / fireflies once the flowers are in her arms (her
      close-up stays clean). Applied at the landing burst, which hides the drop. */
  function fxDensity(t) {
    if (fx) fx.setDensity(t >= T.land ? 0.5 : 1);
  }

  /* ------------------------------------------------- walk strips (decode) */
  function loadStrips() {
    [['start', WK.start.src], ['cycle', WK.cycle.src], ['stop', WK.stop.src]].forEach(([k, src]) => {
      if (WIMG[k]) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { if (active) { R.walk._key = ''; render(); } };
      img.src = WD + src;
      WIMG[k] = img;
    });
  }
  /** Decode every strip (and draw each once, so the first walk frame never
      waits on a decode / texture upload). Never rejects. */
  function decodeStrips() {
    loadStrips();
    const imgs = Object.keys(WIMG).map((k) => WIMG[k]);
    const one = (img) => new Promise((res) => {
      const wait = () => {
        if (img.complete) return res();
        img.addEventListener('load', () => res(), { once: true });
        img.addEventListener('error', () => res(), { once: true });
      };
      if (img.decode) img.decode().then(() => res(), wait);
      else wait();
    });
    // her drawings too: a pose / plate flipped in for the first time must not wait on a decode
    const p = Promise.all(imgs.map(one).concat((R.herImgs || []).map(one))).then(() => {
      try {
        const g = R.walk.getContext('2d');
        imgs.forEach((img) => { if (stripOk(img)) g.drawImage(img, 0, 0, WK.cellW, WK.cellH, 0, 0, 2, 4); });
        g.clearRect(0, 0, R.walk.width, R.walk.height);
      } catch (e) { /* warm-up only */ }
      R.walk._key = '';
      p._done = true;
      if (active) render();
    });
    return p;
  }
  /** Timeline call on the title card: if the strips are not decoded yet, hold
      the film there (the title simply stays a little longer), max ~8 s. */
  function holdForStrips() {
    if (!walkReady || walkReady._done || !tl) return;
    gated = true;
    tl.pause();
    const go = () => {
      if (!gated) return;
      gated = false;
      if (active && tl) tl.play();
    };
    walkReady.then(go);
    setTimeout(go, 8000);
  }

  function finish() {
    ended = true;
    if (Love.current && Love.current.index === 3 && !Love.busy) Love.next();
  }

  /* ------------------------------------------------------------ resize */
  function onResize() {
    if (!active || !root) return;
    const W = root.clientWidth, H = root.clientHeight;
    if (L && Math.abs(W - L.W) < 2 && Math.abs(H - L.H) < 2) return;
    const t = tl ? tl.time() : 0;
    const wasPaused = tl ? tl.paused() : false;
    if (tl) tl.kill();
    layout();
    tl = buildTimeline();
    tl.pause(t);
    if (!wasPaused) tl.play();
    render();
  }

  function teardown() {
    active = false;
    gated = false;
    if (tl) { tl.kill(); tl = null; }
    gsap.ticker.remove(render);
    if (fx) { fx.destroy(); fx = null; }
    if (offResize) { offResize(); offResize = null; }
    gsap.killTweensOf(R.glow);
  }

  /* ===================================================================
     STAGE CONTRACT
     =================================================================== */
  Love.register({
    index: 3,
    id: 'stage3',
    transition: 'black',

    init(el) {
      el.innerHTML = template();
      root = el.querySelector('.s3');
      const q = (s) => root.querySelector(s);
      Object.assign(R, {
        world: q('.s3-world'), sky: q('.s3-sky'), dusk: q('.s3-dusk'), sun: q('.s3-sun'), rays: q('.s3-rays'),
        flare: q('.s3-flare'), flareCore: q('.s3-flare__core'), groundArt: q('.s3-ground-art'), front: q('.s3-front'), archGlow: q('.s3-archglow'),
        her: q('.s3-her'), herHalo: q('.s3-her__halo'), herIdle: q('.s3-her__idle'),
        herSmile: q('.s3-her__smile'), herBlink: q('.s3-her__blink'),
        herPlate: q('.s3-her__plate'), plLook: q('.s3-her__pl--look'), plBlink: q('.s3-her__pl--blink'), plLaugh: q('.s3-her__pl--laugh'),
        herHands: q('.s3-herhands'), herHandsIdle: q('.s3-herhands__idle'), herHandsImg: q('.s3-herhands__img'),
        armFar: q('.s3-herhands .s3-herarm--far'), armNear: q('.s3-herhands .s3-herarm--near'),
        armFarB: q('.s3-herarms-back .s3-herarm--far'), armNearB: q('.s3-herarms-back .s3-herarm--near'),
        cutH: q('.s3-cut--her'), cutHDolly: q('.s3-cut--her .s3-cut__dolly'), cutHBust: q('.s3-cut--her .s3-cut__bust'),
        cutHB1: q('.s3-cut__b1'), cutHB2: q('.s3-cut__b2'), cutHB3: q('.s3-cut__b3'), cutHBokeh: q('.s3-cut--her .s3-cut__bokeh'), cutHBloom: q('.s3-cut--her .s3-cut__bloom'),
        him: q('.s3-him'), himHaze: q('.s3-him__haze'), walk: q('.s3-him__walk'), himStand: q('.s3-him__stand'),
        himUpper: q('.s3-him__upper'), himFootNear: q('.s3-him__foot--near'), himFootFar: q('.s3-him__foot--far'),
        himFull: Array.from(root.querySelectorAll('.s3-him__full')), himEmpty: Array.from(root.querySelectorAll('.s3-him__empty')), himSoft: q('.s3-him__soft'),
        bq: q('.s3-bq'), bqA: q('.s3-bq__a'), bqB: q('.s3-bq__b'),
        hands: q('.s3-hands'), handsUpper: q('.s3-hands__upper'),
        cutA: q('.s3-cut--a'), cutADolly: q('.s3-cut--a .s3-cut__dolly'), cutAFace: q('.s3-cut--a .s3-cut__face'), cutABokeh: q('.s3-cut--a .s3-cut__bokeh'),
        cutB: q('.s3-cut--b'), cutBDolly: q('.s3-cut--b .s3-cut__dolly'), cutBFace: q('.s3-cut--b .s3-cut__face'), cutBBokeh: q('.s3-cut--b .s3-cut__bokeh'), cutBBloom: q('.s3-cut--b .s3-cut__bloom'),
        bloom: q('.s3-bloom'), scrim: q('.s3-scrim'),
        fxCanvas: q('.s3-fx'), leakA: q('.s3-leak--a'), leakB: q('.s3-leak--b'), flash: q('.s3-flash'), glow: q('.s3-glow'), black: q('.s3-black'),
        title: q('.s3-title'), titleInner: q('.s3-title__inner'), eyebrow: q('.s3-title__eyebrow'), rose: q('.s3-rose'),
        words: q('.s3-words'), l2: q('.s3-words__l2'),
        barTop: q('.s3-bar--top'), barBot: q('.s3-bar--bot'), skip: q('.s3-skip'),
      });
      R.herPoses = Array.from(root.querySelectorAll('.s3-her__p'));
      R.herRig = R.herPoses.length > 1;          // Sazzi's rig (a custom sprite is one still)
      // every image of hers that the film flips to: decoded before the walk (enter)
      R.herImgs = Array.from(root.querySelectorAll('.s3-her img, .s3-herhands img, .s3-cut--her img, .s3-bq img'));
      R.birdEls = Array.from(root.querySelectorAll('.s3-bird'));
      R.beats = Array.from(root.querySelectorAll('.s3-beat'));
      layers = Array.from(root.querySelectorAll('.s3-layer')).map((n) => ({ el: n, p: parseFloat(n.dataset.p), k: n.dataset.k, last: '' }));

      // title: letter-by-letter (rose svg stays whole)
      const l1 = q('.s3-title__l1'), l2 = q('.s3-title__l2t');
      R.titleLines = [l1, q('.s3-title__l2') || R.rose].filter(Boolean);
      R.titleChars = [].concat(util.split(l1, { chars: true }).chars, l2 ? util.split(l2, { chars: true }).chars : []);
      R.l1Words = util.split(q('.s3-words__l1')).words;
      paintRays();
      paintFlare();
      loadStrips();

      R.skip.addEventListener('click', () => {
        if (!active || Love.busy) return;
        Love.next();
      });
    },

    enter() {
      ended = false;
      active = true;
      gated = false;
      walkReady = decodeStrips();             // ~8 s before he walks; the title card waits if needed
      layout();
      const small = L.portrait || L.W < 700;
      fx = Love.Particles.create(R.fxCanvas, {
        emitters: [
          { type: 'petals', count: small ? 18 : 28, size: [7, 15] },
          { type: 'fireflies', count: small ? 14 : 22, size: [3, 8], opacity: [0.3, 0.85], colors: ['#ffd88a', '#ffc46b', '#ffe7b3', '#ffd0a8'] },
        ],
        wind: 30,
      });
      fx.start();
      tl = buildTimeline();
      gsap.ticker.add(render);
      offResize = util.onResize(onResize, 220);
      tl.play(0);
      render();
    },

    leave() {
      return new Promise((resolve) => {
        const done = () => { teardown(); resolve(); };
        if (!active || ended || !tl) return done();
        active = false;
        // skipped mid-scene: a short warm glow so the hand-off to stage 4 is graceful
        tl.pause();
        gsap.fromTo(R.glow, { autoAlpha: gsap.getProperty(R.glow, 'opacity') || 0 },
          { autoAlpha: 1, duration: Love.reducedMotion ? 0.2 : 0.6, ease: 'power1.in', onComplete: done });
      });
    },

    seek(t) {
      if (!tl) return;
      gated = false;
      const tt = Math.max(0, +t || 0);
      tl.pause(tt);
      fxDensity(tt);
      render();
    },

    // debug helpers (test tools only): the film clock, and play on from time t
    time() { return tl ? tl.time() : 0; },
    dbg() {
      if (!S || !L) return null;
      const r = (a) => a && a.map((v) => Math.round(v * 100) / 100);
      const g = L.bqGrip ? herCanvas(L.bqGrip.far[0], L.bqGrip.far[1]) : null;
      return { t: S.clk, bq: S.bq, grip: S.grip, nearA: S.nearA, herRot: HL.rot, far: r(ARMP.far), near: r(ARMP.near),
        farPalm: r(palmAt(ARM.far, ARMP.far)), farTarget: r(g), grip1: L.grip1,
        head: (() => { const f = herPt(154, 78), p = toScreen(f.x, f.y, 1); return { x: p.x, y: p.y, z: p.z * L.U }; })() };
    },
    playFrom(t) {
      if (!tl || !active) return;
      gated = false;
      const tt = Math.max(0, +t || 0);
      fxDensity(tt);
      tl.play(tt);
    },
  });
})();
