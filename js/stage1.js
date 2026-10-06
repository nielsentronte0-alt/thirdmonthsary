/* ==========================================================================
   stage1.js — "For You…"  (the opening)

   STEP A  sound gate: a softly beating heart, "Tap anywhere to begin".
           Any tap / click / Enter / Space → audio.unlock(), the heart blooms
           into light and the world wakes up.
   STEP B  title sequence on one master GSAP timeline (seekable):
           eyebrow → "Happy 4th Monthsary," → "My Love" (script, chime) + heart
           → subtitle → "Open Your Surprise".
   CTA     whoosh + petal / sparkle burst, content rises away into the light,
           Love.next().  leave() fades the world to black and stops everything.
   ========================================================================== */
(function () {
  'use strict';

  const Love = window.Love;
  const util = Love.util;

  /* ------------------------------------------------------------ helpers */
  const cfg = () => (Love.config && Love.config.stage1) || {};
  const pick = (v, fb) => (v == null || v === '' ? fb : v);
  const killAll = (arr) => { arr.forEach((a) => { try { a && a.kill(); } catch (e) { /* noop */ } }); arr.length = 0; };
  const audio = (fn, ...args) => {
    try { if (Love.audio && typeof Love.audio[fn] === 'function') Love.audio[fn](...args); } catch (e) { console.error(e); }
  };

  /** Deterministic PRNG so every rose blooms the same way on every visit. */
  function prng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const f1 = (n) => (Math.round(n * 10) / 10).toString();

  /**
   * A top-down rose bloom drawn from layered petals, softened by a STATIC
   * SVG gaussian blur (rasterised once, then only transformed by GSAP).
   */
  function roseSVG(key, o) {
    const rnd = prng(o.seed);
    const id = 's1r' + key;
    const layers = [
      { n: 7, L: 96, w: 50, off: 0 },
      { n: 6, L: 81, w: 46, off: 26 },
      { n: 6, L: 66, w: 39, off: 8 },
      { n: 5, L: 52, w: 33, off: 40 },
      { n: 5, L: 39, w: 27, off: 14 },
      { n: 4, L: 27, w: 20, off: 52 },
      { n: 3, L: 16, w: 13, off: 30 },
    ];
    let petals = '';
    layers.forEach((ly, li) => {
      for (let i = 0; i < ly.n; i++) {
        const a = ly.off + (360 / ly.n) * i + (rnd() - 0.5) * 16;
        const L = ly.L * (0.9 + rnd() * 0.18);
        const w = ly.w * (0.88 + rnd() * 0.24);
        const d =
          'M0 0C' + f1(-w) + ' ' + f1(-L * 0.18) + ' ' + f1(-w * 1.06) + ' ' + f1(-L * 0.82) + ' ' + f1(-w * 0.34) + ' ' + f1(-L) +
          'Q0 ' + f1(-L * 0.93) + ' ' + f1(w * 0.34) + ' ' + f1(-L) +
          'C' + f1(w * 1.06) + ' ' + f1(-L * 0.82) + ' ' + f1(w) + ' ' + f1(-L * 0.18) + ' 0 0Z';
        petals += '<path d="' + d + '" transform="rotate(' + f1(a) + ')" fill="url(#' + id + 'g' + (li % 3) + ')"/>';
      }
    });
    const grad = (n, mid) =>
      '<linearGradient id="' + id + 'g' + n + '" x1="0" y1="1" x2="0" y2="0">' +
      '<stop offset="0" stop-color="' + o.base + '"/>' +
      '<stop offset="' + mid + '" stop-color="' + o.mid + '"/>' +
      '<stop offset=".9" stop-color="' + o.edge + '"/>' +
      '<stop offset="1" stop-color="' + o.rim + '"/></linearGradient>';
    return (
      '<svg viewBox="-125 -125 250 250" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<filter id="' + id + 'f" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur class="s1-blur" stdDeviation="' + o.blur + '"/></filter>' +
      '<radialGradient id="' + id + 'h"><stop offset="0" stop-color="' + o.halo + '" stop-opacity=".55"/>' +
      '<stop offset="1" stop-color="' + o.halo + '" stop-opacity="0"/></radialGradient>' +
      grad(0, 0.5) + grad(1, 0.62) + grad(2, 0.42) +
      '</defs>' +
      '<circle r="122" fill="url(#' + id + 'h)"/>' +
      '<g filter="url(#' + id + 'f)"><g transform="rotate(' + o.rot + ') scale(1 ' + o.squash + ')" stroke="' + o.rim +
      '" stroke-opacity=".28" stroke-width="1.1">' + petals +
      '<circle r="7" fill="' + o.base + '" stroke="none"/></g></g></svg>'
    );
  }

  /** Wrap each sentence in a span: inline on phones, its own line on wide screens. */
  function sentences(str) {
    const parts = String(str).split(/(?<=[.!?…])\s+/).filter(Boolean);
    return '<span class="sr-only">' + util.escapeHTML(str) + '</span>' +
      parts.map((p) => '<span class="s1-sent" aria-hidden="true">' + util.escapeHTML(p) + '</span>').join(' ');
  }

  const HEART_PATH = 'M50 88C22 68 6 50 6 32 6 18 17 8 30 8c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 24 0 18-16 36-44 56z';

  function heartSVG(cls, gid) {
    return (
      '<svg class="' + cls + '" viewBox="0 0 100 96" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2=".35" y2="1">' +
      '<stop offset="0" stop-color="#ffd9e2"/><stop offset=".38" stop-color="#f58aa4"/><stop offset="1" stop-color="#c41d48"/>' +
      '</linearGradient></defs>' +
      '<path d="' + HEART_PATH + '" fill="url(#' + gid + ')"/>' +
      '</svg>'
    );
  }

  const HEADPHONES =
    '<svg class="s1-gate__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M4 15.5V12a8 8 0 0 1 16 0v3.5"/><rect x="3" y="14" width="4.2" height="6.5" rx="1.6"/><rect x="16.8" y="14" width="4.2" height="6.5" rx="1.6"/></svg>';

  /* --------------------------------------------------------------- state */
  let S = null;            // DOM refs (built once in init)
  let state = 'idle';      // idle | gate | title | exiting | leaving
  let master = null;       // STEP B timeline (seekable)
  let exitTl = null;
  let beatTl = null;       // the little heart after "My Love"
  let loops = [];          // ambient tweens (whole stage lifetime)
  let gateLoops = [];      // gate-only tweens
  let offs = [];           // listener removers
  let quick = [];          // gsap.quickTo setters (pointer parallax)
  let fxBack = null, fxFront = null;
  let hasBegunOnce = false;
  let leaveTimer = 0;
  const T = { land: 0 };   // master-timeline times we need from outside

  /* ---------------------------------------------------------------- init */
  function init(el) {
    const c = cfg();
    const touch = util.isTouch;
    const R = Love.reducedMotion;
    el.classList.add('s1');
    if (R) el.classList.add('s1--reduced');

    const gateText = pick(c.gate, touch ? 'Tap anywhere to begin' : 'Click anywhere to begin');
    const gateHint = pick(c.gateHint, 'Best with sound on');
    const footnote = pick(c.footnote, 'A little film in four chapters');
    const title = util.fill(pick(c.title, 'Happy {nth} Monthsary,'));
    const script = util.fill(pick(c.titleScript, 'My Love'));

    el.innerHTML =
      '<div class="s1-root">' +
        '<div class="s1-world" aria-hidden="true">' +
          '<div class="s1-base"></div>' +
          '<div class="s1-awake">' +
            '<div class="s1-glow"></div>' +
            '<div class="s1-leak s1-leak--a"></div>' +
            '<div class="s1-leak s1-leak--b"></div>' +
            // three planes of depth: far (c) · mid (b) · foreground (a). data-blur = target blur in CSS px
            '<div class="s1-bloom s1-bloom--c" data-blur="4.5"><div class="s1-bloom__drift">' +
              roseSVG('c', { seed: 7, blur: 2.5, rot: 18, squash: 0.84, base: '#120309', mid: '#3d0b1c', edge: '#8a2343', rim: '#e3bd7c', halo: '#7d1d3b' }) +
            '</div></div>' +
            '<div class="s1-bloom s1-bloom--b" data-blur="12"><div class="s1-bloom__drift">' +
              roseSVG('b', { seed: 21, blur: 3.6, rot: -12, squash: 0.9, base: '#1a050d', mid: '#6a1a37', edge: '#c24b6c', rim: '#f4b3c3', halo: '#b3123a' }) +
            '</div></div>' +
            '<div class="s1-bloom s1-bloom--a" data-blur="20"><div class="s1-bloom__drift">' +
              roseSVG('a', { seed: 3, blur: 4.5, rot: 40, squash: 0.94, base: '#0e0207', mid: '#4a0b1f', edge: '#8c1a37', rim: '#d0506e', halo: '#7d1d3b' }) +
            '</div></div>' +
            '<div class="s1-flare"></div>' +
          '</div>' +
        '</div>' +

        '<canvas class="s1-fx s1-fx--back" aria-hidden="true"></canvas>' +

        '<div class="s1-content">' +
          '<div class="s1-stack">' +
            '<p class="s1-eyebrow eyebrow"><span class="s1-rule s1-rule--l"></span>' +
              '<span class="s1-eyebrow__text">' + util.text(pick(c.eyebrow, 'For you…')) + '</span>' +
              '<span class="s1-rule s1-rule--r"></span></p>' +
            '<h1 class="s1-heading" aria-label="' + util.escapeHTML(title + ' ' + script) + '">' +
              '<span class="s1-title display" aria-hidden="true">' + util.escapeHTML(title) + '</span>' +
              '<span class="s1-scriptline" aria-hidden="true">' +
                '<span class="s1-scriptglow"></span>' +
                '<span class="s1-scriptwrap"><span class="s1-script">' + util.escapeHTML(script) + '</span></span>' +
                '<span class="s1-heart">' + heartSVG('s1-heart__svg', 's1hg2') + '</span>' +
              '</span>' +
            '</h1>' +
            '<p class="s1-sub lead">' + sentences(util.fill(pick(c.subtitle, 'I made you something. Put your sound on, and take your time.'))) + '</p>' +
            '<div class="s1-actions"><button class="btn s1-cta" type="button">' + util.text(pick(c.cta, 'Open Your Surprise')) + '</button></div>' +
          '</div>' +
          '<p class="s1-foot eyebrow" aria-hidden="true">' + util.text(footnote) + '</p>' +
        '</div>' +

        '<button class="s1-gate" type="button">' +
          '<span class="s1-gate__center">' +
            '<span class="s1-gate__heart">' +
              '<span class="s1-gate__halo"></span>' +
              '<span class="s1-ring"></span><span class="s1-ring"></span>' +
              heartSVG('s1-gate__svg', 's1hg1') +
            '</span>' +
            '<span class="s1-gate__text">' + util.text(gateText) + '</span>' +
            '<span class="s1-gate__hint">' + HEADPHONES + '<span>' + util.text(gateHint) + '</span></span>' +
          '</span>' +
        '</button>' +

        '<div class="s1-flash" aria-hidden="true"></div>' +
        '<canvas class="s1-fx s1-fx--front" aria-hidden="true"></canvas>' +
      '</div>';

    const q = (s) => el.querySelector(s);
    S = {
      el,
      root: q('.s1-root'), world: q('.s1-world'), awake: q('.s1-awake'), glow: q('.s1-glow'), flare: q('.s1-flare'),
      leakA: q('.s1-leak--a'), leakB: q('.s1-leak--b'),
      blooms: util.qsa('.s1-bloom', el), drifts: util.qsa('.s1-bloom__drift', el),
      cBack: q('.s1-fx--back'), cFront: q('.s1-fx--front'),
      stack: q('.s1-stack'), eyebrow: q('.s1-eyebrow'), rules: util.qsa('.s1-rule', el),
      title: q('.s1-title'), scriptLine: q('.s1-scriptline'), scriptWrap: q('.s1-scriptwrap'), scriptGlow: q('.s1-scriptglow'),
      heart: q('.s1-heart'), heartSvg: q('.s1-heart__svg'),
      sub: q('.s1-sub'), cta: q('.s1-cta'), foot: q('.s1-foot'),
      gate: q('.s1-gate'), gateHeart: q('.s1-gate__heart'), gateSvg: q('.s1-gate__svg'), gateHalo: q('.s1-gate__halo'),
      rings: util.qsa('.s1-ring', el), gateText: q('.s1-gate__text'), gateHint: q('.s1-gate__hint'),
      flash: q('.s1-flash'),
    };
    S.words = util.split(S.title).words;
    S.words.forEach((w) => { if (/\d/.test(w.textContent)) w.classList.add('s1-num'); });
    S.subWords = [];
    util.qsa('.s1-sent', S.sub).forEach((sn) => { S.subWords = S.subWords.concat(util.split(sn).words); });
    S.filters = S.blooms.map((b) => b.querySelector('.s1-blur'));

    // permanent listeners on our own nodes — guarded by `state`, never duplicated
    S.gate.addEventListener('click', () => begin({ fromUser: true }));
    S.cta.addEventListener('click', onCta);
  }

  /* --------------------------------------------------------------- enter */
  function enter() {
    if (!S) return;
    teardown();
    resetVisuals();
    state = 'gate';
    tuneBlooms();
    offs.push(util.onResize(tuneBlooms, 200));
    startParticles();
    startAmbient();
    bindPointer();

    const onKey = (e) => {
      if (state !== 'gate') return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); begin({ fromUser: true }); }
    };
    window.addEventListener('keydown', onKey);
    offs.push(() => window.removeEventListener('keydown', onKey));

    if (hasBegunOnce || (Love.audio && Love.audio.unlocked)) {
      // "watch again": sound is already on — skip the gate, go straight to the titles
      gsap.set(S.gate, { autoAlpha: 0 });
      audio('setIntensity', 0.22, 4);
      begin({ fromUser: false, withGate: false });
    } else {
      showGate();
    }
  }

  function resetVisuals() {
    const all = [S.root, S.world, S.awake, S.glow, S.flare, S.leakA, S.leakB, S.cBack, S.stack, S.eyebrow, S.title,
      S.scriptLine, S.scriptWrap, S.scriptGlow, S.heart, S.heartSvg, S.sub, S.cta, S.foot, S.gate, S.gateHeart,
      S.gateSvg, S.gateHalo, S.gateText, S.gateHint, S.flash]
      .concat(S.blooms, S.drifts, S.rules, S.rings, S.words, S.subWords);
    gsap.killTweensOf(all);
    gsap.set(all, { clearProps: 'all' });
    gsap.set(S.awake, { opacity: 0.3 });
    gsap.set(S.cBack, { opacity: 0.5 });
    gsap.set([S.eyebrow, S.scriptWrap, S.scriptGlow, S.heart, S.cta, S.foot, S.gateHeart, S.gateText, S.gateHint, S.flash].concat(S.words, S.subWords), { autoAlpha: 0 });
    gsap.set(S.flare, { opacity: 0 });
    S.gate.disabled = false;
  }

  /* ------------------------------------------------------------ ambience */
  /**
   * SVG blur is in viewBox units, so it shrinks with the rendered size. Convert
   * each rose's target blur (CSS px, scaled for small screens) into units.
   * Runs on enter + resize only — the filter is never animated.
   */
  function tuneBlooms() {
    if (!S) return;
    const k = util.clamp(Math.min(util.vw, util.vh) / 820, 0.55, 1);
    S.blooms.forEach((b, i) => {
      const fe = S.filters[i];
      const w = b.offsetWidth;
      if (!fe || !w) return;
      const px = parseFloat(b.dataset.blur || '8') * k;
      fe.setAttribute('stdDeviation', ((px * 250) / w).toFixed(2));
    });
  }

  function startParticles() {
    if (!Love.Particles) return;
    const small = Math.min(util.vw, util.vh) < 600;
    const k = small ? 0.75 : 1;
    fxBack = Love.Particles.create(S.cBack, {
      emitters: [
        { type: 'bokeh', count: Math.round(8 * k), size: [16, 60], opacity: [0.05, 0.15], colors: ['#ff7f9b', '#ffb3c4', '#f0b98a', '#e05a7a'] },
        { type: 'sparkles', count: Math.round(28 * k), size: [5, 12] },
        { type: 'petals', count: Math.round(9 * k), size: [6, 12], opacity: [0.5, 0.82] },
      ],
      wind: 12,
      speed: 0.7,
    }).start();
    fxFront = Love.Particles.create(S.cFront, {
      emitters: [{ type: 'petals', count: small ? 3 : 5, size: [13, 21], opacity: [0.78, 0.95] }],
      wind: 16,
      speed: 0.62,
    }).start();
  }

  function startAmbient() {
    const R = Love.reducedMotion;
    // the background slowly breathes
    loops.push(gsap.fromTo(S.glow, { opacity: 0.6, scale: R ? 1 : 0.94 },
      { opacity: 1, scale: R ? 1 : 1.07, duration: 6.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    if (R) return;
    // warm light leaks drifting at the edges
    loops.push(gsap.fromTo(S.leakA, { xPercent: -6, yPercent: -4, opacity: 0.55 },
      { xPercent: 10, yPercent: 8, opacity: 1, duration: 13, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    loops.push(gsap.fromTo(S.leakB, { xPercent: 6, yPercent: 4, opacity: 0.9 },
      { xPercent: -8, yPercent: -6, opacity: 0.5, duration: 17, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    // out-of-focus roses drifting
    const dx = [5, -6, 16], dy = [-4, 5, -10], rot = [9, -11, 14], dur = [27, 22, 19];
    S.drifts.forEach((d, i) => {
      loops.push(gsap.fromTo(d, { xPercent: -dx[i] * 0.4, yPercent: -dy[i] * 0.4, rotation: -rot[i] * 0.3 },
        { xPercent: dx[i], yPercent: dy[i], rotation: rot[i], duration: dur[i], ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    });
    // a slow camera push-in on the whole world
    loops.push(gsap.fromTo(S.world, { scale: 1.07 }, { scale: 1, duration: 16, ease: 'power2.out' }));
  }

  function bindPointer() {
    if (util.isTouch || Love.reducedMotion) return;
    const depth = [
      [S.blooms[2], 34], [S.blooms[1], 22], [S.blooms[0], 12], [S.glow, 10], [S.stack, -7],
    ];
    const qs = depth.map(([node, d]) => ({
      d,
      x: gsap.quickTo(node, 'x', { duration: 1.8, ease: 'power3.out' }),
      y: gsap.quickTo(node, 'y', { duration: 1.8, ease: 'power3.out' }),
    }));
    qs.forEach((q) => quick.push(q.x, q.y));
    const onMove = (e) => {
      if (state === 'leaving') return;
      const nx = (e.clientX / util.vw) * 2 - 1;
      const ny = (e.clientY / util.vh) * 2 - 1;
      qs.forEach((q) => { q.x(nx * q.d); q.y(ny * q.d); });
    };
    S.el.addEventListener('pointermove', onMove, { passive: true });
    offs.push(() => S.el.removeEventListener('pointermove', onMove));
  }

  /* ---------------------------------------------------------- STEP A gate */
  function showGate() {
    const R = Love.reducedMotion;
    gsap.set(S.gate, { autoAlpha: 1 });
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro
      .fromTo(S.gateHeart, { autoAlpha: 0, scale: R ? 1 : 0.6 }, { autoAlpha: 1, scale: 1, duration: R ? 0.6 : 1.8, ease: 'expo.out' }, 0.25)
      .fromTo(S.gateText, { autoAlpha: 0, y: R ? 0 : 10, filter: R ? 'none' : 'blur(6px)' },
        { autoAlpha: 1, y: 0, filter: R ? 'none' : 'blur(0px)', duration: R ? 0.6 : 1.5 }, R ? 0.4 : 0.95)
      .fromTo(S.gateHint, { autoAlpha: 0, y: R ? 0 : 6 }, { autoAlpha: 0.85, y: 0, duration: R ? 0.6 : 1.5 }, R ? 0.5 : 1.45)
      .set(S.gateText, { filter: 'none' });
    gateLoops.push(intro);

    // heartbeat: lub-dub, rest
    const beat = gsap.timeline({ repeat: -1, repeatDelay: R ? 1.6 : 1.05, delay: 1.1 });
    if (R) {
      beat.to(S.gateHalo, { opacity: 1, duration: 0.9, ease: 'sine.inOut' }).to(S.gateHalo, { opacity: 0.55, duration: 1.2, ease: 'sine.inOut' });
    } else {
      beat
        .to(S.gateSvg, { scale: 1.17, duration: 0.15, ease: 'power2.out' }, 0)
        .to(S.gateSvg, { scale: 0.97, duration: 0.2, ease: 'power2.in' }, 0.15)
        .to(S.gateSvg, { scale: 1.1, duration: 0.14, ease: 'power2.out' }, 0.35)
        .to(S.gateSvg, { scale: 1, duration: 0.55, ease: 'power2.inOut' }, 0.49)
        .fromTo(S.gateHalo, { opacity: 0.55, scale: 0.9 }, { opacity: 1, scale: 1.08, duration: 0.3, ease: 'power2.out' }, 0)
        .to(S.gateHalo, { opacity: 0.55, scale: 0.9, duration: 1.1, ease: 'sine.inOut' }, 0.4);
    }
    gateLoops.push(beat);

    // soft ripples — an invitation to touch
    if (!R) {
      S.rings.forEach((ring, i) => {
        gsap.set(ring, { scale: 0.9, opacity: 0 });
        gateLoops.push(gsap.to(ring, {
          keyframes: { scale: [0.9, 2.7], opacity: [0, 0.5, 0], easeEach: 'sine.out' },
          duration: 3.4, ease: 'power1.out', repeat: -1, delay: 1.6 + i * 1.7,
        }));
      });
    }
  }

  /* ----------------------------------------------- STEP B title sequence */
  function begin({ fromUser = false, withGate = true, autoplay = true } = {}) {
    if (state !== 'gate') return;
    state = 'title';
    hasBegunOnce = true;
    if (fromUser) {
      audio('unlock');
      audio('setIntensity', 0.22, 4);
      audio('cue', 'sparkle');
    }
    killAll(gateLoops);
    S.gate.disabled = true;

    if (withGate && fromUser && fxFront) {
      const p = centerOf(S.gateSvg);
      fxFront.burst(p.x, p.y, { type: 'sparkles', count: 26, spread: 0.9 });
      fxFront.burst(p.x, p.y, { type: 'petals', count: 8, spread: 0.6, scale: 0.8 });
    }
    master = buildMaster(withGate);
    if (autoplay) master.play();
  }

  function centerOf(node) {
    const r = node.getBoundingClientRect();
    const e = S.el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - e.left, y: r.top + r.height / 2 - e.top };
  }

  function buildMaster(withGate) {
    const R = Love.reducedMotion;
    const blur = (px) => (R ? 'blur(0px)' : 'blur(' + px + 'px)');
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    let t0;

    if (withGate) {
      const p = centerOf(S.gateSvg);
      gsap.set(S.flash, { x: p.x, y: p.y, xPercent: -50, yPercent: -50 });
      tl.to([S.gateText, S.gateHint], { autoAlpha: 0, y: R ? 0 : 12, filter: blur(6), duration: R ? 0.35 : 0.8, ease: 'power2.in', stagger: 0.06 }, 0)
        .to(S.rings, { autoAlpha: 0, duration: 0.4 }, 0)
        .to(S.gateHeart, { scale: R ? 1 : 2.1, duration: R ? 0.4 : 1.3, ease: 'expo.out' }, 0)
        .to(S.gateHeart, { autoAlpha: 0, duration: R ? 0.4 : 0.75, ease: 'power2.in' }, R ? 0 : 0.18)
        .fromTo(S.flash, { autoAlpha: 0, scale: 0.08 }, { autoAlpha: R ? 0.6 : 1, scale: 1, duration: R ? 0.4 : 0.65, ease: 'power2.out' }, 0.06)
        .to(S.flash, { autoAlpha: 0, scale: R ? 1 : 1.7, duration: R ? 0.6 : 1.9, ease: 'power2.inOut' }, R ? 0.45 : 0.62)
        .set(S.gate, { autoAlpha: 0 }, R ? 0.45 : 1.0);
      t0 = R ? 0.55 : 1.15;
    } else {
      t0 = R ? 0.2 : 0.5;
    }

    // the world wakes up
    const wake = withGate ? 0.12 : 0;
    tl.to(S.awake, { opacity: 1, duration: R ? 1 : 2.8, ease: 'sine.inOut' }, wake)
      .to(S.cBack, { opacity: 1, duration: R ? 1 : 2.8, ease: 'sine.inOut' }, wake);

    if (R) {
      // calm version: gentle fades, no blur, no travel
      tl.to(S.eyebrow, { autoAlpha: 1, duration: 0.8 }, t0)
        .to(S.words, { autoAlpha: 1, duration: 0.8, stagger: 0.08 }, t0 + 0.3)
        .to([S.scriptWrap, S.scriptGlow], { autoAlpha: 1, duration: 0.9 }, t0 + 0.8);
      T.land = t0 + 1.3;
      tl.call(onLanded, null, T.land)
        .to(S.heart, { autoAlpha: 1, duration: 0.6 }, T.land)
        .to(S.subWords, { autoAlpha: 1, duration: 0.8 }, t0 + 1.5)
        .to(S.cta, { autoAlpha: 1, duration: 0.8 }, t0 + 2)
        .to(S.foot, { autoAlpha: 1, duration: 1 }, t0 + 2.3);
      return tl;
    }

    // eyebrow + hairlines
    tl.fromTo(S.eyebrow, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 1.5 }, t0)
      .fromTo(S.rules, { scaleX: 0 }, { scaleX: 1, duration: 1.8, ease: 'expo.out' }, t0 + 0.25);

    // "Happy 4th Monthsary," — words rise out of a soft blur
    tl.fromTo(S.words, { autoAlpha: 0, yPercent: 42, filter: 'blur(14px)' },
      { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.7, stagger: 0.2 }, t0 + 0.55);

    // "My Love" — written in from the left with a soft edge
    const ts = t0 + 1.6;
    tl.fromTo(S.scriptWrap, { '--wipe': '100%' }, { '--wipe': '0%', duration: 1.9, ease: 'power1.inOut' }, ts)
      .fromTo(S.scriptWrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' }, ts)
      .fromTo(S.scriptWrap, { y: 14, filter: 'blur(7px)' }, { y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' }, ts)
      .fromTo(S.scriptGlow, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 2.6, ease: 'sine.out' }, ts + 0.3);

    // the heart lands, the chime rings
    T.land = ts + 1.6;
    tl.call(onLanded, null, T.land)
      .fromTo(S.heart, { autoAlpha: 0, scale: 0, rotation: -24 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 1, ease: 'back.out(2.4)' }, T.land);

    // subtitle — a soft cascade
    tl.fromTo(S.subWords, { autoAlpha: 0, y: 10, filter: 'blur(6px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.045, ease: 'power2.out' }, T.land + 0.25);

    // CTA rises in last
    const tc = T.land + 1.0;
    tl.fromTo(S.cta, { autoAlpha: 0, y: 28, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.5, ease: 'expo.out' }, tc)
      .fromTo(S.foot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.2, ease: 'sine.inOut' }, tc + 0.5);

    // drop finished filters so nothing stays on an offscreen layer
    tl.set(S.words.concat(S.subWords, [S.scriptWrap]), { filter: 'none' }, tc + 0.4);
    return tl;
  }

  function onLanded() {
    audio('cue', 'chime');
    startHeartBeat();
  }

  function startHeartBeat() {
    if (beatTl) return;
    const R = Love.reducedMotion;
    beatTl = gsap.timeline({ repeat: -1, repeatDelay: R ? 2.4 : 1.6, delay: 0.7 });
    if (R) {
      beatTl.to(S.heartSvg, { opacity: 0.7, duration: 0.8, ease: 'sine.inOut' }).to(S.heartSvg, { opacity: 1, duration: 0.8, ease: 'sine.inOut' });
    } else {
      beatTl
        .to(S.heartSvg, { scale: 1.2, duration: 0.14, ease: 'power2.out' })
        .to(S.heartSvg, { scale: 0.96, duration: 0.18, ease: 'power2.in' })
        .to(S.heartSvg, { scale: 1.1, duration: 0.13, ease: 'power2.out' })
        .to(S.heartSvg, { scale: 1, duration: 0.5, ease: 'power2.inOut' });
    }
  }

  /* ----------------------------------------------------------------- CTA */
  function onCta() {
    if (state !== 'title') return;
    state = 'exiting';
    const R = Love.reducedMotion;
    if (master) { master.kill(); master = null; }
    S.cta.disabled = true;
    audio('cue', 'whoosh');

    if (fxFront) {
      const p = centerOf(S.cta);
      fxFront.burst(p.x, p.y, { type: 'petals', count: 26, spread: 1.15 });
      fxFront.burst(p.x, p.y, { type: 'sparkles', count: 30, spread: 1.4 });
      fxFront.burst(p.x, p.y, { type: 'hearts', count: 5, spread: 0.6, scale: 0.75 });
    }
    if (fxBack && !R) gsap.to(fxBack.state, { wind: 70, speed: 1.6, duration: 1.6, ease: 'power2.in' });

    const blur = (px) => (R ? 'blur(0px)' : 'blur(' + px + 'px)');
    exitTl = gsap.timeline({ onComplete: () => { exitTl = null; Love.next(); } });
    exitTl
      .to(S.cta, { scale: R ? 1 : 1.07, duration: 0.22, ease: 'power2.out' }, 0)
      .to(S.cta, { autoAlpha: 0, scale: R ? 1 : 0.92, filter: blur(8), duration: R ? 0.4 : 0.7, ease: 'power2.in' }, 0.18)
      .to([S.foot, S.sub, S.scriptLine, S.title, S.eyebrow],
        { autoAlpha: 0, y: R ? 0 : -38, filter: blur(12), duration: R ? 0.5 : 1.25, ease: 'power2.in', stagger: R ? 0 : 0.08 }, R ? 0.1 : 0.12)
      .to(S.flare, { opacity: 1, duration: R ? 0.5 : 1.5, ease: 'sine.inOut' }, 0)
      .fromTo(S.flare, { scale: 0.85 }, { scale: R ? 0.85 : 1.25, duration: 1.8, ease: 'sine.out' }, 0);
  }

  /* --------------------------------------------------------------- leave */
  function leave() {
    if (!S || state === 'idle') return Promise.resolve();
    state = 'leaving';
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(leaveTimer);
        teardown();
        resolve();
      };
      // fade the whole world to black while the petals are still drifting
      // (teardown runs outside the GSAP callback: killTweensOf inside onComplete misses tweens)
      gsap.to(S.root, { autoAlpha: 0, duration: Love.reducedMotion ? 0.3 : 0.9, ease: 'power2.inOut', onComplete: () => setTimeout(finish, 0) });
      leaveTimer = setTimeout(finish, 2600); // safety net
    });
  }

  /** Stop every loop, tween, particle system and listener this stage owns. */
  function teardown() {
    if (master) { master.kill(); master = null; }
    if (exitTl) { exitTl.kill(); exitTl = null; }
    if (beatTl) { beatTl.kill(); beatTl = null; }
    killAll(loops);
    killAll(gateLoops);
    offs.forEach((off) => { try { off(); } catch (e) { /* noop */ } });
    offs = [];
    quick.forEach((f) => f.tween && f.tween.kill());
    quick = [];
    if (fxBack) { gsap.killTweensOf(fxBack.state); fxBack.destroy(); fxBack = null; }
    if (fxFront) { fxFront.destroy(); fxFront = null; }
    if (S) {
      gsap.killTweensOf([S.root, S.world, S.glow, S.stack, S.flare].concat(S.blooms));
      S.cta.disabled = false;
    }
    state = 'idle';
  }

  /* ---------------------------------------------------------------- seek */
  function seek(t) {
    if (!S || state === 'idle' || state === 'leaving' || state === 'exiting') return;
    if (state === 'gate') begin({ fromUser: false, withGate: true, autoplay: false });
    if (!master) return;
    t = Math.max(0, +t || 0);
    master.pause();
    master.seek(t, true);
    if (t >= T.land) startHeartBeat();
  }

  Love.register({
    index: 1,
    id: 'stage1',
    transition: 'black',
    init,
    enter,
    leave,
    seek,
  });
})();
