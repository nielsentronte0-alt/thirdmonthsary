/* ==========================================================================
   stage4.js — "I Choose You, Always."  (the finale)

   The sunset of stage 3 cools into twilight: a camera pull-back reveals the
   two of us from behind on a moonlit hill of roses, under a crescent moon,
   stars and a faint pink nebula. The bouquet is hers now (he gave it to her
   at the end of stage 3): she (Sazzi, her2-back-hold.webp — her right hand
   tucked in front of her) holds it low at her right hip, blooms tipped
   outward past her side. The title and the closing lines arrive one
   by one, then "One More Thing…" opens a wax-sealed letter. Closing the
   letter ends the film: a hand-drawn heart, petals, and "Watch it again".

   Performance notes
   - Stars are drawn ONCE into two static canvases; twinkle = CSS opacity on
     those layers + a few CSS glints. No per-frame star loop.
   - One Love.Particles system for the scene (fireflies + petals), one for
     the letter overlay (only while it is open). Both destroyed in leave().
   - Everything GSAP lives in a gsap.context → leave() reverts it all.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.Love || !window.gsap) return;
  const { util } = Love;
  const TAU = Math.PI * 2;
  // her stage-4 sprite (also in main.js's preload list) — warm the cache now so she never pops in
  try { const im = new Image(); im.decoding = 'async'; im.src = 'assets/character/her2-back-hold.webp'; } catch (e) { /* ignore */ }

  /* -------------------------------------------------------------- content */
  const DEF = {
    eyebrow: 'Under the same sky',
    title: 'I Choose You, Always.',
    lines: [
      'Another month with you, another month I’m grateful for.',
      'Thank you for being part of my life.',
      'I love you, today, tomorrow, and every month after this. ❤️',
    ],
    cta: 'One More Thing…',
    replay: 'Watch it again',
    reread: 'Read the letter again',
    back: 'Back to the stars',
    occasion: 'Our {nth} monthsary',
    letter: {
      greeting: 'To my love,',
      paragraphs: ['Thank you for being you.'],
      signoff: 'Forever yours,',
      signature: '{hisName}',
    },
  };
  const conf = () => (Love.config && Love.config.stage4) || {};
  function pick(key) {
    const v = conf()[key];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return DEF[key];
    return v;
  }
  function letterConf() {
    const l = conf().letter || {};
    return {
      greeting: l.greeting || DEF.letter.greeting,
      paragraphs: l.paragraphs && l.paragraphs.length ? l.paragraphs : DEF.letter.paragraphs,
      signoff: l.signoff || DEF.letter.signoff,
      signature: l.signature || DEF.letter.signature,
    };
  }
  function endingCaption() {
    const c = conf();
    if (c.ending) return { a: c.ending, b: '' };
    const s1 = (Love.config && Love.config.stage1) || {};
    return {
      a: s1.title || 'Happy {nth} Monthsary,',
      b: s1.titleScript || '{herName}',
    };
  }
  const HEART_RE = /\s*(?:❤️|❤|♥️|♥|💕|💖|💗|💓|💞)\s*$/u;

  /* -------------------------------------------------------------- helpers */
  function seeded(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const smooth = (a, b, x) => { const t = util.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const f1 = (n) => (Math.round(n * 10) / 10).toString();
  const audio = (fn, ...a) => { try { Love.audio && Love.audio[fn] && Love.audio[fn](...a); } catch (e) { /* never break the film */ } };

  /* irregular wax-blob outline (viewBox 0 0 100 100) */
  function waxPath(seed) {
    const rnd = seeded(seed), n = 20, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, r = 44.5 + (rnd() - 0.5) * 6;
      pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let m = mid(pts[n - 1], pts[0]);
    let d = `M${f1(m[0])} ${f1(m[1])}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = mid(pts[i], pts[(i + 1) % n]);
      d += `Q${f1(p[0])} ${f1(p[1])} ${f1(q[0])} ${f1(q[1])}`;
    }
    return d + 'Z';
  }

  /* torn / deckled paper edge as a clip-path polygon (px jitter, % spacing) */
  function deckle(seed) {
    const rnd = seeded(seed), N = 90;
    let w = 1;
    const J = () => { w = util.clamp(w + (rnd() - 0.5) * 1.3, 0.2, 2.1); return (w + rnd() * 0.5).toFixed(2); };
    const P = (i) => ((i / N) * 100).toFixed(2);
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(`${P(i)}% ${J()}px`);
    for (let i = 1; i <= N; i++) pts.push(`calc(100% - ${J()}px) ${P(i)}%`);
    for (let i = N - 1; i >= 0; i--) pts.push(`${P(i)}% calc(100% - ${J()}px)`);
    for (let i = N - 1; i >= 1; i--) pts.push(`${J()}px ${P(i)}%`);
    return `polygon(${pts.join(',')})`;
  }

  /* tiny 5-petal wildflower heads for the <symbol> */
  function wildHeads(list) {
    return list.map(([x, y, s]) => {
      let g = '';
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * TAU) / 5;
        g += `<circle cx="${f1(x + Math.cos(a) * s * 1.2)}" cy="${f1(y + Math.sin(a) * s * 1.2)}" r="${s}" style="fill:var(--wild,#f2c9d5)"/>`;
      }
      return g + `<circle cx="${x}" cy="${y}" r="${f1(s * 0.8)}" style="fill:var(--wild-c,#d9b26f)"/>`;
    }).join('');
  }

  const HEART_D = 'M60 104C43 92 10 72 10 41 10 23 23 11 38 11c10 0 18 6 22 15 4-9 12-15 22-15 15 0 28 12 28 30 0 31-33 51-50 63z';
  const HEART_SM = 'M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z';

  /* ------------------------------------------------------- SVG library */
  const ST = 'style="fill:var(--stem,#12060b)"';
  const LF = 'style="fill:var(--leaf,#1b0a12);stroke:var(--rim,none);stroke-width:.8"';
  const SYMBOLS = `
  <symbol id="s4-sym-bloom" viewBox="0 0 40 40">
    <path d="M4 22C2 11 10 4 20 6c10-2 18 5 16 16-2 10-9 15-16 15S6 32 4 22z" style="fill:var(--bloom,#8f1736)"/>
    <path d="M4 22c2 10 9 15 16 15s14-5 16-15c-5 6-10 8-16 8S9 28 4 22z" style="fill:var(--bloom-dark,#4a0a1d)"/>
    <path d="M7.5 15.5C11 8 29 8 32.5 15.5 26 12.5 14 12.5 7.5 15.5z" style="fill:var(--bloom-hi,#e46a86)"/>
    <path d="M13.5 20.5c-1-6 11-8.5 13-2.5 1.2 4-5 6.5-7.5 3.5" style="fill:none;stroke:var(--bloom-dark,#4a0a1d);stroke-width:1.6;stroke-linecap:round"/>
    <path d="M16.5 15.8c2.5-2 6.5-2 8.5 0" style="fill:none;stroke:var(--bloom-hi,#e46a86);stroke-width:1.1;stroke-linecap:round;opacity:.8"/>
    <path d="M7 25c3 6 8 8.5 13 8.5" style="fill:none;stroke:var(--bloom-hi,#e46a86);stroke-width:1;stroke-linecap:round;opacity:.45"/>
  </symbol>
  <symbol id="s4-sym-rose" viewBox="0 0 60 200">
    <path d="M30 200C28 166 33 126 30 58" style="fill:none;stroke:var(--stem,#12060b);stroke-width:2.6;stroke-linecap:round"/>
    <path d="M31 150c7-12 17-16 24-26-11-2-20 6-24 26z" ${LF}/>
    <path d="M30 112c-8-10-18-12-25-20 11-4 21 4 25 20z" ${LF}/>
    <path d="M30 66c-6-1-10-5-13-11 6 2 10 4 13 6 3-2 7-4 13-6-3 6-7 10-13 11z" ${ST}/>
    <use href="#s4-sym-bloom" x="9" y="20" width="42" height="42"/>
  </symbol>
  <symbol id="s4-sym-bud" viewBox="0 0 40 160">
    <path d="M20 160C19 130 22 90 20 44" style="fill:none;stroke:var(--stem,#12060b);stroke-width:2.2;stroke-linecap:round"/>
    <path d="M21 118c6-9 12-12 17-19-8-1-15 5-17 19z" ${LF}/>
    <path d="M20 28c-7 7-8 15-1 20 7-5 7-13 1-20z" style="fill:var(--bloom,#8f1736)"/>
    <path d="M20 28c3 7 3 14-1 20 7-5 7-13 1-20z" style="fill:var(--bloom-dark,#4a0a1d)"/>
    <path d="M18 31c-2 3-3 6-2 9" style="fill:none;stroke:var(--bloom-hi,#e46a86);stroke-width:1;stroke-linecap:round"/>
    <path d="M20 52c-5-1-8-5-9-10 4 2 7 4 9 5 2-1 5-3 9-5-1 5-4 9-9 10z" ${ST}/>
  </symbol>
  <symbol id="s4-sym-tulip" viewBox="0 0 50 180">
    <path d="M25 180C24 150 27 108 25 56" style="fill:none;stroke:var(--stem,#12060b);stroke-width:2.4;stroke-linecap:round"/>
    <path d="M25 172C12 150 7 122 10 92c8 18 14 44 15 80z" ${LF}/>
    <path d="M25 160c11-20 17-42 15-62-7 18-13 38-15 62z" ${LF}/>
    <path d="M12 32c-1-12 3-20 7-23 2 6 4 10 6 12 2-2 4-6 6-12 4 3 8 11 7 23-1 14-6 24-13 24S13 46 12 32z" style="fill:var(--bloom,#b23a5c)"/>
    <path d="M25 21c3 9 3 22 0 35 7 0 12-10 13-24 1-12-3-20-7-23-2 6-4 10-6 12z" style="fill:var(--bloom-dark,#5f1430);opacity:.75"/>
    <path d="M15.5 30c1-8 3-13 5-16" style="fill:none;stroke:var(--bloom-hi,#f3a4b8);stroke-width:1.2;stroke-linecap:round"/>
  </symbol>
  <symbol id="s4-sym-wild" viewBox="0 0 60 120">
    <path d="M30 120C28 92 22 62 17 32M30 120c2-34 8-66 12-96M30 120c0-24 0-44 1-66" style="fill:none;stroke:var(--stem,#12060b);stroke-width:1.3;stroke-linecap:round"/>
    <path d="M29 96c-7-5-12-5-17-9 7-3 13 0 17 9zM31 84c6-6 10-6 15-11-7-1-12 3-15 11z" ${LF}/>
    ${wildHeads([[17, 30, 3.1], [42, 22, 2.7], [31, 52, 2.9]])}
  </symbol>
  <symbol id="s4-sym-grass" viewBox="0 0 60 120">
    <path d="M28 120C26 84 18 52 4 18c18 30 28 64 30 102z" ${LF}/>
    <path d="M30 120c0-40 6-76 22-112-10 38-15 74-16 112z" ${ST}/>
    <path d="M24 120c-4-26-12-46-22-62 14 14 24 34 28 62z" ${ST}/>
    <path d="M34 120c4-28 12-48 24-64-10 18-16 38-18 64z" ${LF}/>
    <path d="M29 120c-1-30 1-60 6-94 0 34-1 64 0 94z" ${LF}/>
  </symbol>
  <symbol id="s4-sym-bush" viewBox="0 0 120 64">
    <path d="M2 64c2-14 10-22 20-24-2-10 6-18 16-16 4-10 16-14 26-8 8-8 22-6 28 4 12-2 22 6 22 18 4 2 6 12 4 26z" ${LF}/>
    <path d="M14 46c6-6 14-6 18-2-6 0-12 2-18 2zM70 30c6-4 14-4 18 0-6 1-12 1-18 0zM92 46c6-4 12-4 16 0-6 1-11 1-16 0z" style="fill:var(--stem,#12060b)"/>
    <use href="#s4-sym-bloom" x="10" y="20" width="30" height="30"/>
    <use href="#s4-sym-bloom" x="44" y="8" width="34" height="34"/>
    <use href="#s4-sym-bloom" x="80" y="22" width="28" height="28"/>
  </symbol>`;

  const VB = { rose: [60, 200], bud: [40, 160], tulip: [50, 180], wild: [60, 120], grass: [60, 120], bush: [120, 64] };
  const PAL = {
    red: '--bloom:#8f1736;--bloom-dark:#4a0a1d;--bloom-hi:#e46a86',
    rose: '--bloom:#b23a5c;--bloom-dark:#5f1430;--bloom-hi:#f3a4b8',
    blush: '--bloom:#d98fa5;--bloom-dark:#8c3f58;--bloom-hi:#fde3ea',
    deep: '--bloom:#6e1029;--bloom-dark:#360614;--bloom-hi:#c94d6c',
  };
  /* [type, left %, height %, palette, sway] — heights are % of the cluster box */
  const FORE_L = [
    ['grass', -6, 52, 0, 1], ['rose', -1, 100, 'deep', 1], ['grass', 8, 70, 0, 1], ['tulip', 14, 84, 'rose', 1],
    ['bud', 24, 72, 'red', 1], ['grass', 29, 46, 0, 1], ['wild', 33, 56, 0, 1], ['rose', 41, 76, 'red', 1],
    ['grass', 50, 36, 0, 1], ['wild', 56, 38, 0, 1], ['bud', 63, 46, 'blush', 1], ['grass', 70, 26],
  ];
  const FORE_R = [
    ['grass', 22, 28], ['bud', 27, 48, 'rose', 1], ['wild', 34, 40, 0, 1], ['grass', 41, 38, 0, 1],
    ['rose', 47, 78, 'blush', 1], ['wild', 56, 58, 0, 1], ['grass', 62, 48, 0, 1], ['bud', 66, 70, 'deep', 1],
    ['tulip', 75, 88, 'red', 1], ['grass', 82, 72, 0, 1], ['rose', 87, 100, 'red', 1], ['grass', 97, 54, 0, 1],
  ];
  const FEET = [
    ['grass', -2, 70], ['bush', 0, 50, 'deep'], ['rose', 12, 92, 'blush', 1], ['wild', 20, 66],
    ['bush', 24, 40, 'red'], ['grass', 42, 44], ['bush', 48, 42, 'blush'], ['wild', 64, 60],
    ['rose', 72, 84, 'red', 1], ['bush', 78, 48, 'rose'], ['grass', 92, 62],
  ];
  /* meadow on the hill's slopes: [type, x % of the near layer, height in couple-heights, palette, sway]
     — bottoms are laid onto the hill curve in JS (layoutMeadow) */
  const MEADOW = [
    ['bush', 7, 0.13, 'red'], ['rose', 11, 0.2, 'rose', 1], ['wild', 15, 0.15], ['bush', 19, 0.11, 'blush'],
    ['grass', 23, 0.12], ['rose', 27, 0.17, 'red', 1], ['bush', 31, 0.1, 'deep'], ['wild', 35, 0.12],
    ['bush', 65, 0.1, 'rose'], ['wild', 68, 0.12], ['rose', 72, 0.17, 'blush', 1], ['grass', 76, 0.12],
    ['bush', 80, 0.11, 'red'], ['wild', 85, 0.15], ['rose', 89, 0.2, 'red', 1], ['bush', 93, 0.13, 'deep'],
    /* further down the hill face (6th value = depth 0..1 below the surface) */
    ['rose', 15, 0.17, 'red', 1, 0.34], ['bush', 23, 0.11, 'rose', 0, 0.22], ['wild', 30, 0.14, 0, 1, 0.42],
    ['tulip', 36, 0.15, 'blush', 1, 0.28], ['bush', 42, 0.11, 'deep', 0, 0.62], ['grass', 47, 0.12, 0, 1, 0.48],
    ['grass', 54, 0.12, 0, 1, 0.56], ['bush', 59, 0.11, 'red', 0, 0.4], ['tulip', 65, 0.15, 'rose', 1, 0.26],
    ['wild', 71, 0.14, 0, 1, 0.5], ['bush', 78, 0.11, 'blush', 0, 0.3], ['rose', 85, 0.17, 'deep', 1, 0.38],
  ];
  function flowers(list) {
    return list.map(([t, x, h, pal, sway]) =>
      `<svg class="s4-fl${sway ? ' s4-sway' : ''}" viewBox="0 0 ${VB[t][0]} ${VB[t][1]}" ` +
      `style="left:${x}%;--h:${h};--ar:${VB[t][0] / VB[t][1]};${PAL[pal] || ''}" aria-hidden="true" focusable="false">` +
      `<use href="#s4-sym-${t}"/></svg>`).join('');
  }

  function meadow() {
    return MEADOW.map(([t, x, k, pal, sway, d]) =>
      `<svg class="s4-fl s4-mfl${sway ? ' s4-sway' : ''}" viewBox="0 0 ${VB[t][0]} ${VB[t][1]}" data-x="${x}" data-k="${k}" data-d="${d || 0}" ` +
      `style="left:${x}%;--ar:${VB[t][0] / VB[t][1]};${PAL[pal] || ''}" aria-hidden="true" focusable="false">` +
      `<use href="#s4-sym-${t}"/></svg>`).join('');
  }

  /* distant ridge with tree clumps, generated in real px so trees never stretch */
  function ridgePath(W, H) {
    const rnd = seeded(5);
    const base = (x) => H * (0.36 + 0.045 * Math.sin((x / W) * 7 + 1.1) + 0.012 * Math.sin(x / 37 + 0.4));
    let d = `M0 ${H}L0 ${f1(base(0))}`;
    let x = 0;
    while (x < W) {
      const trees = Math.sin(x / 150 + 2) + Math.sin(x / 61) * 0.4 > 0.15;
      let w, h;
      if (!trees) { w = 14; h = 0; }
      else if (rnd() < 0.1) { w = 5 + rnd() * 3; h = 14 + rnd() * 10; }      // a lone cypress
      else { w = 8 + rnd() * 11; h = 3 + rnd() * 8; }                          // a rounded crown
      const nx = Math.min(W, x + w);
      if (h) d += `Q${f1(x + w / 2)} ${f1(base(x + w / 2) - h * 2)} ${f1(nx)} ${f1(base(nx))}`;
      else d += `L${f1(nx)} ${f1(base(nx))}`;
      x = nx;
    }
    return d + `L${W} ${H}Z`;
  }
  function layoutRidge() {
    if (!E.ridge) return;
    const W = Math.round(E.far.offsetWidth), H = Math.round(E.far.offsetHeight * 1.5);
    if (!W || !H) return;
    E.ridge.setAttribute('viewBox', `0 0 ${W} ${H}`);
    E.ridgePath.setAttribute('d', ridgePath(W, H));
  }

  /* near-hill surface lookup: x (0..1000) → y (0..300), from the path's cubics */
  const NEAR_SEGS = [
    [[0, 214], [150, 176], [290, 124], [418, 99]],
    [[418, 99], [456, 92], [480, 90], [500, 90]],
    [[500, 90], [520, 90], [544, 92], [582, 99]],
    [[582, 99], [710, 124], [850, 176], [1000, 214]],
  ];
  const NEAR_LUT = (() => {
    const pts = [];
    NEAR_SEGS.forEach(([a, b, c, d]) => {
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, u = 1 - t;
        pts.push([
          u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
          u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
        ]);
      }
    });
    return pts;
  })();
  function nearY(x) {
    const P = NEAR_LUT;
    if (x <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) {
      if (x <= P[i][0]) {
        const [x0, y0] = P[i - 1], [x1, y1] = P[i];
        return y0 + ((y1 - y0) * (x - x0)) / Math.max(1e-6, x1 - x0);
      }
    }
    return P[P.length - 1][1];
  }

  /* twinkling bright stars (DOM glints, CSS animated) + ground sparkle dots */
  function glints() {
    const rnd = seeded(7), out = [];
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? rnd() * 26 + 2 : 72 + rnd() * 26;
      out.push(`<i class="s4-glint" style="left:${f1(side)}%;top:${f1(4 + rnd() * 50)}%;--d:${f1(2.8 + rnd() * 3.2)}s;--dl:${f1(-rnd() * 6)}s;--s:${f1(0.6 + rnd() * 0.6)}"></i>`);
    }
    return out.join('');
  }
  function groundDots() {
    const rnd = seeded(11), out = [];
    for (let i = 0; i < 22; i++) {
      const x = 4 + rnd() * 92;
      const minTop = 40 + Math.abs(x - 50) * 0.55; // follow the hill's falling sides
      const top = minTop + rnd() * (96 - minTop);
      if (Math.abs(x - 50) < 9 && top < 52) continue;
      const s = 1.4 + rnd() * 1.8;
      out.push(`<i style="left:${f1(x)}%;top:${f1(top)}%;width:${f1(s)}px;height:${f1(s)}px;opacity:${f1(0.2 + rnd() * 0.4)}"></i>`);
    }
    return out.join('');
  }

  /* -------------------------------------------------------------- state */
  const E = {};               // element refs
  let root = null;
  let gctx = null;            // gsap.context for everything animated
  let tl = null;              // master (pre-letter) timeline
  let fxScene = null, fxLetter = null;
  let offResize = null, io = null;
  let state = 'idle';         // idle | sky | envelope | opening | letter | closing | ended
  let ended = false;
  let reduced = false;
  let envIdle = null, endBeat = null;
  let envAt = 0;              // when the envelope was summoned (a fast double-tap must not dismiss it)
  let parallax = null;
  let lastFocus = null;
  let shootingOn = false;

  const run = (fn) => (gctx ? gctx.add(fn) : fn());

  /* ================================================================ build */
  function build(el) {
    root = el;
    const title = util.fill(pick('title'));
    const m = title.match(/^(.*\S)\s+(\S+)$/);
    const head = m ? m[1] : title, tail = m ? m[2] : '';
    const L = letterConf();
    const cap = endingCaption();
    const hint = util.isTouch ? 'Tap to open' : 'Click to open';

    el.innerHTML = `
<svg class="s4-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    ${SYMBOLS}
    <radialGradient id="s4-wax" cx="36%" cy="30%" r="78%">
      <stop offset="0" stop-color="#c94a68"/><stop offset=".42" stop-color="#8e1736"/><stop offset="1" stop-color="#4a0718"/>
    </radialGradient>
    <radialGradient id="s4-moon-g" cx="30%" cy="62%" r="80%">
      <stop offset="0" stop-color="#fffaf2"/><stop offset=".55" stop-color="#f8e8d4"/><stop offset="1" stop-color="#e6c7ad"/>
    </radialGradient>
    <mask id="s4-moon-m"><rect width="100" height="100" fill="#fff"/><circle cx="63" cy="37" r="39" fill="#000"/></mask>
    <linearGradient id="s4-ridge-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset=".2" stop-color="#7a3058"/><stop offset=".55" stop-color="#4a1a3c"/><stop offset="1" stop-color="#2a0d24"/>
    </linearGradient>
    <linearGradient id="s4-far-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset=".22" stop-color="#3a1232"/><stop offset=".5" stop-color="#1d0919"/><stop offset="1" stop-color="#0b0308"/>
    </linearGradient>
    <linearGradient id="s4-near-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset=".28" stop-color="#2a0e22"/><stop offset=".5" stop-color="#150611"/><stop offset="1" stop-color="#050103"/>
    </linearGradient>
    <linearGradient id="s4-heart-line" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0d9a8"/><stop offset=".55" stop-color="#f1a9b9"/><stop offset="1" stop-color="#e05a7a"/>
    </linearGradient>
    <radialGradient id="s4-heart-fill" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="#f8d6df" stop-opacity=".55"/><stop offset=".6" stop-color="#e05a7a" stop-opacity=".28"/><stop offset="1" stop-color="#7d1d3b" stop-opacity=".05"/>
    </radialGradient>
    <linearGradient id="s4-heart-sm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff9fb5"/><stop offset="1" stop-color="#d23a5e"/>
    </linearGradient>
  </defs>
</svg>

<div class="s4-scene">
  <div class="s4-world" role="img" aria-label="The two of us on a hill of roses under the moon and the stars, her bouquet in her hand">
    <div class="s4-sky">
      <div class="s4-sky__base"></div>
      <div class="s4-nebula"><i class="s4-nebula__a"></i><i class="s4-nebula__b"></i><i class="s4-nebula__c"></i></div>
      <div class="s4-stars">
        <canvas class="s4-stars__a"></canvas>
        <canvas class="s4-stars__b"></canvas>
        ${glints()}
      </div>
      <div class="s4-shoot"></div>
      <div class="s4-moon">
        <span class="s4-moon__glow"></span>
        <svg class="s4-moon__disc" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle cx="50" cy="50" r="40" fill="#cdb9de" opacity=".07"/>
          <circle cx="50" cy="50" r="40" fill="url(#s4-moon-g)" mask="url(#s4-moon-m)"/>
        </svg>
      </div>
      <div class="s4-horizon"></div>
      <div class="s4-afterglow"></div>
    </div>

    <div class="s4-land">
      <div class="s4-far">
        <svg class="s4-hill s4-hill--ridge" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="${ridgePath(1000, 300)}" fill="url(#s4-ridge-g)"/>
        </svg>
        <div class="s4-haze"></div>
        <svg class="s4-hill s4-hill--far" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M0 122C90 98 170 84 262 92s160 30 258 18 172-40 270-36 150 22 210 30V300H0z" fill="url(#s4-far-g)"/>
          <path d="M0 122C90 98 170 84 262 92s160 30 258 18 172-40 270-36 150 22 210 30" fill="none" stroke="rgba(244,170,186,.32)" stroke-width="1" vector-effect="non-scaling-stroke"/>
        </svg>
        <div class="s4-mist"></div>
      </div>
      <div class="s4-near">
        <svg class="s4-hill s4-hill--near" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M0 214C150 176 290 124 418 99c38-7 62-9 82-9s44 2 82 9c128 25 268 77 418 115v86H0z" fill="url(#s4-near-g)"/>
          <path d="M0 214C150 176 290 124 418 99c38-7 62-9 82-9s44 2 82 9c128 25 268 77 418 115" fill="none" stroke="rgba(255,198,214,.30)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
        </svg>
        <div class="s4-dots">${groundDots()}</div>
        <div class="s4-meadow">${meadow()}</div>
        <div class="s4-couple">
          <span class="s4-pool"></span>
          <img class="s4-him" src="assets/character/him-back-empty.webp" alt="" draggable="false" decoding="async">
          <span class="s4-her">
            <img class="s4-her__bq" src="assets/character/bouquet.webp" alt="" draggable="false" decoding="async">
            <img class="s4-her__img" src="assets/character/her2-back-hold.webp" alt="" draggable="false" decoding="async">
          </span>
          <span class="s4-couple__heart"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${HEART_SM}" fill="url(#s4-heart-sm)"/></svg></span>
          <div class="s4-feet"><span class="s4-feet__ground"></span>${flowers(FEET)}</div>
        </div>
      </div>
      <div class="s4-fores">
        <div class="s4-fore s4-fore--l">${flowers(FORE_L)}</div>
        <div class="s4-fore s4-fore--r">${flowers(FORE_R)}</div>
      </div>
    </div>
  </div>

  <canvas class="s4-fx" aria-hidden="true"></canvas>

  <div class="s4-copy">
    <p class="eyebrow s4-eyebrow">${util.text(pick('eyebrow'))}</p>
    <h2 class="display s4-title">
      <span class="s4-title__head">${util.escapeHTML(head)}</span>
      ${tail ? `<span class="s4-always"><span class="s4-always__glow" aria-hidden="true">${util.escapeHTML(tail)}</span><span class="s4-always__text gold-text">${util.escapeHTML(tail)}</span></span>` : ''}
    </h2>
    <div class="s4-body">
      <div class="s4-message">
        <div class="s4-lines"></div>
        <div class="s4-actions">
          <button class="btn s4-cta" type="button">${util.text(pick('cta'))}</button>
        </div>
      </div>
      <div class="s4-end">
        <div class="s4-end__heart">
          <span class="s4-end__glow"></span>
          <svg viewBox="0 0 120 116" aria-hidden="true" focusable="false">
            <path class="s4-end__fill" d="${HEART_D}" fill="url(#s4-heart-fill)"/>
            <path class="s4-end__line" d="${HEART_D}" pathLength="1" fill="none" stroke="url(#s4-heart-line)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="s4-end__caption"><span class="s4-end__a">${util.text(cap.a)}</span>${cap.b ? ` <span class="s4-end__b">${util.text(cap.b)}</span>` : ''}</p>
        <div class="s4-end__actions">
          <button class="btn btn--ghost s4-replay" type="button">${util.text(pick('replay'))}</button>
          <button class="s4-reread" type="button">${util.text(pick('reread'))}</button>
        </div>
      </div>
    </div>
  </div>

  <div class="s4-letter" role="dialog" aria-modal="true" aria-label="A letter for you" hidden>
    <div class="s4-letter__dim"></div>
    <div class="s4-env-wrap">
      <button class="s4-env" type="button" aria-label="Open the letter">
        <span class="s4-env__body">
          <span class="s4-env__halo"></span>
          <span class="s4-env__shadow"></span>
          <span class="s4-env__back"></span>
          <span class="s4-env__paper"><i></i><i></i><i></i><i></i></span>
          <svg class="s4-env__pocket" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d="M0 0L150 106 0 200z" fill="#ead5ba"/>
            <path d="M300 0L150 106 300 200z" fill="#e6cfb2"/>
            <path d="M0 200L139 98q11-8 22 0L300 200z" fill="#f5e6d1"/>
            <path d="M0 200L139 98q11-8 22 0L300 200" fill="none" stroke="rgba(110,64,36,.22)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
            <path d="M1 1L150 106M299 1L150 106" fill="none" stroke="rgba(110,64,36,.12)" stroke-width="1" vector-effect="non-scaling-stroke"/>
            <path d="M.5 0V199.5H299.5V0" fill="none" stroke="rgba(110,64,36,.18)" stroke-width="1" vector-effect="non-scaling-stroke"/>
          </svg>
          <span class="s4-env__flap-shadow"></span>
          <span class="s4-env__flap"><span class="s4-env__flap-face"></span><span class="s4-env__flap-liner"></span></span>
          <span class="s4-seal">
            <span class="s4-seal__half s4-seal__half--l">${sealSVG()}</span>
            <span class="s4-seal__half s4-seal__half--r">${sealSVG()}</span>
          </span>
        </span>
      </button>
      <p class="s4-env__hint">${hint}</p>
    </div>
    <canvas class="s4-letter__fx" aria-hidden="true"></canvas>
    <article class="s4-paper" aria-label="Letter">
      <span class="s4-paper__shadow"></span>
      <div class="s4-paper__sheet" style="clip-path:${deckle(4)}">
        <span class="s4-paper__fold s4-paper__fold--t"></span>
        <span class="s4-paper__fold s4-paper__fold--b"></span>
        <div class="s4-paper__scroll" tabindex="0">
          <div class="s4-paper__inner">
            <div class="s4-paper__head s4-lb">
              <svg class="s4-paper__orn" viewBox="0 0 160 18" aria-hidden="true" focusable="false">
                <path d="M4 9h52M104 9h52" stroke="#b8873f" stroke-width=".8" stroke-linecap="round" opacity=".7"/>
                <path d="M56 9c6 0 9-2 12-5M104 9c-6 0-9-2-12-5" stroke="#b8873f" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".7"/>
                <path transform="translate(73.5 2.5) scale(.54)" d="${HEART_SM}" fill="#a3203f"/>
              </svg>
              <p class="s4-paper__occasion">${util.text(conf().occasion || DEF.occasion)}</p>
            </div>
            <p class="s4-paper__greeting s4-lb">${util.text(L.greeting)}</p>
            ${L.paragraphs.map((p) => `<p class="s4-paper__p s4-lb">${util.text(p)}</p>`).join('')}
            <p class="s4-paper__signoff s4-lb">${util.text(L.signoff)}</p>
            <p class="s4-paper__signature s4-lb">
              <span>${util.text(L.signature)}</span>
              <svg class="s4-paper__sigheart" viewBox="0 0 120 116" aria-hidden="true" focusable="false"><path d="${HEART_D}" pathLength="1" fill="none" stroke="#a3203f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </p>
            <div class="s4-paper__foot s4-lb">
              <button class="btn btn--ghost s4-paper__back" type="button">${util.text(pick('back'))}</button>
            </div>
          </div>
        </div>
      </div>
      <button class="s4-paper__close" type="button" aria-label="Close the letter">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </article>
  </div>
</div>`;

    const q = (s) => el.querySelector(s);
    Object.assign(E, {
      scene: q('.s4-scene'), world: q('.s4-world'), sky: q('.s4-sky'),
      nebula: q('.s4-nebula'), nebulae: Array.from(el.querySelectorAll('.s4-nebula i')),
      stars: q('.s4-stars'), starCanvases: Array.from(el.querySelectorAll('.s4-stars canvas')),
      shoot: q('.s4-shoot'), moon: q('.s4-moon'), moonGlow: q('.s4-moon__glow'),
      afterglow: q('.s4-afterglow'), horizon: q('.s4-horizon'),
      land: q('.s4-land'), far: q('.s4-far'), near: q('.s4-near'), fores: q('.s4-fores'),
      couple: q('.s4-couple'), him: q('.s4-him'), her: q('.s4-her'), bq: q('.s4-her__bq'), cheart: q('.s4-couple__heart'),
      sway: Array.from(el.querySelectorAll('.s4-sway')),
      meadowEls: Array.from(el.querySelectorAll('.s4-mfl')), hillNear: q('.s4-hill--near'), ridge: q('.s4-hill--ridge'), ridgePath: q('.s4-hill--ridge path'),
      fx: q('.s4-fx'),
      copy: q('.s4-copy'), eyebrow: q('.s4-eyebrow'), head: q('.s4-title__head'),
      always: q('.s4-always'), alwaysGlow: q('.s4-always__glow'),
      message: q('.s4-message'), linesWrap: q('.s4-lines'), cta: q('.s4-cta'),
      end: q('.s4-end'), endHeart: q('.s4-end__heart svg'), endLine: q('.s4-end__line'),
      endFill: q('.s4-end__fill'), endGlow: q('.s4-end__glow'),
      endA: q('.s4-end__a'), endB: q('.s4-end__b'), endActions: q('.s4-end__actions'),
      replay: q('.s4-replay'), reread: q('.s4-reread'),
      letter: q('.s4-letter'), dim: q('.s4-letter__dim'), envWrap: q('.s4-env-wrap'), env: q('.s4-env'), envBody: q('.s4-env__body'),
      envPaper: q('.s4-env__paper'), flap: q('.s4-env__flap'), flapLiner: q('.s4-env__flap-liner'),
      flapShadow: q('.s4-env__flap-shadow'), seal: q('.s4-seal'),
      sealL: q('.s4-seal__half--l'), sealR: q('.s4-seal__half--r'), hint: q('.s4-env__hint'),
      letterFx: q('.s4-letter__fx'), paper: q('.s4-paper'), folds: Array.from(el.querySelectorAll('.s4-paper__fold')),
      scroller: q('.s4-paper__scroll'), bits: Array.from(el.querySelectorAll('.s4-lb')),
      sigHeart: q('.s4-paper__sigheart path'), close: q('.s4-paper__close'), back: q('.s4-paper__back'),
    });

    /* the closing lines: split into words for the blur-to-sharp reveal */
    E.lines = (pick('lines') || []).map((raw) => {
      const p = document.createElement('p');
      p.className = 's4-line';
      let txt = util.fill(raw);
      const hasHeart = HEART_RE.test(txt);
      txt = txt.replace(HEART_RE, '');
      p.textContent = txt;
      E.linesWrap.appendChild(p);
      const { words } = util.split(p);
      let heart = null;
      if (hasHeart) {
        p.setAttribute('aria-label', txt + ' ♥');
        heart = util.el(`<span class="s4-line__heart" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="${HEART_SM}" fill="url(#s4-heart-sm)"/></svg></span>`);
        p.appendChild(document.createTextNode(' '));
        p.appendChild(heart);
      }
      return { el: p, words, heart };
    });
    E.headWords = util.split(E.head).words;

    /* listeners on our own DOM (attached once; they check state) */
    E.cta.addEventListener('click', showEnvelope);
    E.env.addEventListener('click', openLetter);
    E.close.addEventListener('click', closeLetter);
    E.back.addEventListener('click', closeLetter);
    E.reread.addEventListener('click', rereadLetter);
    E.replay.addEventListener('click', () => {
      if (Love.busy) return;
      E.replay.disabled = true;
      Love.restart();
    });
    E.dim.addEventListener('click', () => { if (state === 'envelope' && performance.now() - envAt > 700) cancelEnvelope(); });
  }

  function sealSVG() {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="${waxPath(9)}" fill="url(#s4-wax)"/>
      <path d="${waxPath(9)}" fill="none" stroke="#3b0512" stroke-width="1.2" opacity=".5"/>
      <circle cx="50" cy="50" r="30" fill="none" stroke="#5a0b22" stroke-width="3.2" opacity=".75"/>
      <circle cx="49.2" cy="49.2" r="30" fill="none" stroke="#f2a1b4" stroke-width=".9" opacity=".35"/>
      <path transform="translate(33.5 34) scale(1.38)" d="${HEART_SM}" fill="#5e0b24"/>
      <path transform="translate(32.8 33.3) scale(1.38)" d="${HEART_SM}" fill="none" stroke="#f0a3b4" stroke-width=".55" opacity=".5"/>
      <ellipse cx="34" cy="28" rx="12" ry="5.5" fill="#fff" opacity=".2" transform="rotate(-32 34 28)"/>
    </svg>`;
  }

  /* ================================================================ stars */
  let glowSprite = null;
  function starGlow() {
    if (glowSprite) return glowSprite;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,248,240,1)');
    grd.addColorStop(0.22, 'rgba(255,226,236,.42)');
    grd.addColorStop(1, 'rgba(255,220,232,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return (glowSprite = c);
  }
  function drawStars() {
    if (!E.stars) return;
    const W = Math.max(1, E.stars.offsetWidth), H = Math.max(1, E.stars.offsetHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctxs = E.starCanvases.map((c) => {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      return g;
    });
    const rnd = seeded(20260206);
    const n = Math.round(util.clamp((W * H) / 1900, 110, 520));
    const cols = ['#fff7ee', '#ffe8ef', '#efe6ff', '#ffe6c8', '#fff7ee'];
    const glow = starGlow();
    for (let i = 0; i < n; i++) {
      const x = rnd() * W;
      const yy = Math.pow(rnd(), 1.25);
      const y = yy * H;
      const big = rnd();
      const r = 0.32 + Math.pow(big, 5) * 1.5;
      let a = 0.3 + rnd() * 0.7;
      a *= 1 - smooth(0.55, 1, yy) * 0.9;
      const g = ctxs[i % 2];
      g.globalAlpha = a;
      g.fillStyle = cols[(rnd() * cols.length) | 0];
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      if (r > 1.0) {
        g.globalAlpha = a * 0.6;
        const s = r * 8;
        g.drawImage(glow, x - s / 2, y - s / 2, s, s);
      }
    }
  }

  function shootStar() {
    if (reduced || !E.sky) return;
    const W = E.sky.clientWidth, H = E.sky.clientHeight;
    const len = Math.min(W, 900);
    // streak through the open sky between the words and the horizon — right
    // above the two of them, who are looking up; fall back to the very top
    const sk = E.sky.getBoundingClientRect(), sc = sk.height / Math.max(1, H);
    const cb = (E.copy.getBoundingClientRect().bottom - sk.top) / sc;
    const hz = (E.land.getBoundingClientRect().top - sk.top) / sc;
    const band = hz - cb;
    const ang = util.rand(156, 166) * (Math.PI / 180);
    const x0 = util.rand(0.55, 0.95) * W;
    const y0 = band > 90 ? cb + band * util.rand(0.12, 0.38) : util.rand(0.02, 0.07) * H;
    const dist = util.rand(0.3, 0.45) * len;
    run(() => {
      gsap.killTweensOf(E.shoot);
      gsap.set(E.shoot, { x: x0, y: y0, rotation: (ang * 180) / Math.PI, opacity: 0, scaleX: 0.25 });
      gsap.timeline()
        .to(E.shoot, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 0)
        .to(E.shoot, { x: x0 + Math.cos(ang) * dist, y: y0 + Math.sin(ang) * dist, scaleX: 1, duration: 1.15, ease: 'power1.in' }, 0)
        .to(E.shoot, { opacity: 0, duration: 0.45, ease: 'power1.in' }, 0.72);
    });
  }
  function scheduleShooting() {
    if (reduced) return;
    shootingOn = true;
    run(() => {
      gsap.delayedCall(util.rand(9, 17), () => {
        if (state === 'idle') return;
        if (state === 'sky' || state === 'ended') shootStar();
        scheduleShooting();
      });
    });
  }

  /* lay the meadow flowers onto the near hill's curve (layout px, no transforms) */
  function layoutMeadow() {
    if (!E.near || !E.meadowEls) return;
    const NW = E.near.offsetWidth, NH = E.near.offsetHeight;
    if (!NW || !NH) return;
    const cx = (parseFloat(getComputedStyle(root).getPropertyValue('--cx')) || 50) / 100;
    const HL = (cx - 0.75) * NW, HW = 1.5 * NW;
    const ch = E.couple.offsetHeight || 180;
    const crest = (nearY(500) / 300) * NH;
    E.meadowEls.forEach((f) => {
      const X = (+f.dataset.x / 100) * NW;
      const surf = (nearY(((X - HL) / HW) * 1000) / 300) * NH;
      const y = surf + (+f.dataset.d || 0) * (NH - surf) * 0.85;
      const depth = util.clamp((y - crest) / (NH * 0.7), 0, 1); // lower on the hill = nearer = bigger
      const h = +f.dataset.k * ch * (1 + depth * 1.6);
      const ar = parseFloat(f.style.getPropertyValue('--ar')) || 0.5;
      f.style.height = h.toFixed(1) + 'px';
      f.style.marginLeft = (-(h * ar) / 2).toFixed(1) + 'px';
      f.style.bottom = Math.max(-h, NH - y - h * 0.08).toFixed(1) + 'px';
      // keep the two of them clear
      const dx = Math.abs(X - cx * NW);
      const hidesCouple = dx < ch * 0.5 && y - h < crest + ch * 0.06;
      f.style.visibility = hidesCouple || dx < ch * 0.22 || y > NH - 6 ? 'hidden' : '';
    });
  }

  /* ======================================================== ambient loops */
  let ambientAnims = [];
  function pauseAmbient(p) { ambientAnims.forEach((a) => a.paused(p)); }
  function ambient() {
    ambientAnims = [];
    const keep = (a) => { ambientAnims.push(a); return a; };
    // flowers swaying in the night breeze
    if (!reduced) {
      E.sway.forEach((f, i) => {
        const amp = util.rand(2.2, 4.2);
        gsap.set(f, { rotation: -amp * 0.6, transformOrigin: '50% 100%' });
        keep(gsap.to(f, { rotation: amp, duration: util.rand(2.6, 4.2), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -util.rand(0, 4) - i * 0.07 }));
      });
      E.nebulae.forEach((n, i) => {
        keep(gsap.to(n, { x: [34, -28, 22][i], y: [-12, 16, -8][i], scale: [1.08, 1.12, 1.06][i], duration: [26, 32, 22][i], ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      });
      keep(gsap.to(E.moonGlow, { opacity: 0.68, scale: 1.08, duration: 4.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      // the two of them, breathing
      keep(gsap.to(E.him, { scaleY: 1.008, transformOrigin: '50% 100%', duration: 2.9, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      keep(gsap.to(E.her, { scaleY: 1.009, transformOrigin: '50% 100%', duration: 3.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -1.2 }));
      // …and the bouquet in her hand rocks with her breath (about its grip,
      // which is hidden behind her hip; CSS rests it at 45°)
      keep(gsap.fromTo(E.bq, { rotation: 44.2, transformOrigin: '38.356% 59.48%' }, { rotation: 46, duration: 3.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -2.1 }));
    }
  }

  /* ======================================================= master timeline */
  function buildMaster() {
    const R = reduced;
    const t = gsap.timeline({ paused: true, onComplete: () => { if (state === 'sky' && !shootingOn) scheduleShooting(); } });
    const T = R
      ? { eyebrow: 0.5, title: 0.9, always: 1.6, line: 2.8, gap: 1.8, cta: 2.0 }
      : { eyebrow: 3.0, title: 3.6, always: 5.3, line: 8.2, gap: 3.6, cta: 3.4 };

    /* --- the camera: sunset cools into twilight while we pull back */
    if (!R) {
      t.fromTo(E.world, { scale: 1.16, yPercent: 1.5 }, { scale: 1, yPercent: 0, duration: 9, ease: 'power2.inOut' }, 0);
      t.fromTo(E.sky, { yPercent: 4 }, { yPercent: 0, duration: 9, ease: 'power2.inOut' }, 0);
      t.fromTo(E.far, { yPercent: 7 }, { yPercent: 0, duration: 9, ease: 'power2.inOut' }, 0);
      t.fromTo(E.fores, { yPercent: 10 }, { yPercent: 0, duration: 7.5, ease: 'power3.out' }, 0);
    }
    t.fromTo(E.afterglow, { opacity: 1 }, { opacity: 0, duration: R ? 2 : 7.5, ease: 'sine.inOut' }, 0);
    t.fromTo(E.horizon, { opacity: 0.4 }, { opacity: 1, duration: R ? 2 : 6, ease: 'sine.inOut' }, 0);
    t.fromTo(E.stars, { opacity: 0 }, { opacity: 1, duration: R ? 2 : 7, ease: 'sine.in' }, R ? 0.2 : 0.8);
    t.fromTo(E.nebula, { opacity: 0 }, { opacity: 1, duration: R ? 2 : 7, ease: 'sine.inOut' }, R ? 0.2 : 1.6);
    t.fromTo(E.moon, { opacity: 0, y: R ? 0 : 22 }, { opacity: 1, y: 0, duration: R ? 1.5 : 4.5, ease: 'power2.out' }, R ? 0.2 : 1.2);

    /* --- title */
    t.fromTo(E.eyebrow, { opacity: 0, y: R ? 0 : 10 }, { opacity: 1, y: 0, duration: R ? 0.8 : 2, ease: 'power2.out' }, T.eyebrow);
    if (R) {
      t.fromTo(E.headWords, { opacity: 0 }, { opacity: 1, duration: 1, stagger: 0.08 }, T.title);
      if (E.always) t.fromTo(E.always, { opacity: 0 }, { opacity: 1, duration: 1.2 }, T.always);
    } else {
      t.fromTo(E.headWords,
        { opacity: 0, y: 20, filter: 'blur(12px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 2, stagger: 0.22, ease: 'power3.out', clearProps: 'filter' }, T.title);
      if (E.always) {
        t.fromTo(E.always,
          { opacity: 1, clipPath: 'inset(-40% 100% -40% -15%)' },
          { clipPath: 'inset(-40% -15% -40% -15%)', duration: 2.6, ease: 'power2.inOut' }, T.always);
        t.fromTo(E.alwaysGlow, { opacity: 0 }, { opacity: 1, duration: 2.4, ease: 'sine.inOut' }, T.always + 1.4);
      }
    }

    /* --- the closing lines, one by one */
    let at = T.line;
    E.lines.forEach((ln, i) => {
      if (i) at += T.gap;
      if (R) {
        t.fromTo(ln.words, { opacity: 0 }, { opacity: 1, duration: 1, stagger: 0.03 }, at);
      } else {
        t.fromTo(ln.words,
          { opacity: 0, y: 12, filter: 'blur(9px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.7, stagger: 0.1, ease: 'power2.out', clearProps: 'filter' }, at);
      }
      t.call(() => audio('cue', 'chime'), null, at + 0.05);
      if (ln.heart) {
        const hAt = at + (R ? 0.8 : ln.words.length * 0.1 + 0.9);
        t.fromTo(ln.heart, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: R ? 0.6 : 1.1, ease: R ? 'power1.out' : 'back.out(2.2)' }, hAt);
        if (!R) t.to(ln.heart, { scale: 1.18, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, hAt + 1.2);
      }
      if (i === 1 && !R) t.call(shootStar, null, at + 1.6);
    });

    /* --- the last line is the tender beat: she leans her head toward his
       shoulder (bouquet and all), and a breath later he leans in to meet her */
    if (!R && E.lines.length) {
      t.to(E.her, { rotation: -2.6, x: -2, transformOrigin: '50% 100%', duration: 3.4, ease: 'sine.inOut' }, at + 0.2);
      t.to(E.him, { rotation: 0.8, x: 1, transformOrigin: '50% 100%', duration: 3, ease: 'sine.inOut' }, at + 1.1);
      t.fromTo(E.cheart, { opacity: 0, y: 6, scale: 0.4 }, { opacity: 1, y: -16, scale: 1, duration: 1.8, ease: 'power2.out' }, at + 1.8);
      t.to(E.cheart, { opacity: 0, y: -46, duration: 2.2, ease: 'sine.in' }, at + 3.6);
    }

    /* --- one more thing… */
    at += T.cta;
    t.fromTo(E.cta, { autoAlpha: 0, y: R ? 0 : 18 }, { autoAlpha: 1, y: 0, duration: R ? 0.8 : 1.6, ease: 'power3.out' }, at);
    return t;
  }

  /* ============================================================ the letter */
  function makeLetterFx() {
    if (fxLetter || !Love.Particles) return;
    fxLetter = Love.Particles.create(E.letterFx, {
      emitters: [{ type: 'petals', count: 9, speed: 0.5, size: [8, 14], opacity: [0.45, 0.85] }],
      wind: 8,
    });
    fxLetter.start();
  }
  function killLetterFx() { if (fxLetter) { fxLetter.destroy(); fxLetter = null; } }

  function setOverlayOpen(open) {
    E.letter.hidden = !open;
    E.copy.inert = open;
    E.world.setAttribute('aria-hidden', open ? 'true' : 'false');
  }

  function resetEnvelope() {
    gsap.set(E.envWrap, { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1 });
    gsap.set(E.envBody, { x: 0, y: 0, rotation: 0 });
    gsap.set(E.flap, { rotationX: 0, transformPerspective: 900, transformOrigin: '50% 0%', zIndex: 4 });
    gsap.set(E.flapLiner, { opacity: 0 });
    gsap.set(E.flapShadow, { opacity: 1 });
    gsap.set(E.envPaper, { yPercent: 0, opacity: 1 });
    gsap.set(E.seal, { scale: 1, opacity: 1 });
    gsap.set([E.sealL, E.sealR], { x: 0, y: 0, rotation: 0, opacity: 1 });
    gsap.set(E.paper, { autoAlpha: 0, x: 0, y: 0, scale: 1 });
  }

  /* CTA → the envelope floats in */
  function showEnvelope() {
    if (state !== 'sky') return;
    state = 'envelope';
    envAt = performance.now();
    lastFocus = document.activeElement;
    setOverlayOpen(true);
    makeLetterFx();
    run(() => {
      resetEnvelope();
      gsap.to(E.cta, { autoAlpha: 0, y: 8, duration: 0.6, ease: 'power2.in' });
      const t = gsap.timeline();
      t.fromTo(E.dim, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.4 : 1.1, ease: 'power2.out' }, 0);
      if (reduced) {
        t.fromTo(E.envWrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.2);
      } else {
        t.fromTo(E.envWrap,
          { autoAlpha: 0, y: 90, rotation: -7, scale: 0.9 },
          { autoAlpha: 1, y: 0, rotation: -1.5, scale: 1, duration: 1.8, ease: 'expo.out' }, 0.25);
      }
      t.fromTo(E.hint, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, reduced ? 0.6 : 1.3);
      t.call(() => { if (fxScene) fxScene.stop(); pauseAmbient(true); root.classList.add('s4-covered'); }, null, 1.1);
      if (!reduced) {
        envIdle = gsap.to(E.envBody, { y: -7, rotation: 1.2, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.7 });
      }
    });
    setTimeout(() => { if (state === 'envelope') E.env.focus({ preventScroll: true }); }, 700);
  }

  function uncover() {
    if (fxScene) fxScene.start();
    pauseAmbient(false);
    root.classList.remove('s4-covered');
  }

  function cancelEnvelope() {
    if (state !== 'envelope') return;
    state = 'closing';
    uncover();
    run(() => {
      if (envIdle) { envIdle.kill(); envIdle = null; }
      gsap.timeline({
        onComplete: () => {
          setOverlayOpen(false);
          killLetterFx();
          state = 'sky';
          gsap.to(E.cta, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' });
          E.cta.focus({ preventScroll: true });
        },
      })
        .to(E.envWrap, { autoAlpha: 0, y: 40, duration: 0.6, ease: 'power2.in' }, 0)
        .to(E.dim, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 0.2);
    });
  }

  /* envelope tap → seal cracks, flap opens, letter rises and unfolds */
  function openLetter() {
    if (state !== 'envelope') return;
    state = 'opening';
    audio('setIntensity', 0.38, 3);
    audio('cue', 'sparkle');
    if (envIdle) { envIdle.kill(); envIdle = null; }

    // measure for the paper → card hand-off (FLIP)
    gsap.set(E.paper, { autoAlpha: 0, x: 0, y: 0, scale: 1 });
    const pr = E.envPaper.getBoundingClientRect();
    const cr = E.paper.getBoundingClientRect();
    const rise = 0.56;
    const fromX = pr.left + pr.width / 2 - (cr.left + cr.width / 2);
    const fromY = pr.top - pr.height * rise + pr.height / 2 - (cr.top + cr.height / 2);
    const fromS = util.clamp(pr.width / Math.max(1, cr.width), 0.2, 1);
    E.scroller.scrollTop = 0;

    run(() => {
      const t = gsap.timeline({ onComplete: letterShown });
      if (reduced) {
        t.to([E.envWrap], { autoAlpha: 0, duration: 0.5 }, 0)
          .fromTo(E.paper, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 }, 0.3)
          .fromTo(E.bits, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.05 }, 0.6)
          .set(E.folds, { opacity: 0 }, 0);
        return;
      }
      t.to(E.envBody, { y: 0, rotation: 0, duration: 0.45, ease: 'power2.out' }, 0)
        .to(E.envWrap, { rotation: 0, duration: 0.6, ease: 'power2.out' }, 0)
        .to(E.hint, { opacity: 0, duration: 0.4 }, 0)
        // the seal: a little press, then it cracks
        .to(E.seal, { scale: 1.1, duration: 0.18, ease: 'power2.out' }, 0.12)
        .to(E.seal, { scale: 0.96, duration: 0.14, ease: 'power2.in' }, 0.3)
        .call(sealBurst, null, 0.44)
        .to(E.sealL, { x: -16, y: 34, rotation: -40, opacity: 0, duration: 0.95, ease: 'power2.in' }, 0.44)
        .to(E.sealR, { x: 18, y: 38, rotation: 46, opacity: 0, duration: 0.95, ease: 'power2.in' }, 0.44)
        // the flap opens in 3D (liner shows once it passes 90°)
        .to(E.flapShadow, { opacity: 0, duration: 0.3 }, 0.72)
        .to(E.flap, { rotationX: 180, duration: 1.15, ease: 'power2.inOut' }, 0.72)
        .set(E.flapLiner, { opacity: 1 }, 1.3)
        .set(E.flap, { zIndex: 1 }, 1.3)
        // the letter slides up out of the pocket
        .to(E.envPaper, { yPercent: -rise * 100, duration: 1.3, ease: 'power2.inOut' }, 1.6)
        // …and becomes the full letter: grows, unfolds from its middle third
        .to(E.envWrap, { y: '+=70', autoAlpha: 0, duration: 1.1, ease: 'power2.in' }, 3.1)
        .to(E.envPaper, { opacity: 0, duration: 0.25 }, 3.05)
        .fromTo(E.paper,
          { autoAlpha: 1, x: fromX, y: fromY, scale: fromS, rotationX: 14, transformPerspective: 1200, clipPath: 'inset(34% -24% 34% -24%)' },
          { x: 0, y: 0, scale: 1, rotationX: 0, clipPath: 'inset(-24% -24% -24% -24%)', duration: 1.7, ease: 'power3.inOut', immediateRender: false }, 3.0)
        .fromTo(E.folds, { opacity: 0.9 }, { opacity: 0, duration: 1.6, ease: 'sine.out', immediateRender: false }, 3.55)
        .fromTo(E.bits, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.3, stagger: 0.12, ease: 'power2.out' }, 3.95)
        .set(E.paper, { clearProps: 'clipPath,transform' });
    });
  }

  function sealBurst() {
    if (!fxLetter) return;
    const c = E.letterFx.getBoundingClientRect();
    const s = E.seal.getBoundingClientRect();
    const x = s.left + s.width / 2 - c.left, y = s.top + s.height / 2 - c.top;
    fxLetter.burst(x, y, { type: 'sparkles', count: 30, spread: 0.75, life: 0.9 });
    fxLetter.burst(x, y, { type: 'petals', count: 8, spread: 0.45, scale: 0.7 });
  }

  function letterShown() {
    state = 'letter';
    E.close.focus({ preventScroll: true });
    // the little heart after the signature draws itself once it is seen
    if (io) io.disconnect();
    const drawSig = () => run(() => gsap.fromTo(E.sigHeart, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: reduced ? 0.4 : 1.8, ease: 'power2.inOut' }));
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); io = null; drawSig(); }
      }, { root: E.scroller, threshold: 0.6 });
      io.observe(E.sigHeart.ownerSVGElement);
    } else drawSig();
  }

  function rereadLetter() {
    if (state !== 'ended') return;
    state = 'opening';
    lastFocus = E.reread;
    setOverlayOpen(true);
    makeLetterFx();
    audio('setIntensity', 0.38, 3);
    E.scroller.scrollTop = 0;
    run(() => {
      gsap.set(E.envWrap, { autoAlpha: 0 });
      gsap.set(E.folds, { opacity: 0 });
      gsap.set(E.bits, { opacity: 1, y: 0 });
      gsap.timeline({ onComplete: letterShown })
        .call(() => { if (fxScene) fxScene.stop(); pauseAmbient(true); root.classList.add('s4-covered'); }, null, 1)
        .fromTo(E.dim, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 0)
        .fromTo(E.paper, { autoAlpha: 0, y: 40, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.2, ease: 'power3.out' }, 0.2);
    });
  }

  function closeLetter() {
    if (state !== 'letter') return;
    state = 'closing';
    if (io) { io.disconnect(); io = null; }
    uncover();
    run(() => {
      gsap.timeline({
        onComplete: () => {
          setOverlayOpen(false);
          killLetterFx();
          if (!ended) playEnding();
          else { state = 'ended'; (lastFocus && lastFocus.focus) ? lastFocus.focus({ preventScroll: true }) : E.replay.focus({ preventScroll: true }); }
        },
      })
        .to(E.paper, { autoAlpha: 0, y: 34, scale: 0.97, duration: reduced ? 0.4 : 0.85, ease: 'power2.in' }, 0)
        .to(E.dim, { opacity: 0, duration: reduced ? 0.4 : 1.1, ease: 'power2.inOut' }, reduced ? 0.1 : 0.35);
    });
    audio('setIntensity', 0.5, 4);
  }

  /* ================================================================ ending */
  function playEnding() {
    ended = true;
    state = 'ended';
    const R = reduced;
    if (!shootingOn) scheduleShooting();
    run(() => {
      const t = gsap.timeline({ onComplete: () => E.replay.focus({ preventScroll: true }) });
      t.to(E.message, { autoAlpha: 0, y: R ? 0 : -12, duration: R ? 0.5 : 1.3, ease: 'power2.inOut' }, 0)
        .set(E.end, { autoAlpha: 1 }, R ? 0.4 : 0.9)
        .fromTo(E.endLine, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: R ? 0.8 : 2.8, ease: 'power2.inOut' }, R ? 0.4 : 1)
        .call(() => audio('cue', 'heart'), null, R ? 1 : 3.2)
        .fromTo(E.endFill, { opacity: 0 }, { opacity: 1, duration: R ? 0.6 : 1.8, ease: 'sine.out' }, R ? 1 : 3.3)
        .fromTo(E.endGlow, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: R ? 0.6 : 2.4, ease: 'sine.out' }, R ? 1 : 3.2)
        .call(endBurst, null, R ? 1.1 : 3.35)
        .fromTo([E.endA, E.endB].filter(Boolean),
          { opacity: 0, y: R ? 0 : 10, filter: R ? 'none' : 'blur(8px)' },
          { opacity: 1, y: 0, filter: R ? 'none' : 'blur(0px)', duration: R ? 0.8 : 1.8, stagger: 0.5, ease: 'power2.out', clearProps: 'filter' }, R ? 1.3 : 3.8)
        .fromTo(E.endActions, { autoAlpha: 0, y: R ? 0 : 14 }, { autoAlpha: 1, y: 0, duration: R ? 0.6 : 1.5, ease: 'power3.out' }, R ? 1.8 : 5.4);

      if (!R) {
        // the heart keeps softly beating (lub-dub, rest)
        endBeat = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 4.6 })
          .to(E.endHeart, { scale: 1.07, duration: 0.2, ease: 'power2.out', transformOrigin: '50% 55%' })
          .to(E.endHeart, { scale: 1, duration: 0.28, ease: 'power2.in' })
          .to(E.endHeart, { scale: 1.045, duration: 0.18, ease: 'power2.out' })
          .to(E.endHeart, { scale: 1, duration: 0.7, ease: 'sine.out' });
        gsap.to(E.endGlow, { opacity: 0.6, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 5.6 });
      }
    });
  }

  function endBurst() {
    if (!fxScene) return;
    fxScene.setDensity(reduced ? 1.2 : 1.9);
    const c = E.fx.getBoundingClientRect();
    const h = E.endHeart.getBoundingClientRect();
    const x = h.left + h.width / 2 - c.left, y = h.top + h.height * 0.45 - c.top;
    fxScene.burst(x, y, { type: 'hearts', count: 10, spread: 0.42, scale: 0.75, life: 1.3 });
    fxScene.burst(x, y, { type: 'sparkles', count: 18, spread: 0.6, life: 0.9 });
  }

  /* ============================================================ listeners */
  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (state === 'letter') closeLetter();
    else if (state === 'envelope') cancelEnvelope();
  }
  function onPointer(e) {
    if (!parallax || state !== 'sky' && state !== 'ended') return;
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    parallax.forEach((p) => { p.x(-nx * p.amt); if (p.y) p.y(-ny * p.amt * 0.35); });
  }

  /* ======================================================== reset/cleanup */
  function resetDOM() {
    setOverlayOpen(false);
    E.replay.disabled = false;
    E.scroller.scrollTop = 0;
  }

  function cleanup() {
    if (tl) { tl.kill(); tl = null; }
    if (gctx) { gctx.revert(); gctx = null; }
    envIdle = endBeat = null;
    parallax = null;
    if (fxScene) { fxScene.destroy(); fxScene = null; }
    killLetterFx();
    if (offResize) { offResize(); offResize = null; }
    if (io) { io.disconnect(); io = null; }
    window.removeEventListener('keydown', onKey);
    if (root) root.removeEventListener('pointermove', onPointer);
    if (E.letter) resetDOM();
    ambientAnims = [];
    if (root) root.classList.remove('s4-covered');
    state = 'idle';
    ended = false;
    shootingOn = false;
  }

  /* ============================================================ register */
  Love.register({
    index: 4,
    id: 'always',
    transition: 'warm',

    init(el) { build(el); },

    enter() {
      cleanup();
      reduced = !!Love.reducedMotion;
      root.classList.toggle('s4-reduced', reduced);
      gsap.killTweensOf(E.scene);
      gsap.set(E.scene, { clearProps: 'opacity' });
      resetDOM();
      state = 'sky';

      drawStars();
      layoutMeadow();
      layoutRidge();
      offResize = util.onResize(() => { drawStars(); layoutMeadow(); layoutRidge(); }, 160);

      if (Love.Particles) {
        fxScene = Love.Particles.create(E.fx, {
          emitters: [
            { type: 'fireflies', count: 14, size: [6, 12], opacity: [0.35, 0.95] },
            { type: 'petals', count: 7, speed: 0.55, size: [7, 13], opacity: [0.5, 0.9] },
          ],
          wind: 12,
          area: { x: 0, y: 0.5, w: 1, h: 0.5 },
        });
        fxScene.start();
        fxScene.setArea(null); // later petals drift in from the top of the sky
      }

      gctx = gsap.context(() => {
        ambient();
        tl = buildMaster();
        if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          parallax = [
            { el: E.sky, amt: 6 }, { el: E.far, amt: 12 }, { el: E.near, amt: 20 }, { el: E.fores, amt: 34 },
          ].map((p) => ({ amt: p.amt, x: gsap.quickTo(p.el, 'x', { duration: 1.8, ease: 'power3.out' }) }));
        }
      }, root);
      tl.play(0);

      window.addEventListener('keydown', onKey);
      root.addEventListener('pointermove', onPointer, { passive: true });
      audio('setIntensity', 0.55, 4);
    },

    leave() {
      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          cleanup();
          gsap.set(E.scene, { opacity: 0 }); // stay dark under the incoming veil
          resolve();
        };
        if (!E.scene) return finish();
        if (fxScene) fxScene.stop();
        gsap.to(E.scene, { opacity: 0, duration: reduced ? 0.3 : 0.9, ease: 'power2.inOut', onComplete: finish });
        setTimeout(finish, 2500); // safety net
      });
    },

    seek(t) {
      if (!tl) return;
      tl.pause(t);
    },
  });
})();
