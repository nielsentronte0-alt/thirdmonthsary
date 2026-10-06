/* ==========================================================================
   core.js — the shared contract every stage builds on.

   window.Love
     .config            → window.LOVE_CONFIG
     .util              → small DOM / math / text helpers (see below)
     .register(def)     → add a stage (called by js/stageN.js)
     .go(n) / .next()   → cinematic transition to stage n / the next stage
     .veil              → full-screen transition overlay (black | warm | rose)
     .on/.off/.emit     → tiny event bus
     .reducedMotion     → user prefers less motion
     .debug             → ?stage=N  ?seek=T  ?speed=X  (see bottom)

   Stage definition (one per js/stageN.js):
     Love.register({
       index: 1,                 // 1..4, order of play
       id: 'intro',
       transition: 'black',      // veil style used when ENTERING this stage
       init(el)  {},             // build DOM into <section id="stage-N">, once
       enter()   {},             // section is now visible: start animations
       leave()   { return Promise }, // exit anim + STOP every loop/timeline
       seek(t)   {},             // optional, debug: jump master timeline to t s & pause
     });
   ========================================================================== */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------- utilities */
  const util = {
    qs: (sel, root = document) => root.querySelector(sel),
    qsa: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

    /** html string → first Element (or DocumentFragment if many roots). */
    el(html) {
      const t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
    },

    escapeHTML: (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,

    ordinal(n) {
      const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },

    /** Replace {nth} {herName} {hisName} {monthsary} tokens from config. */
    fill(str) {
      const c = Love.config;
      return String(str ?? '')
        .replace(/\{nth\}/g, util.ordinal(c.monthsary))
        .replace(/\{monthsary\}/g, c.monthsary)
        .replace(/\{herName\}/g, c.herName)
        .replace(/\{hisName\}/g, c.hisName);
    },

    /** Safe text for innerHTML: fill tokens, escape, keep \n as <br>. */
    text(str) {
      return util.escapeHTML(util.fill(str)).replace(/\n/g, '<br>');
    },

    /**
     * Wrap words (and optionally chars) of an element in spans for GSAP.
     * Returns { words: [], chars: [] }. Keeps emoji / spaces intact and is
     * idempotent (re-running restores from data-split-src first).
     */
    split(el, { chars = false } = {}) {
      if (!el.dataset.splitSrc) el.dataset.splitSrc = el.textContent;
      const src = el.dataset.splitSrc;
      el.textContent = '';
      el.setAttribute('aria-label', src);
      const words = [], allChars = [];
      src.split(/(\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'split-word';
        w.setAttribute('aria-hidden', 'true');
        if (chars) {
          Array.from(tok).forEach((ch) => {
            const c = document.createElement('span');
            c.className = 'split-char';
            c.textContent = ch;
            w.appendChild(c);
            allChars.push(c);
          });
        } else {
          w.textContent = tok;
        }
        el.appendChild(w);
        words.push(w);
      });
      return { words, chars: allChars };
    },

    /** Debounced resize listener; returns an unsubscribe fn. */
    onResize(fn, delay = 120) {
      let t;
      const h = () => { clearTimeout(t); t = setTimeout(fn, delay); };
      window.addEventListener('resize', h);
      window.addEventListener('orientationchange', h);
      return () => {
        window.removeEventListener('resize', h);
        window.removeEventListener('orientationchange', h);
      };
    },

    /** Picture markup for a photo base path (no extension): webp + jpg fallback. */
    picture(base, alt, cls = '') {
      const a = util.escapeHTML(alt || '');
      return `<picture class="${cls}"><source srcset="${base}.webp" type="image/webp">` +
        `<img src="${base}.jpg" alt="${a}" loading="lazy" decoding="async" draggable="false"></picture>`;
    },

    /** Preload image URLs; calls onProgress(0..1). Never rejects. */
    preload(urls, onProgress) {
      let done = 0;
      const total = urls.length || 1;
      return Promise.all(urls.map((u) => new Promise((res) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = img.onerror = () => { done++; onProgress && onProgress(done / total); res(); };
        img.src = u;
      })));
    },

    isTouch: window.matchMedia('(hover: none)').matches,
    get vw() { return window.innerWidth; },
    get vh() { return window.innerHeight; },
    get isPortrait() { return window.innerHeight >= window.innerWidth; },
  };

  /* ------------------------------------------------------------ event bus */
  const listeners = {};
  const on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return () => off(evt, fn); };
  const off = (evt, fn) => { listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn); };
  const emit = (evt, data) => (listeners[evt] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); } });

  /* ----------------------------------------------------------------- veil */
  const veil = {
    get node() { return document.getElementById('veil'); },
    /** Cover the screen. style: 'black' | 'warm' (golden bloom) | 'rose'. */
    in(style = 'black', duration = 0.9) {
      const v = veil.node;
      v.dataset.style = style;
      return new Promise((resolve) => {
        gsap.killTweensOf(v);
        gsap.set(v, { visibility: 'visible', pointerEvents: 'auto' });
        gsap.fromTo(v, { opacity: 0 }, { opacity: 1, duration: Love.reducedMotion ? 0.25 : duration, ease: 'power2.inOut', onComplete: resolve });
      });
    },
    out(duration = 1.1) {
      const v = veil.node;
      return new Promise((resolve) => {
        gsap.killTweensOf(v);
        gsap.to(v, {
          opacity: 0, duration: Love.reducedMotion ? 0.25 : duration, ease: 'power2.inOut',
          onComplete: () => { gsap.set(v, { visibility: 'hidden', pointerEvents: 'none' }); resolve(); },
        });
      });
    },
  };

  /* ------------------------------------------------------- stage manager */
  const stages = [];
  let current = null;
  let busy = false;

  function register(def) {
    def.el = document.getElementById('stage-' + def.index);
    def._inited = false;
    stages.push(def);
    stages.sort((a, b) => a.index - b.index);
  }

  function ensureInit(s) {
    if (s._inited) return;
    s._inited = true;
    try { s.init && s.init(s.el); } catch (e) { console.error('[stage ' + s.index + '] init failed', e); }
  }

  function show(s) {
    s.el.hidden = false;
    s.el.removeAttribute('aria-hidden');
    s.el.classList.add('is-active');
    document.body.dataset.stage = s.index;
  }

  function hide(s) {
    s.el.classList.remove('is-active');
    s.el.setAttribute('aria-hidden', 'true');
    s.el.hidden = true;
  }

  async function go(index, { instant = false } = {}) {
    const target = stages.find((s) => s.index === index);
    if (!target || busy || target === current) return;
    busy = true;
    const prev = current;
    try {
      if (prev) {
        emit('stage:leave', prev.index);
        try { await (prev.leave && prev.leave()); } catch (e) { console.error(e); }
      }
      if (!instant) await veil.in(target.transition || 'black');
      if (prev) hide(prev);
      ensureInit(target);
      show(target);
      current = target;
      window.scrollTo(0, 0);
      target.el.scrollTop = 0;
      // let layout settle one frame so stages can measure themselves
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      emit('stage:enter', target.index);
      try { target.enter && target.enter(); } catch (e) { console.error('[stage ' + index + '] enter failed', e); }
      if (!instant) await veil.out(); else gsap.set(veil.node, { opacity: 0, visibility: 'hidden', pointerEvents: 'none' });
    } finally {
      busy = false;
    }
  }

  function next() {
    if (!current) return go(stages[0].index);
    const i = stages.indexOf(current);
    if (i < stages.length - 1) return go(stages[i + 1].index);
  }

  /** Restart from stage 1 (used by the "watch again" button). */
  function restart() { return go(stages[0].index); }

  /* ------------------------------------------------------------ the object */
  const Love = (window.Love = {
    config: window.LOVE_CONFIG,
    util,
    on, off, emit,
    veil,
    register,
    go, next, restart,
    get current() { return current; },
    get stages() { return stages; },
    get busy() { return busy; },
    reducedMotion: mqReduce.matches || params.has('reduced'),
    params,
    debug: {
      /** ?seek=T or Love.debug.seek(T): jump current stage's master timeline. */
      seek(t) { if (current && current.seek) current.seek(+t); },
      go: (n) => go(+n, { instant: true }),
    },
  });

  mqReduce.addEventListener && mqReduce.addEventListener('change', (e) => { Love.reducedMotion = e.matches; });
})();
