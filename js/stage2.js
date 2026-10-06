/* ==========================================================================
   stage2.js — "Our Little Story"
   A scroll-driven relationship timeline: a glowing line that draws itself,
   polaroids that drop in and develop like instant film, little notes that
   float between them, a tap-to-enlarge lightbox, and a CTA into stage 3.

   The section (#stage-2) is its own vertical scroll container, so every
   ScrollTrigger uses `scroller: el`. Everything animated is created inside a
   gsap.context() in enter() and reverted in leave(), so re-entering works.
   ========================================================================== */
(function () {
  'use strict';
  const { util } = Love;

  /* Per-photo framing, keyed by file name (no extension). `wide` = landscape
     instant-film format. Unknown photos are auto-detected on load. */
  const PHOTO_TWEAKS = {
    'call-late-night': { pos: '50% 46%' },
    'her-selfie': { pos: '50% 30%' },
    'call-candles': { pos: '50% 50%' },
    'call-genos': { pos: '50% 50%' },
    'her-golden-hour': { pos: '30% 18%' },
    'robin-starfire': { pos: '50% 42%', wide: true },
  };
  const ROT = [-3.2, 2.6, -2.2, 3.4, -2.6, 2.2];
  const ACCENT = ['tape', 'tape-corner', 'pin'];

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>';
  const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  /* ------------------------------------------------------------- state */
  let el = null;            // the <section>, also the scroller
  const R = () => Love.reducedMotion;
  const $ = {};             // cached nodes
  let moments = [];         // [{ el, fig, node, side, note, wrap, num, develop, img, lift, rest, accent, sweep, rot, i, wide }]
  let ctx = null, fx = null, intro = null, active = false;
  let counterTimer = 0, ctaTimer = 0, ctaFired = false;
  let lastY = 0, lastT = 0, lastJumpAt = -1e9, lastSparkle = 0, fastFling = false;
  let lb = null;            // open lightbox state

  const cfg = () => (Love.config && Love.config.stage2) || {};
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ------------------------------------------------------------ helpers */
  function parseStart(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) || d > new Date() ? null : d;
  }

  function photoKey(base) { return String(base || '').split('/').pop(); }

  /* ------------------------------------------------------------- build */
  function build() {
    const c = cfg();
    const list = Array.isArray(c.moments) ? c.moments : [];

    // title: every word but the last on line one, the last as an italic accent
    const words = util.fill(c.title || 'Our Little Story').trim().split(/\s+/);
    const lastWord = words.pop() || '';
    const titleHTML =
      (words.length ? `<span class="s2-title__l1">${words.map((w) => `<span class="s2-w">${util.escapeHTML(w)}</span>`).join(' ')}</span>` : '') +
      `<span class="s2-title__l2"><em class="s2-w">${util.escapeHTML(lastWord)}</em></span>`;

    const start = parseStart(Love.config && Love.config.startDate);
    const counterHTML = start
      ? `<div class="s2-counter" role="group" aria-label="Days together">
           <span class="s2-counter__heart">${HEART}</span>
           <span class="s2-counter__num">0</span>
           <span class="s2-counter__lbl">days together</span>
           <span class="s2-counter__live" aria-hidden="true"></span>
         </div>`
      : '';

    const momentsHTML = list.map((m, i) => {
      const key = photoKey(m.photo);
      const tw = PHOTO_TWEAKS[key] || {};
      const side = i % 2 === 0 ? 'l' : 'r';
      const accent = ACCENT[i % ACCENT.length];
      const accentHTML = accent === 'pin'
        ? '<span class="s2-pin" aria-hidden="true"></span>'
        : `<span class="s2-tape s2-tape--${accent === 'tape' ? 'top' : 'corner'}" aria-hidden="true"></span>`;
      const cap = util.text(m.caption || '');
      const label = util.escapeHTML('Open photo: ' + util.fill(m.caption || m.alt || 'photo'));
      return `
      <article class="s2-moment s2-moment--${side}${tw.wide ? ' is-wide' : ''}" data-i="${i}" style="--rot:${ROT[i % ROT.length]}deg">
        <div class="s2-side">
          <span class="s2-num" aria-hidden="true">${pad2(i + 1)}</span>
          <p class="s2-chapter"><span class="s2-node" aria-hidden="true"><span class="s2-node__core"></span></span><span class="s2-chapter__n">${pad2(i + 1)}</span><span class="s2-chapter__dash" aria-hidden="true"></span><span class="s2-chapter__t">${util.text(m.chapter || '')}</span></p>
        </div>
        <div class="s2-card-wrap">
          <figure class="s2-polaroid" tabindex="0" role="button" aria-label="${label}">
            <span class="s2-shadow s2-shadow--rest" aria-hidden="true"></span>
            <span class="s2-shadow s2-shadow--lift" aria-hidden="true"></span>
            <div class="s2-photo">
              ${util.picture(m.photo, m.alt || '', 's2-pic')}
              <span class="s2-develop" aria-hidden="true"></span>
              <span class="s2-gloss" aria-hidden="true"></span>
              <span class="s2-sweep" aria-hidden="true"></span>
            </div>
            <figcaption class="s2-caption">${cap}</figcaption>
            ${accentHTML}
          </figure>
        </div>
        ${m.note ? `<p class="s2-note"><span class="s2-note__heart">${HEART}</span><span class="s2-note__t">${util.text(m.note)}</span></p>` : ''}
      </article>`;
    }).join('');

    const outroScript = c.outroScript != null ? c.outroScript : 'to be continued';
    const outro = c.outro != null ? c.outro : 'And the best part is still on its way…';

    el.innerHTML = `
      <div class="s2-bg" aria-hidden="true">
        <div class="s2-bg__base"></div>
        <div class="s2-bg__leak s2-bg__leak--a"></div>
        <div class="s2-bg__leak s2-bg__leak--b"></div>
        <div class="s2-bg__warm"></div>
        <canvas class="s2-fx"></canvas>
      </div>

      <div class="s2-content">
        <header class="s2-hero">
          <div class="s2-hero__inner">
            <p class="s2-eyebrow"><span class="s2-eyebrow__rule"></span><span class="s2-eyebrow__t">${util.text(c.eyebrow || 'Chapter two')}</span><span class="s2-eyebrow__rule"></span></p>
            <h2 class="s2-title">${titleHTML}</h2>
            <div class="s2-orn" aria-hidden="true"><span></span>${HEART}<span></span></div>
            ${c.subtitle ? `<p class="s2-sub">${util.text(c.subtitle)}</p>` : ''}
            ${counterHTML}
          </div>
          <div class="s2-hint" aria-hidden="true"><div class="s2-hint__inner"><span class="s2-hint__line"><i></i></span><span class="s2-hint__t">Scroll</span></div></div>
        </header>

        <div class="s2-timeline">
          <div class="s2-line" aria-hidden="true">
            <span class="s2-line__track"></span>
            <span class="s2-line__fill"></span>
            <span class="s2-line__head"></span>
          </div>
          ${momentsHTML}
        </div>

        <footer class="s2-end">
          <div class="s2-end__inner">
            <span class="s2-end__orn" aria-hidden="true">${HEART}</span>
            ${outroScript ? `<p class="s2-end__script">${util.text(outroScript)}</p>` : ''}
            ${outro ? `<p class="s2-end__line">${util.text(outro)}</p>` : ''}
            <button class="btn s2-cta" type="button">${util.text(c.cta || 'Wait… what’s that?')}</button>
          </div>
        </footer>
      </div>

      <div class="s2-lb" role="dialog" aria-modal="true" aria-label="Photo" hidden>
        <div class="s2-lb__backdrop"></div>
        <p class="s2-lb__meta"></p>
        <div class="s2-lb__stage"></div>
        <button class="s2-lb__close" type="button" aria-label="Close photo">${CLOSE}</button>
      </div>`;

    const q = (s) => el.querySelector(s);
    Object.assign($, {
      bg: q('.s2-bg'), bgBase: q('.s2-bg__base'), leakA: q('.s2-bg__leak--a'), leakB: q('.s2-bg__leak--b'),
      warm: q('.s2-bg__warm'), canvas: q('.s2-fx'), content: q('.s2-content'),
      hero: q('.s2-hero'), heroInner: q('.s2-hero__inner'), eyebrow: q('.s2-eyebrow'),
      words: util.qsa('.s2-w', el), orn: q('.s2-orn'), sub: q('.s2-sub'), counter: q('.s2-counter'),
      counterNum: q('.s2-counter__num'), counterLive: q('.s2-counter__live'),
      hint: q('.s2-hint'), hintInner: q('.s2-hint__inner'),
      timeline: q('.s2-timeline'), line: q('.s2-line'), lineFill: q('.s2-line__fill'), lineHead: q('.s2-line__head'),
      end: q('.s2-end'), endOrn: q('.s2-end__orn'), endScript: q('.s2-end__script'), endLine: q('.s2-end__line'), cta: q('.s2-cta'),
      lb: q('.s2-lb'), lbBackdrop: q('.s2-lb__backdrop'), lbStage: q('.s2-lb__stage'), lbClose: q('.s2-lb__close'), lbMeta: q('.s2-lb__meta'),
    });
    $.start = start;

    moments = util.qsa('.s2-moment', el).map((m, i) => {
      const data = list[i] || {};
      const key = photoKey(data.photo);
      const tw = PHOTO_TWEAKS[key] || {};
      const img = m.querySelector('img');
      if (img) {
        img.loading = 'eager';
        if (tw.pos) img.style.objectPosition = tw.pos;
        // unknown landscape photos get the wide instant-film format automatically
        if (!PHOTO_TWEAKS[key]) {
          const check = () => {
            if (img.naturalWidth && img.naturalWidth / img.naturalHeight > 1.2 && !m.classList.contains('is-wide')) {
              m.classList.add('is-wide');
              if (active && window.ScrollTrigger) ScrollTrigger.refresh();
            }
          };
          img.complete ? check() : img.addEventListener('load', check, { once: true });
        }
      }
      return {
        el: m, i, data,
        rot: ROT[i % ROT.length],
        fig: m.querySelector('.s2-polaroid'),
        node: m.querySelector('.s2-node'),
        side: m.querySelector('.s2-side'),
        num: m.querySelector('.s2-num'),
        chapter: m.querySelector('.s2-chapter'),
        label: Array.from(m.querySelectorAll('.s2-chapter__n, .s2-chapter__dash, .s2-chapter__t')),
        note: m.querySelector('.s2-note'),
        noteHeart: m.querySelector('.s2-note__heart'),
        wrap: m.querySelector('.s2-card-wrap'),
        develop: m.querySelector('.s2-develop'),
        sweep: m.querySelector('.s2-sweep'),
        lift: m.querySelector('.s2-shadow--lift'),
        rest: m.querySelector('.s2-shadow--rest'),
        accent: m.querySelector('.s2-tape, .s2-pin'),
        caption: m.querySelector('.s2-caption'),
        img,
      };
    });

    /* ---- listeners that live for the lifetime of the DOM (guarded by `active`) */
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKeyLocal);
    $.cta.addEventListener('click', onCta);
  }

  /* ------------------------------------------------------- interaction */
  function momentOf(node) {
    const art = node && node.closest('.s2-moment');
    return art ? moments[+art.dataset.i] : null;
  }

  function onClick(e) {
    if (!active) return;
    if (lb) {
      if (e.target.closest('.s2-lb')) { e.preventDefault(); closeLightbox(); }
      return;
    }
    const fig = e.target.closest('.s2-polaroid');
    if (fig && !fig.closest('.s2-lb')) openLightbox(momentOf(fig));
  }

  function onKeyLocal(e) {
    if (!active || lb) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('s2-polaroid')) {
      e.preventDefault();
      openLightbox(momentOf(e.target));
    }
  }

  function onKeyDoc(e) {
    if (!lb) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'Tab') { e.preventDefault(); $.lbClose.focus({ preventScroll: true }); } // only one control: keep focus inside
  }

  function onCta() {
    if (!active || ctaFired || Love.busy) return;
    ctaFired = true;
    $.cta.setAttribute('aria-disabled', 'true');
    Love.audio && Love.audio.cue('whoosh');
    if (fx) {
      const b = $.cta.getBoundingClientRect(), c = $.canvas.getBoundingClientRect();
      const x = b.left + b.width / 2 - c.left, y = b.top + b.height / 2 - c.top;
      fx.burst(x, y, { type: 'petals', count: 22, spread: 1.1 });
      fx.burst(x, y, { type: 'sparkles', count: 14, spread: 0.8 });
    }
    ctaTimer = setTimeout(() => { if (active) Love.next(); }, R() ? 120 : 520);
  }

  function onScroll() {
    const y = el.scrollTop, t = performance.now();
    const dy = y - lastY, dt = Math.max(8, t - lastT);
    // a jump of half a screen in one event = programmatic / anchor jump → don't make them wait
    if (Math.abs(dy) > window.innerHeight * 0.5) lastJumpAt = t;
    const v = (Math.abs(dy) / dt) * 1000;
    fastFling = v > 5200;
    lastY = y; lastT = t;
    // particles respond to scroll speed: a breath of wind while scrolling
    if (fx && !R() && dt < 200) {
      const target = 1 + Math.min(1.6, v / 2400);
      if (target > fx.state.speed + 0.08) {
        gsap.to(fx.state, {
          speed: target, duration: 0.25, overwrite: true,
          onComplete: () => fx && gsap.to(fx.state, { speed: 1, duration: 1.6, ease: 'sine.out' }),
        });
      }
    }
  }

  /** play a reveal; instantly-ish if the reader jumped or flung past it */
  function playReveal(tl) {
    if (!tl) return;
    const jumped = performance.now() - lastJumpAt < 400;
    tl.timeScale(jumped ? 5 : fastFling ? 2 : 1).play();
  }

  function sparkle() {
    const t = performance.now();
    if (t - lastSparkle < 1600) return;
    lastSparkle = t;
    Love.audio && Love.audio.cue('sparkle');
  }

  /* ---------------------------------------------------------- lightbox */
  function openLightbox(m) {
    if (!m || lb || !active || Love.busy) return;
    const fig = m.fig;
    const r = fig.getBoundingClientRect();
    const w = fig.offsetWidth, h = fig.offsetHeight;
    if (!w || !h) return;

    const clone = fig.cloneNode(true);
    ['tabindex', 'role', 'aria-label', 'style'].forEach((a) => clone.removeAttribute(a));
    clone.classList.add('s2-polaroid--lb');
    clone.querySelectorAll('.s2-develop, .s2-shadow--lift, .s2-sweep').forEach((n) => n.remove());
    clone.querySelectorAll('[style]').forEach((n) => { if (!n.matches('img')) n.removeAttribute('style'); });
    const cimg = clone.querySelector('img');
    if (cimg) { cimg.style.filter = 'none'; cimg.style.objectPosition = m.img ? m.img.style.objectPosition : ''; }
    if (m.el.classList.contains('is-wide')) clone.classList.add('is-wide');
    clone.style.width = w + 'px';
    $.lbStage.appendChild(clone);

    $.lbMeta.innerHTML = `<span>${pad2(m.i + 1)}</span><span class="s2-lb__dash"></span><span>${util.text(m.data.chapter || '')}</span>`;
    $.lb.hidden = false;

    const vw = window.innerWidth, vh = window.innerHeight;
    const top = Math.min(84, vh * 0.12), bottom = Math.min(108, vh * 0.17);
    const maxW = Math.min(vw - 32, m.el.classList.contains('is-wide') ? 860 : 520);
    const maxH = vh - top - bottom;
    let s = Math.min(maxW / w, maxH / h);
    // don't blow small source images up past ~1.3× their native width
    const photoW = (fig.querySelector('.s2-photo') || fig).offsetWidth;
    if (m.img && m.img.naturalWidth && photoW) s = Math.min(s, Math.max(1, (m.img.naturalWidth * 1.3) / photoW));
    const ty = top + maxH / 2 - vh / 2;
    const from = {
      x: r.left + r.width / 2 - vw / 2,
      y: r.top + r.height / 2 - vh / 2,
      rotation: +gsap.getProperty(fig, 'rotation') || m.rot,
      scale: +gsap.getProperty(fig, 'scale') || 1,
    };

    gsap.set(clone, { xPercent: -50, yPercent: -50, ...from });
    fig.style.visibility = 'hidden';
    el.classList.add('s2-is-locked');

    const d = R() ? 0.3 : 0.95;
    const tl = gsap.timeline();
    tl.fromTo($.lbBackdrop, { opacity: 0 }, { opacity: 1, duration: d * 0.7, ease: 'power2.out' }, 0)
      .to(clone, { x: 0, y: ty, rotation: 0, scale: s, duration: d, ease: R() ? 'power2.out' : 'expo.out' }, 0)
      .fromTo([$.lbMeta, $.lbClose], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' }, d * 0.4);

    lb = { m, clone, tl };
    document.addEventListener('keydown', onKeyDoc);
    $.lbClose.focus({ preventScroll: true });
    Love.audio && Love.audio.cue('heart');
  }

  function closeLightbox(instant) {
    if (!lb) return;
    const { m, clone, tl } = lb;
    lb = null;
    document.removeEventListener('keydown', onKeyDoc);
    tl.kill();
    const done = () => {
      clone.remove();
      m.fig.style.visibility = '';
      $.lb.hidden = true;
      el.classList.remove('s2-is-locked');
    };
    if (instant) {
      gsap.killTweensOf([clone, $.lbBackdrop, $.lbMeta, $.lbClose]);
      done();
      return;
    }
    const r = m.fig.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const d = R() ? 0.3 : 0.75;
    gsap.to([$.lbMeta, $.lbClose], { opacity: 0, duration: 0.25, overwrite: true });
    gsap.to($.lbBackdrop, { opacity: 0, duration: d * 0.8, delay: d * 0.15, ease: 'power2.inOut' });
    gsap.to(clone, {
      x: r.left + r.width / 2 - vw / 2,
      y: r.top + r.height / 2 - vh / 2,
      rotation: +gsap.getProperty(m.fig, 'rotation') || m.rot,
      scale: 1, duration: d, ease: 'power3.inOut',
      onComplete: () => { done(); try { m.fig.focus({ preventScroll: true }); } catch (e) { /* noop */ } },
    });
  }

  /* --------------------------------------------------------- particles */
  function startFX() {
    if (!Love.Particles || !$.canvas) return;
    const small = window.innerWidth < 720;
    fx = Love.Particles.create($.canvas, {
      emitters: [
        { type: 'bokeh', count: small ? 7 : 12, opacity: [0.04, 0.16], size: [16, 60], colors: ['#f08aa3', '#d9b26f', '#ffb3c4', '#c8284f'] },
        { type: 'hearts', count: small ? 6 : 10, opacity: [0.14, 0.42], size: [5, 12], speed: 0.55, colors: ['#e05a7a', '#f1a9b9', '#ff8fa8', '#d9b26f'] },
        { type: 'petals', count: small ? 7 : 13, opacity: [0.35, 0.72], size: [6, 13], speed: 0.6 },
      ],
      wind: 6,
      speed: 1,
    });
    fx.start();
  }

  /* ----------------------------------------------------- days counter */
  function tickCounter() {
    if (!$.start || !$.counterLive) return;
    const ms = Date.now() - $.start.getTime();
    const days = Math.floor(ms / 86400000);
    const rest = ms - days * 86400000;
    const hh = Math.floor(rest / 3600000), mm = Math.floor((rest % 3600000) / 60000), ss = Math.floor((rest % 60000) / 1000);
    $.counterLive.textContent = `${pad2(hh)}h ${pad2(mm)}m ${pad2(ss)}s`;
    if (!$.counterCounting) $.counterNum.textContent = days.toLocaleString();
    return days;
  }

  /* -------------------------------------------------------- the intro */
  function buildIntro() {
    const reduced = R();
    const textBits = [$.eyebrow, $.sub, $.counter].filter(Boolean);
    intro = gsap.timeline({ delay: reduced ? 0.1 : 0.35 });

    intro.fromTo($.bgBase, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.6 : 2.2, ease: 'sine.out' }, 0)
      .fromTo([$.leakA, $.leakB], { opacity: 0 }, { opacity: 1, duration: reduced ? 0.6 : 3, ease: 'sine.inOut', stagger: 0.4 }, 0.2);

    if (reduced) {
      intro.fromTo([...textBits, ...$.words, $.orn], { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.05 }, 0.1)
        .fromTo($.hintInner, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.6);
    } else {
      intro.fromTo($.eyebrow, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out' }, 0.25)
        .fromTo($.words, { opacity: 0, yPercent: 40, filter: 'blur(14px)' },
          { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.9, stagger: 0.16, ease: 'expo.out', clearProps: 'filter' }, 0.45)
        .fromTo($.orn, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 1.5, ease: 'power3.inOut' }, 1.05);
      // one slow pass of light across the gold accent word
      const accent = $.words[$.words.length - 1];
      if (accent) intro.fromTo(accent, { backgroundPosition: '100% 0%, 0% 0%' }, { backgroundPosition: '0% 0%, 0% 0%', duration: 2.6, ease: 'sine.inOut' }, 1.5);
      if ($.sub) intro.fromTo($.sub, { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out', clearProps: 'filter' }, 1.35);
      if ($.counter) intro.fromTo($.counter, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, 1.75);
      intro.fromTo($.hintInner, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, 2.4);
    }

    if ($.counter && $.start) {
      const days = tickCounter();
      const o = { v: 0 };
      $.counterCounting = true;
      intro.to(o, {
        v: days, duration: reduced ? 0.4 : 2.2, ease: 'power3.out',
        onUpdate: () => { $.counterNum.textContent = Math.round(o.v).toLocaleString(); },
        onComplete: () => { $.counterCounting = false; tickCounter(); },
      }, reduced ? 0.2 : 1.8);
      counterTimer = setInterval(tickCounter, 1000);
    }
  }

  /* ------------------------------------------------ scroll choreography */
  function buildScroll() {
    const reduced = R();
    const ST = { scroller: el };

    /* the line draws itself as you read */
    gsap.set($.lineFill, { scaleY: 0, transformOrigin: '50% 0%' });
    gsap.timeline({
      scrollTrigger: { ...ST, trigger: $.line, start: 'top 62%', end: 'bottom 62%', scrub: reduced ? true : 0.6, invalidateOnRefresh: true },
    })
      .to($.lineFill, { scaleY: 1, ease: 'none' }, 0)
      .fromTo($.lineHead, { y: 0 }, { y: () => $.line.offsetHeight, ease: 'none' }, 0);

    /* hero drifts up and dims as the story begins */
    if (!reduced) {
      gsap.to($.heroInner, {
        y: () => -window.innerHeight * 0.14, opacity: 0.1, ease: 'none',
        scrollTrigger: { ...ST, trigger: $.hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
      gsap.to([$.leakA], { yPercent: -35, ease: 'none', scrollTrigger: { ...ST, trigger: $.content, start: 'top top', end: 'bottom bottom', scrub: 1 } });
      gsap.to([$.leakB], { yPercent: 30, ease: 'none', scrollTrigger: { ...ST, trigger: $.content, start: 'top top', end: 'bottom bottom', scrub: 1 } });
    }
    gsap.to($.hint, { opacity: 0, ease: 'none', scrollTrigger: { ...ST, trigger: $.hero, start: 'top top', end: '+=160', scrub: true } });

    /* warm light rising at the end — something (someone) is coming */
    gsap.fromTo($.warm, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { ...ST, trigger: $.end, start: 'top bottom', end: 'bottom bottom', scrub: 0.8 } });

    /* moments */
    moments.forEach((m) => {
      const dir = m.el.classList.contains('s2-moment--l') ? 1 : -1;

      // node lights when the line reaches it
      ScrollTrigger.create({
        ...ST, trigger: m.node, start: 'top 62%',
        onEnter: () => m.el.classList.add('is-lit'),
        onLeaveBack: () => m.el.classList.remove('is-lit'),
      });

      // polaroid: drop, settle, develop
      gsap.set(m.fig, { rotation: m.rot });
      const tl = gsap.timeline({ paused: true });
      const sideBits = [m.num, ...m.label].filter(Boolean);
      if (reduced) {
        gsap.set([...sideBits, m.fig], { opacity: 0 });
        gsap.set(m.lift, { opacity: 0 });
        tl.to([...sideBits, m.fig], { opacity: 1, duration: 0.6, stagger: 0.05 }, 0)
          .fromTo(m.develop, { opacity: 0.85 }, { opacity: 0, duration: 0.9, ease: 'sine.out' }, 0.2)
          .add(() => m.el.classList.add('is-developed'), 0.9);
      } else {
        gsap.set([...sideBits, m.fig], { opacity: 0 });
        if (m.num) tl.fromTo(m.num, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'sine.out' }, 0);
        tl.fromTo(m.label, { opacity: 0, y: 12, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, stagger: 0.08, ease: 'power2.out', clearProps: 'filter' }, 0.05)
          .fromTo(m.fig, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power1.out' }, 0.1)
          .fromTo(m.fig, { y: -54, scale: 1.08 }, { y: 0, scale: 1, duration: 1.25, ease: 'power3.out' }, 0.1)
          .fromTo(m.fig, { rotation: m.rot + 9 * dir }, { rotation: m.rot, duration: 1.6, ease: 'back.out(2.1)' }, 0.1)
          .fromTo(m.lift, { opacity: 1 }, { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, 0.35)
          .fromTo(m.rest, { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'power2.inOut' }, 0.35);
        if (m.accent) tl.fromTo(m.accent, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 1.0);
        // instant film: milky over-exposure fades, the image sharpens & saturates
        tl.fromTo(m.develop, { opacity: 1 }, { opacity: 0, duration: 2.3, ease: 'sine.inOut' }, 0.55);
        if (m.img) tl.fromTo(m.img, { filter: 'blur(5px) saturate(0.25) brightness(1.12)' }, { filter: 'blur(0px) saturate(1) brightness(1)', duration: 2.5, ease: 'sine.inOut', clearProps: 'filter' }, 0.45);
        tl.call(sparkle, null, 0.7)
          .fromTo(m.sweep, { xPercent: -130, opacity: 1 }, { xPercent: 130, duration: 1.5, ease: 'power2.inOut' }, 2.2)
          .add(() => m.el.classList.add('is-developed'), 2.6);
      }
      ScrollTrigger.create({ ...ST, trigger: m.el, start: 'top 84%', once: true, onEnter: () => playReveal(tl) });

      // the note between cards: blur-to-sharp
      if (m.note) {
        const nt = gsap.timeline({ paused: true });
        gsap.set(m.note, { opacity: 0 });
        if (reduced) nt.to(m.note, { opacity: 1, duration: 0.6 });
        else {
          nt.fromTo(m.note, { opacity: 0, y: 22, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.7, ease: 'power2.out', clearProps: 'filter' }, 0)
            .fromTo(m.noteHeart, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(3)' }, 0.35);
        }
        ScrollTrigger.create({ ...ST, trigger: m.note, start: 'top 90%', once: true, onEnter: () => playReveal(nt) });
      }

      // gentle depth: cards and numerals drift at different rates
      if (!reduced) {
        gsap.fromTo(m.wrap, { y: 34 }, {
          y: -34, ease: 'none',
          scrollTrigger: { ...ST, trigger: m.el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        });
        if (m.num) {
          gsap.fromTo(m.num, { y: 0 }, {
            y: -56, ease: 'none',
            scrollTrigger: { ...ST, trigger: m.el, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
          });
        }
      }
    });

    /* the end: final line + CTA */
    const endBits = [$.endOrn, $.endScript, $.endLine].filter(Boolean);
    gsap.set(endBits, { opacity: 0 });
    gsap.set($.cta, { autoAlpha: 0 });
    const et = gsap.timeline({ paused: true });
    if (reduced) {
      et.to(endBits, { opacity: 1, duration: 0.6, stagger: 0.12 }).to($.cta, { autoAlpha: 1, duration: 0.6 }, 0.3);
    } else {
      et.fromTo($.endOrn, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'back.out(2.4)' }, 0);
      if ($.endScript) et.fromTo($.endScript, { opacity: 0, y: 18, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.8, ease: 'power2.out', clearProps: 'filter' }, 0.25);
      if ($.endLine) et.fromTo($.endLine, { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out', clearProps: 'filter' }, 0.7);
      et.fromTo($.cta, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power3.out' }, 1.15);
    }
    et.call(() => Love.audio && Love.audio.cue('chime'), null, 0.4);
    ScrollTrigger.create({ ...ST, trigger: $.end, start: 'top 72%', once: true, onEnter: () => playReveal(et) });
  }

  /* -------------------------------------------------------- media ready */
  function mediaReady() {
    const imgs = moments.map((m) => m.img).filter(Boolean);
    const loads = imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    })));
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    return Promise.race([Promise.all([...loads, fonts]), util.wait(6000)]);
  }

  /* --------------------------------------------------------- lifecycle */
  let offResize = null;

  function resetState() {
    gsap.killTweensOf([$.content, $.bg, $.cta]);
    gsap.set([$.content, $.bg, $.cta], { clearProps: 'opacity,visibility,transform' });
    moments.forEach((m) => {
      m.el.classList.remove('is-lit', 'is-developed');
      m.fig.style.visibility = '';
    });
    ctaFired = false;
    $.cta.removeAttribute('aria-disabled');
    el.classList.remove('s2-is-locked');
    lastY = el.scrollTop; lastT = performance.now(); lastJumpAt = -1e9; fastFling = false;
  }

  function teardown() {
    closeLightbox(true);
    el.removeEventListener('scroll', onScroll);
    if (offResize) { offResize(); offResize = null; }
    clearInterval(counterTimer); counterTimer = 0;
    clearTimeout(ctaTimer); ctaTimer = 0;
    if (fx) { gsap.killTweensOf(fx.state); fx.destroy(); fx = null; }
    if (ctx) { ctx.revert(); ctx = null; }
    intro = null;
    $.counterCounting = false;
  }

  Love.register({
    index: 2,
    id: 'stage2',
    transition: 'black',

    init(section) {
      el = section;
      build();
    },

    enter() {
      if (!el) return;
      if (ctx || fx) teardown(); // re-entered without a clean leave
      active = true;
      resetState();
      // listen before ScrollTrigger so jump detection runs first
      el.addEventListener('scroll', onScroll, { passive: true });
      startFX();
      ctx = gsap.context(() => { buildIntro(); buildScroll(); }, el);
      offResize = util.onResize(() => { if (fx) fx.resize(); });
      Love.audio && Love.audio.setIntensity(0.36, 3);
      mediaReady().then(() => { if (active && window.ScrollTrigger) ScrollTrigger.refresh(); });
    },

    leave() {
      if (!active) { teardown(); return Promise.resolve(); }
      active = false;
      closeLightbox(true);
      return new Promise((resolve) => {
        let finished = false;
        const finish = () => { if (finished) return; finished = true; teardown(); resolve(); };
        const d = R() ? 0.3 : 0.85;
        gsap.to($.content, { opacity: 0, y: R() ? 0 : -26, duration: d, ease: 'power2.in' });
        gsap.to($.bg, { opacity: 0, duration: d, delay: R() ? 0 : 0.1, ease: 'power1.in', onComplete: finish });
        setTimeout(finish, (d + 0.8) * 1000); // safety net
      });
    },

    seek(t) {
      if (!intro) return;
      intro.pause();
      intro.seek(Math.max(0, +t || 0));
    },
  });
})();
