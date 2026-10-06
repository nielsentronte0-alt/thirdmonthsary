/* ==========================================================================
   stage3.js — "Wait… someone is coming"   (the main cinematic scene)

   A short animated film built from layered DOM / SVG / canvas:
     sky → sun + god-rays → clouds → hills ×3 → trees → hedges → garden
     (path, rose arch, HER, HIM, tulips) → blurred foreground → particles
   A virtual camera (S.camX / S.camY / S.camZ) is applied to every layer
   with its own parallax factor p (0 = infinitely far, 1 = the garden path,
   >1 = foreground). Everything visible is driven by ONE master timeline so
   seek(t) shows the correct frame (walk cycle is derived from his x).

   Shot list (seconds):
     0–4    title card on black, letterbox slides in
     4–9    wide establishing pan → HER under the rose arch, backlit
     9–11   whip back to the start of the path, HIM appears far away
     11–27  the walk (camera follows + pushes in, beats, wind, music builds)
            17–19 cut-in: his determined face
     27–31  arrival two-shot, she reacts, flare, hearts
     31–33  close-up: his happy face
     33–40  POV: he offers the bouquet to HER (the viewer), text
     40–44  glow, letterbox opens → Love.next()
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
  const T = {
    barsIn: 0.15, title: 0.55, titleOut: 3.3, fadeUp: 3.75, estab: 3.4,
    whip: 8.95, himIn: 9.6,
    walk0: 11.3, acc: 1.2, dec: 2.4, walk1: 26.9,
    cutA: 16.9, cutAOut: 19.3,
    two: 24.6, arrive: 26.95, cutB: 30.85, pov: 32.95,
    line1: 34.7, line2: 36.8, glow: 40.0, end: 43.6,
  };
  const BEAT_WINDOWS = [[12.3, 16.5], [19.8, 26.0]];   // beats avoid the cut-in

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
  const GOLD = ['255,214,150', '255,226,180', '255,196,130', '255,236,200'];

  /** The arch's string lights seen from under it: huge soft discs across the top. */
  function povLightsHTML() {
    const r = rng(97);
    let s = '';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = -6 + t * 112 + (r() - 0.5) * 4;
      const y = 7 + 11 * Math.sin(Math.PI * t) + (r() - 0.5) * 2;
      const d = 7 + r() * 6;
      s += `<i class="s3-bokeh" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${d.toFixed(1)}vmax;height:${d.toFixed(1)}vmax;--c:${pick(r, GOLD)};--a:${(0.3 + r() * 0.25).toFixed(2)}"></i>`;
    }
    return s;
  }

  /** Blurred garden seen from HER point of view (static, viewBox-sliced). */
  function povGardenSVG() {
    const r = rng(901);
    let s = '<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs><filter id="s3pv-b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>' +
      '<linearGradient id="s3pv-path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4040"/><stop offset="1" stop-color="#e9a77c"/></linearGradient>' +
      '<linearGradient id="s3pv-gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1020"/><stop offset="1" stop-color="#14040a"/></linearGradient></defs>' +
      '<g filter="url(#s3pv-b)">';
    // far hills
    let d = 'M-50 1000L-50 600';
    for (let x = -50; x <= 1050; x += 25) d += `L${x} ${n1(585 - 34 * Math.sin(x / 160 + 1.3) - 16 * Math.sin(x / 61))}`;
    s += `<path d="${d}L1050 1000Z" fill="#9b4160" opacity=".85"/>`;
    // treeline
    d = 'M-50 1000L-50 640';
    for (let x = -50; x <= 1050; x += 14) d += `L${x} ${n1(628 - 14 * Math.abs(Math.sin(x / 23)) - 10 * Math.sin(x / 140))}`;
    s += `<path d="${d}L1050 1000Z" fill="#4b1530"/>`;
    // trees
    for (let i = 0; i < 16; i++) {
      const x = r() * 1000, h = 120 + r() * 260, w = h * (r() < 0.5 ? 0.2 : 0.55);
      s += `<ellipse cx="${n1(x)}" cy="${n1(660 - h / 2)}" rx="${n1(w / 2)}" ry="${n1(h / 2)}" fill="#2d0b1d"/>`;
    }
    // hedge with roses
    s += '<rect x="-50" y="690" width="1100" height="320" fill="url(#s3pv-gnd)"/>';
    for (let i = 0; i < 26; i++) s += `<circle cx="${n1(r() * 1000)}" cy="${n1(690 + r() * 20)}" r="${n1(28 + r() * 30)}" fill="#25090f"/>`;
    for (let i = 0; i < 40; i++) s += `<circle cx="${n1(r() * 1000)}" cy="${n1(672 + r() * 40)}" r="${n1(5 + r() * 6)}" fill="${pick(r, ['#c8284f', '#e05a7a', '#f1a9b9', '#b3123a'])}"/>`;
    // the path he came along, receding to the horizon
    s += '<path d="M330 1000L670 1000L528 700L472 700Z" fill="url(#s3pv-path)" opacity=".75"/>';
    s += '</g></svg>';
    return s;
  }

  /** One blurred foreground rose cluster (POV framing). */
  function povRoseCluster(seed) {
    const r = rng(seed);
    let s = '<svg viewBox="0 0 400 400" aria-hidden="true" focusable="false"><defs><filter id="s3pf-' + seed + '" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="13"/></filter></defs><g filter="url(#s3pf-' + seed + ')">';
    for (let i = 0; i < 9; i++) s += `<ellipse cx="${n1(80 + r() * 240)}" cy="${n1(80 + r() * 240)}" rx="${n1(50 + r() * 50)}" ry="${n1(30 + r() * 30)}" fill="${pick(r, ['#1c0a0c', '#2a1211', '#140608'])}" transform="rotate(${n1(r() * 180)} 200 200)"/>`;
    for (let i = 0; i < 4; i++) {
      const x = 110 + r() * 180, y = 110 + r() * 180, rr = 34 + r() * 30;
      s += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(rr)}" fill="${pick(r, ['#8e0f2c', '#b3123a', '#c8284f', '#e05a7a'])}"/><circle cx="${n1(x + rr * 0.3)}" cy="${n1(y - rr * 0.3)}" r="${n1(rr * 0.45)}" fill="rgba(255,190,190,.35)"/>`;
    }
    return s + '</g></svg>';
  }

  function template() {
    const herCustom = !!(CONF.her && CONF.her.sprite);
    const herSrc = herCustom ? CONF.her.sprite : CHAR + 'her-side.svg';
    const himImg = `<img src="${CHAR}him-side.webp" alt="" draggable="false" decoding="async">`;
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
      <div class="s3-her${herCustom ? ' s3-her--custom' : ''}">
        <div class="s3-her__halo"></div>
        <div class="s3-her__shadow"></div>
        <div class="s3-her__idle">
          <img class="s3-her__img s3-her__a" src="${herSrc}" alt="" draggable="false" decoding="async">
          ${herCustom ? '' : `<img class="s3-her__img s3-her__b" src="${CHAR}her-side-react.svg" alt="" draggable="false" decoding="async">`}
        </div>
      </div>
      <div class="s3-him">
        <div class="s3-him__shadow"></div>
        <div class="s3-him__haze"><div class="s3-him__body">
          <div class="s3-him__part s3-him__far">${himImg}</div>
          <div class="s3-him__part s3-him__near">${himImg}</div>
          <div class="s3-him__part s3-him__upper">${himImg}</div>
        </div></div>
      </div>
      <div class="s3-front"></div>
    </div>
    <div class="s3-layer s3-layer--soft" data-p="1.5" data-k="fg"></div>
    <div class="s3-flare"><canvas class="s3-flare__core"></canvas><div class="s3-flare__streak"></div><div class="s3-flare__ghost"></div></div>
  </div>

  <div class="s3-cut s3-cut--a" aria-hidden="true">
    <div class="s3-cut__bg"></div>
    <div class="s3-cut__bokeh">${bokehHTML(71, 16, WARM)}</div>
    <div class="s3-cut__sun"></div>
    <div class="s3-cut__dolly"><img class="s3-cut__face" src="${CHAR}face-determined.webp" alt="" draggable="false" decoding="async"></div>
  </div>
  <div class="s3-cut s3-cut--b" aria-hidden="true">
    <div class="s3-cut__bg"></div>
    <div class="s3-cut__bokeh">${bokehHTML(83, 18, WARM)}</div>
    <div class="s3-cut__sun"></div>
    <div class="s3-cut__dolly"><img class="s3-cut__face" src="${CHAR}face-happy.webp" alt="" draggable="false" decoding="async"></div>
    <div class="s3-cut__bloom"></div>
  </div>

  <div class="s3-pov" aria-hidden="true">
    <div class="s3-pov__bg"></div>
    <div class="s3-pov__garden">${povGardenSVG()}</div>
    <div class="s3-pov__bokeh">${bokehHTML(91, 16, GOLD, { x: 0, y: 52, w: 100, h: 16 }, [1.2, 4.5])}</div>
    <div class="s3-pov__him">
      <div class="s3-pov__aura"></div>
      <img class="s3-pov__body" src="${CHAR}him-front.webp" alt="" draggable="false" decoding="async">
      <img class="s3-pov__bq" src="${CHAR}him-front.webp" alt="" draggable="false" decoding="async">
    </div>
    <div class="s3-pov__light"></div>
    <div class="s3-pov__fg">
      <div class="s3-pov__lights">${povLightsHTML()}</div>
      <div class="s3-pov__rose s3-pov__rose--l1">${povRoseCluster(11)}</div>
      <div class="s3-pov__rose s3-pov__rose--l2">${povRoseCluster(13)}</div>
      <div class="s3-pov__rose s3-pov__rose--r1">${povRoseCluster(12)}</div>
      <div class="s3-pov__rose s3-pov__rose--r2">${povRoseCluster(14)}</div>
    </div>
    <div class="s3-pov__scrim"></div>
  </div>

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

  <div class="s3-pov-text">
    <p class="display s3-pov-text__l1">${util.text(C3.arrival || 'These are for you.')}</p>
    <p class="script s3-pov-text__l2">${util.text(C3.arrivalSub || 'Always for you.')}</p>
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

    const D = Math.max(6 * U, 1.15 * W);
    const tMid = (T.walk1 - T.walk0) - T.acc - T.dec;
    const v = D / (T.acc * 2 / Math.PI + tMid + T.dec * 2 / Math.PI);
    const x1 = v * T.acc * 2 / Math.PI, x2 = x1 + v * tMid;
    const gap = 0.5 * U, xHer = D + gap, xArch = xHer - 0.25 * U, xMid = D + gap / 2;

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
      W, H, portrait, bar, B, U, groundY, hz, Ay, D, v, x1, x2, tMid, stride: v / 1.8,
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
        case 'ground':
          R.groundArt.innerHTML = artGround(X0, X1);
          R.front.innerHTML = artFront(X0, X1);
          break;
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

    /* ---- characters ---- */
    Object.assign(R.him.style, { left: '0px', top: n1(groundY - U) + 'px', width: n1(L.wHim) + 'px', height: n1(U) + 'px' });
    Object.assign(R.her.style, { left: n1(xHer - 0.25 * U) + 'px', top: n1(groundY - U) + 'px', width: n1(0.5 * U) + 'px', height: n1(U) + 'px' });
    Object.assign(R.archGlow.style, { left: n1(xArch - 0.9 * U) + 'px', top: n1(groundY - 1.75 * U) + 'px', width: n1(1.8 * U) + 'px', height: n1(1.4 * U) + 'px' });

    /* ---- birds (screen space) ---- */
    R.birdEls.forEach((b, i) => {
      const flock = i < 3 ? 0 : 1;
      const k = flock ? i - 3 : i;
      const y = (flock ? hz - B * 0.42 : hz - B * 0.27) + [0, B * 0.012, -B * 0.01][k];
      b.style.top = n1(y) + 'px';
      b.style.width = n1(B * (flock ? 0.021 : 0.028) * (1 - k * 0.12)) + 'px';
    });

    /* ---- close-ups & POV ---- */
    const faceW = portrait ? Math.min(W * 0.96, B * 0.6) : B * 0.95 * 0.904;
    const faceH = faceW / 0.904;
    const faceTop = portrait ? bar + B * 0.2 : bar + B * 0.06;
    R.cutAFace.parentNode.style.cssText = `left:${n1((portrait ? W / 2 : W * 0.42) - faceW / 2)}px;top:${n1(faceTop)}px;width:${n1(faceW)}px;height:${n1(faceH)}px`;
    R.cutBFace.parentNode.style.cssText = `left:${n1(W / 2 - faceW / 2)}px;top:${n1(faceTop)}px;width:${n1(faceW)}px;height:${n1(faceH)}px`;

    const povH = portrait ? Math.min(B * 1.02, W * 1.1 / 0.521) : B * 1.35;
    const povW = povH * 313 / 601;
    const povX = portrait ? W / 2 : W * 0.63;
    const povTop = bar + B * (portrait ? 0.07 : 0.06);
    R.povHim.style.cssText = `left:${n1(povX - povW / 2)}px;top:${n1(povTop)}px;width:${n1(povW)}px;height:${n1(povH)}px`;
  }

  /* ===================================================================
     RENDER (every frame + after seek): camera → layers, walk cycle
     =================================================================== */
  function camX() {
    const fw = S.followW;
    if (fw <= 0) return S.camX;
    const follow = S.himX + 0.1 * L.W / S.camZ;
    return S.camX * (1 - fw) + follow * fw;
  }

  function toScreen(X, Y, p) {
    const pp = p == null ? 1 : p;
    const zp = 1 + (S.camZ - 1) * pp;
    return { x: L.W / 2 + (X - camX() * pp) * zp, y: L.Ay + (Y - L.Ay) * zp + S.camY * pp, z: zp };
  }

  function setT(el, key, v) {           // write transform only when changed
    if (el[key] !== v) { el[key] = v; el.style.transform = v; }
  }

  function render() {
    if (!L || !S) return;
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

    /* HIM — walk cycle derived from distance travelled (seek-safe) */
    const a = S.walkAmp;
    const ph = (S.himX / L.stride) * Math.PI;
    const s = Math.sin(ph), c = Math.cos(ph);
    const A = 13, OFF = 8;
    const near = -a * (OFF + A * s), far = a * (OFF + A * s);
    const kn = 1 - 0.05 * a * Math.max(0, c), kf = 1 - 0.05 * a * Math.max(0, -c);
    const bob = -L.U * 0.016 * a * c * c;
    const lean = 1.6 * a;
    setT(R.him, '_t', `translate3d(${(S.himX - L.wHim / 2).toFixed(2)}px,0,0)`);
    setT(R.himBody, '_t', `translateY(${bob.toFixed(2)}px) rotate(${lean.toFixed(2)}deg)`);
    setT(R.himNear, '_t', `rotate(${near.toFixed(2)}deg) scaleY(${kn.toFixed(4)})`);
    setT(R.himFar, '_t', `rotate(${far.toFixed(2)}deg) scaleY(${kf.toFixed(4)})`);
    // arrival: a small bow as he holds the bouquet out to her
    const off = S.offer;
    setT(R.himUpper, '_t', `translateX(${(off * L.wHim * 0.05).toFixed(2)}px) rotate(${(0.6 * a * s + off * 4.5).toFixed(2)}deg)`);
    setT(R.himShadow, '_t', `scaleX(${(1 - 0.08 * a * c * c).toFixed(3)})`);
  }

  /* ===================================================================
     MASTER TIMELINE
     =================================================================== */
  function beatSlots(n) {
    if (!n) return [];
    const preset = [[12.3, 15.5], [19.9, 22.7], [23.0, 25.9]];
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
    const call = (fn, pos) => tl.call(fn, null, pos);

    S = {
      camX: P.xA, camY: P.crane, camZ: P.zWide, followW: 0,
      himX: 0, walkAmp: 0, offer: 0, sunSink: 0, rays: 0, cloud: 0, flare: 0,
    };

    /* ---- initial states (direct, so every seek has a clean baseline) ---- */
    gsap.set([R.cutA, R.cutB, R.pov, R.flash, R.glow, R.povText, R.skip, R.him], { autoAlpha: 0 });
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
    if (R.herB) gsap.set(R.herB, { autoAlpha: 0 });
    gsap.set(R.herA, { autoAlpha: 1 });

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

    /* ---- atmosphere over the whole scene ---- */
    ft(S, { sunSink: 0 }, { sunSink: P.B * 0.035, duration: T.pov, ease: 'none' }, 0);
    ft(S, { rays: 0 }, { rays: rm ? 0 : 26, duration: T.end, ease: 'none' }, 0);
    ft(S, { cloud: 0 }, { cloud: -P.W * 0.07, duration: T.end, ease: 'none' }, 0);
    ft(R.dusk, { opacity: 0 }, { opacity: 0.55, duration: T.pov - 6, ease: 'sine.in' }, 6);
    ft(R.leakA, { opacity: 0.22 }, { opacity: 0.5, duration: 3.6, ease: 'sine.inOut', repeat: Math.ceil(T.end / 3.6), yoyo: true }, 0);
    ft(R.archGlow, { opacity: 0.55 }, { opacity: 1, duration: 2.4, ease: 'sine.inOut', repeat: Math.ceil(T.pov / 2.4), yoyo: true }, 0);
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

    /* ---- 11–27 · the walk ---- */
    ft(S, { himX: 0 }, { himX: P.x1, duration: T.acc, ease: 'sine.in' }, T.walk0);
    ft(S, { himX: P.x1 }, { himX: P.x2, duration: P.tMid, ease: 'none' }, T.walk0 + T.acc);
    ft(S, { himX: P.x2 }, { himX: P.D, duration: T.dec, ease: 'sine.out' }, T.walk1 - T.dec);
    ft(S, { walkAmp: 0 }, { walkAmp: 1, duration: 0.8, ease: 'sine.inOut' }, T.walk0);
    ft(S, { walkAmp: 1 }, { walkAmp: 0, duration: 1.7, ease: 'sine.inOut' }, T.walk1 - 1.7);
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

    /* ---- 25–31 · arrival two-shot ---- */
    tl.set(S, { camX: P.xMid }, T.two);
    ft(S, { followW: 1 }, { followW: 0, duration: 3.0, ease: 'sine.inOut' }, T.two);
    ft(S, { camZ: 1 }, { camZ: P.z2, duration: 3.0, ease: 'sine.inOut' }, T.two);
    ft(S, { camZ: P.z2 }, { camZ: P.z3, duration: T.pov - T.two - 3.0, ease: 'sine.inOut' }, T.two + 3.0);
    call(() => audio('cue', 'heart'), T.arrive);
    if (R.herB) {
      ft(R.herB, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, ease: 'sine.inOut' }, T.arrive + 0.2);
      ft(R.herA, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.6, ease: 'sine.in' }, T.arrive + 0.55);
    }
    ft(S, { offer: 0 }, { offer: rm ? 0.6 : 1, duration: 1.5, ease: 'power2.inOut' }, T.arrive + 0.35);
    ft(R.herHalo, { opacity: 0.6, scale: 1 }, { opacity: 1, scale: 1.25, duration: 2.4, ease: 'power2.out' }, T.arrive);
    ft(S, { flare: 0 }, { flare: 0.9, duration: 1.4, ease: 'power2.out' }, T.arrive + 0.1);
    ft(S, { flare: 0.9 }, { flare: 0.25, duration: 2.4, ease: 'sine.inOut' }, T.arrive + 1.5);
    call(() => burstArrival(), T.arrive + 0.35);

    /* ---- 31–33 · close-up: his smile ---- */
    ft(R.cutB, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.inOut' }, T.cutB);
    ft(R.cutBDolly, { scale: 1.02, yPercent: 1 }, { scale: rm ? 1.04 : 1.1, yPercent: -1, duration: T.pov - T.cutB + 0.2, ease: 'sine.out' }, T.cutB);
    ft(R.cutBBloom, { opacity: 0.35 }, { opacity: 0.85, duration: 2.0, ease: 'sine.inOut' }, T.cutB);
    ft(R.cutBBokeh, { x: 0, scale: 1.05 }, { x: P.W * 0.025, scale: 1.0, duration: 2.4, ease: 'sine.out' }, T.cutB);
    tl.set(R.world, { visibility: 'hidden' }, T.cutB + 0.35);

    /* ---- 33–40 · POV: he offers the bouquet to HER ---- */
    ft(R.flash, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'power2.in' }, T.pov - 0.2);
    call(() => audio('cue', 'swell'), T.pov - 0.2);
    call(() => audio('setIntensity', 1, 1.5), T.pov);
    tl.set(R.pov, { autoAlpha: 1 }, T.pov + 0.03);
    tl.set(R.cutB, { autoAlpha: 0 }, T.pov + 0.04);
    ft(R.flash, { autoAlpha: 1 }, { autoAlpha: 0, duration: 1.6, ease: 'power2.out' }, T.pov + 0.05);
    const povDur = T.end - T.pov;
    ft(R.povHim, { scale: 1, yPercent: 1.5 }, { scale: rm ? 1.02 : 1.07, yPercent: 0, duration: povDur, ease: 'sine.inOut' }, T.pov);
    ft(R.povBq, { scale: 1 }, { scale: rm ? 1.01 : 1.035, duration: povDur, ease: 'sine.inOut' }, T.pov);
    ft(R.povBg, { scale: 1 }, { scale: 1.03, duration: povDur, ease: 'sine.inOut' }, T.pov);
    ft(R.povGarden, { scale: 1.02 }, { scale: 1.05, duration: povDur, ease: 'sine.inOut' }, T.pov);
    ft(R.povBokeh, { x: 0, y: 0 }, { x: -P.W * 0.02, y: -P.B * 0.015, duration: povDur, ease: 'sine.inOut' }, T.pov);
    ft(R.povFg, { scale: 1.0 }, { scale: rm ? 1.02 : 1.12, duration: povDur, ease: 'sine.inOut' }, T.pov);
    call(() => burstBouquet(1), T.pov + 1.1);
    call(() => burstBouquet(2), T.line2 + 0.6);
    tl.set(R.povText, { autoAlpha: 1 }, T.line1 - 0.05);
    ft(R.l1Words, { autoAlpha: 0, y: 14, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out', stagger: 0.14 }, T.line1);
    call(() => audio('cue', 'chime'), T.line1);
    ft(R.l2, { autoAlpha: 0, scale: 0.94, filter: 'blur(12px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 2.0, ease: 'power3.out' }, T.line2);
    call(() => audio('cue', 'sparkle'), T.line2 + 0.2);

    /* ---- 40–44 · glow, letterbox opens, on to stage 4 ---- */
    ft(R.glow, { autoAlpha: 0 }, { autoAlpha: 1, duration: T.end - T.glow - 0.15, ease: 'sine.in' }, T.glow);
    ft(R.skip, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, ease: 'sine.in' }, T.glow);
    ft(R.barTop, { yPercent: 0 }, { yPercent: -101, duration: 1.8, ease: 'expo.inOut' }, T.glow + 0.5);
    ft(R.barBot, { yPercent: 0 }, { yPercent: 101, duration: 1.8, ease: 'expo.inOut' }, T.glow + 0.5);
    ft(R.povText, { autoAlpha: 1 }, { autoAlpha: 0, duration: 1.1, ease: 'power1.in' }, T.end - 1.3);
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
  function burstBouquet(n) {
    if (!fx || !R.povBq) return;
    const rc = R.povBq.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const x = rc.left - rr.left + rc.width * 0.66, y = rc.top - rr.top + rc.height * 0.38;
    fx.burst(x, y, { type: 'hearts', count: n === 1 ? 18 : 12, spread: 0.9, angle: -Math.PI / 2, scale: 1.1 });
    fx.burst(x, y, { type: 'petals', count: n === 1 ? 24 : 14, spread: 1.2 });
    fx.burst(x, y, { type: 'sparkles', count: 14, spread: 0.8 });
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
        her: q('.s3-her'), herA: q('.s3-her__a'), herB: q('.s3-her__b'), herHalo: q('.s3-her__halo'), herIdle: q('.s3-her__idle'),
        him: q('.s3-him'), himHaze: q('.s3-him__haze'), himBody: q('.s3-him__body'), himNear: q('.s3-him__near'),
        himFar: q('.s3-him__far'), himUpper: q('.s3-him__upper'), himShadow: q('.s3-him__shadow'),
        cutA: q('.s3-cut--a'), cutADolly: q('.s3-cut--a .s3-cut__dolly'), cutAFace: q('.s3-cut--a .s3-cut__face'), cutABokeh: q('.s3-cut--a .s3-cut__bokeh'),
        cutB: q('.s3-cut--b'), cutBDolly: q('.s3-cut--b .s3-cut__dolly'), cutBFace: q('.s3-cut--b .s3-cut__face'), cutBBokeh: q('.s3-cut--b .s3-cut__bokeh'), cutBBloom: q('.s3-cut__bloom'),
        pov: q('.s3-pov'), povBg: q('.s3-pov__bg'), povGarden: q('.s3-pov__garden'), povBokeh: q('.s3-pov__bokeh'), povHim: q('.s3-pov__him'),
        povBq: q('.s3-pov__bq'), povFg: q('.s3-pov__fg'),
        fxCanvas: q('.s3-fx'), leakA: q('.s3-leak--a'), leakB: q('.s3-leak--b'), flash: q('.s3-flash'), glow: q('.s3-glow'), black: q('.s3-black'),
        title: q('.s3-title'), titleInner: q('.s3-title__inner'), eyebrow: q('.s3-title__eyebrow'), rose: q('.s3-rose'),
        povText: q('.s3-pov-text'), l2: q('.s3-pov-text__l2'),
        barTop: q('.s3-bar--top'), barBot: q('.s3-bar--bot'), skip: q('.s3-skip'),
      });
      R.birdEls = Array.from(root.querySelectorAll('.s3-bird'));
      R.beats = Array.from(root.querySelectorAll('.s3-beat'));
      layers = Array.from(root.querySelectorAll('.s3-layer')).map((n) => ({ el: n, p: parseFloat(n.dataset.p), k: n.dataset.k, last: '' }));

      // title: letter-by-letter (rose svg stays whole)
      const l1 = q('.s3-title__l1'), l2 = q('.s3-title__l2t');
      R.titleLines = [l1, q('.s3-title__l2') || R.rose].filter(Boolean);
      R.titleChars = [].concat(util.split(l1, { chars: true }).chars, l2 ? util.split(l2, { chars: true }).chars : []);
      R.l1Words = util.split(q('.s3-pov-text__l1')).words;
      paintRays();
      paintFlare();

      R.skip.addEventListener('click', () => {
        if (!active || Love.busy) return;
        Love.next();
      });
    },

    enter() {
      ended = false;
      active = true;
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
      tl.pause(Math.max(0, +t || 0));
      render();
    },
  });
})();
