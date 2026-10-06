/* ==========================================================================
   particles.js — one lightweight canvas engine for every stage.

   const fx = Love.Particles.create(canvasEl, {
     emitters: [
       { type: 'petals',    count: 22 },              // tumbling rose petals
       { type: 'bokeh',     count: 14 },              // soft out-of-focus light orbs
       { type: 'sparkles',  count: 30 },              // tiny twinkling glints
       { type: 'fireflies', count: 18 },              // warm wandering dots
       { type: 'hearts',    count: 8  },              // slow rising hearts
     ],
     wind: 20,          // px/s horizontal drift (+ right, - left)
     speed: 1,          // global speed multiplier
     area: null,        // optional {x,y,w,h} fraction box (0..1) to confine spawns
   });
   fx.start(); fx.stop();
   fx.burst(x, y, { type: 'hearts' | 'petals' | 'sparkles', count: 24, spread: 1 }); // CSS px in canvas space
   fx.setWind(px); fx.setSpeed(m); fx.setDensity(0..1+)   // live tweakable (GSAP-friendly)
   fx.destroy();

   Per-emitter options (all optional):
     colors: [...css colors], size: [min,max] px, opacity: [min,max],
     speed: multiplier, blend: 'lighter' | 'source-over', depth: true (parallax sizes)
   The canvas is auto-sized to its CSS box (DPR capped at 2) and pauses while
   the tab is hidden. prefers-reduced-motion → fewer, slower particles.
   ========================================================================== */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const R = (a, b) => a + Math.random() * (b - a);

  const PALETTE = {
    petals: ['#b3123a', '#c8284f', '#d94a6b', '#e57c95', '#f1a9b9', '#8e0f2c'],
    hearts: ['#ff6b8b', '#ff8fa8', '#f4b6c6', '#e0475f', '#ffd1dc'],
    bokeh: ['#ffb3c4', '#ffd7a8', '#f08aa3', '#ffe9c9', '#d9b26f'],
    sparkles: ['#fff4dc', '#ffd9a0', '#ffe6ee', '#ffffff'],
    fireflies: ['#ffd88a', '#ffc46b', '#ffe7b3'],
  };

  /* ---------------------------------------------------- sprite pre-render */
  const spriteCache = new Map();

  function petalSprite(color) {
    const key = 'p' + color;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.translate(s / 2, s / 2);
    // rose petal: rounded top, pinched base
    g.beginPath();
    g.moveTo(0, 26);
    g.bezierCurveTo(-26, 12, -24, -20, -6, -26);
    g.quadraticCurveTo(0, -20, 6, -26);
    g.bezierCurveTo(24, -20, 26, 12, 0, 26);
    g.closePath();
    const grd = g.createRadialGradient(-6, -10, 2, 0, 0, 30);
    grd.addColorStop(0, shade(color, 0.35));
    grd.addColorStop(0.55, color);
    grd.addColorStop(1, shade(color, -0.35));
    g.fillStyle = grd;
    g.fill();
    // soft vein + rim highlight
    g.globalAlpha = 0.18;
    g.strokeStyle = '#fff';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, 22); g.quadraticCurveTo(2, 0, -2, -18); g.stroke();
    spriteCache.set(key, c);
    return c;
  }

  function heartSprite(color) {
    const key = 'h' + color;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const s = 72, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.translate(s / 2, s / 2 + 2);
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.beginPath();
    g.moveTo(0, 18);
    g.bezierCurveTo(-30, -2, -18, -30, 0, -14);
    g.bezierCurveTo(18, -30, 30, -2, 0, 18);
    g.closePath();
    const grd = g.createLinearGradient(0, -24, 0, 20);
    grd.addColorStop(0, shade(color, 0.3));
    grd.addColorStop(1, color);
    g.fillStyle = grd;
    g.fill();
    spriteCache.set(key, c);
    return c;
  }

  function glowSprite(color, hard) {
    const key = 'g' + color + (hard ? 'h' : '');
    if (spriteCache.has(key)) return spriteCache.get(key);
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    if (hard) {
      // bokeh disc: flat-ish body with a soft edge ring
      grd.addColorStop(0, hexA(color, 0.55));
      grd.addColorStop(0.7, hexA(color, 0.42));
      grd.addColorStop(0.86, hexA(color, 0.5));
      grd.addColorStop(1, hexA(color, 0));
    } else {
      grd.addColorStop(0, hexA('#ffffff', 1));
      grd.addColorStop(0.15, hexA(color, 0.9));
      grd.addColorStop(0.45, hexA(color, 0.25));
      grd.addColorStop(1, hexA(color, 0));
    }
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    spriteCache.set(key, c);
    return c;
  }

  function sparkleSprite(color) {
    const key = 's' + color;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const s = 48, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.translate(s / 2, s / 2);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    glow.addColorStop(0, hexA(color, 0.8));
    glow.addColorStop(0.3, hexA(color, 0.15));
    glow.addColorStop(1, hexA(color, 0));
    g.fillStyle = glow;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      g.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
      g.lineTo(Math.cos(a + TAU / 8) * 3, Math.sin(a + TAU / 8) * 3);
    }
    g.closePath();
    g.fill();
    spriteCache.set(key, c);
    return c;
  }

  /* --------------------------------------------------------- color helpers */
  function parseHex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexA(h, a) { const [r, g, b] = parseHex(h); return `rgba(${r},${g},${b},${a})`; }
  function shade(h, amt) {
    const [r, g, b] = parseHex(h);
    const f = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  /* ------------------------------------------------------------ particles */
  function spawn(type, W, H, opt, initial, area) {
    const cols = opt.colors || PALETTE[type] || PALETTE.bokeh;
    const color = cols[(Math.random() * cols.length) | 0];
    const depth = R(0.35, 1); // 1 = near, 0.35 = far
    const ax = area ? area.x * W : 0, ay = area ? area.y * H : 0;
    const aw = area ? area.w * W : W, ah = area ? area.h * H : H;
    const p = { type, color, depth, age: 0, life: Infinity, alpha: 1, ttl: 0 };
    const sz = opt.size;
    switch (type) {
      case 'petals':
        p.size = (sz ? R(sz[0], sz[1]) : R(9, 20)) * (0.55 + depth * 0.6);
        p.x = initial ? R(ax - 40, ax + aw + 40) : R(ax - 60, ax + aw);
        p.y = initial ? R(ay - 40, ay + ah) : ay - R(20, 80);
        p.vy = R(18, 42) * (0.5 + depth * 0.7);
        p.vx = R(-8, 8);
        p.rot = R(0, TAU); p.vr = R(-1.4, 1.4);
        p.flip = R(0, TAU); p.vflip = R(1.2, 3.2);
        p.sway = R(10, 30); p.swayF = R(0.4, 1.1); p.phase = R(0, TAU);
        p.alpha = R(opt.opacity ? opt.opacity[0] : 0.7, opt.opacity ? opt.opacity[1] : 0.95);
        p.img = petalSprite(color);
        break;
      case 'hearts':
        p.size = (sz ? R(sz[0], sz[1]) : R(10, 22)) * (0.6 + depth * 0.5);
        p.x = R(ax, ax + aw);
        p.y = initial ? R(ay, ay + ah) : ay + ah + R(10, 60);
        p.vy = -R(14, 34) * (0.5 + depth * 0.6);
        p.vx = R(-4, 4);
        p.sway = R(8, 22); p.swayF = R(0.5, 1.2); p.phase = R(0, TAU);
        p.rot = R(-0.3, 0.3);
        p.alpha = R(opt.opacity ? opt.opacity[0] : 0.35, opt.opacity ? opt.opacity[1] : 0.8);
        p.img = heartSprite(color);
        break;
      case 'bokeh':
        p.size = (sz ? R(sz[0], sz[1]) : R(18, 70)) * (0.5 + depth * 0.8);
        p.x = R(ax, ax + aw); p.y = R(ay, ay + ah);
        p.vx = R(-6, 6); p.vy = R(-8, 3);
        p.phase = R(0, TAU); p.tw = R(0.2, 0.6);
        p.alpha = R(opt.opacity ? opt.opacity[0] : 0.08, opt.opacity ? opt.opacity[1] : 0.32);
        p.img = glowSprite(color, true);
        break;
      case 'sparkles':
        p.size = (sz ? R(sz[0], sz[1]) : R(6, 16)) * (0.6 + depth * 0.5);
        p.x = R(ax, ax + aw); p.y = R(ay, ay + ah);
        p.vx = R(-3, 3); p.vy = R(-6, -1);
        p.phase = R(0, TAU); p.tw = R(0.8, 2.4);
        p.rot = R(0, TAU); p.vr = R(-0.6, 0.6);
        p.alpha = R(opt.opacity ? opt.opacity[0] : 0.5, opt.opacity ? opt.opacity[1] : 1);
        p.img = sparkleSprite(color);
        break;
      case 'fireflies':
      default:
        p.size = (sz ? R(sz[0], sz[1]) : R(8, 18)) * (0.6 + depth * 0.5);
        p.x = R(ax, ax + aw); p.y = R(ay, ay + ah);
        p.vx = R(-10, 10); p.vy = R(-10, 10);
        p.phase = R(0, TAU); p.tw = R(0.6, 1.6); p.turn = R(0, TAU);
        p.alpha = R(opt.opacity ? opt.opacity[0] : 0.5, opt.opacity ? opt.opacity[1] : 1);
        p.img = glowSprite(color, false);
        break;
    }
    p.baseAlpha = p.alpha;
    return p;
  }

  function create(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    const reduced = window.Love && Love.reducedMotion;
    const state = {
      wind: options.wind || 0,
      speed: options.speed || 1,
      density: 1,
      area: options.area || null,
    };
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, running = false;
    const emitters = (options.emitters || [{ type: 'petals', count: 20 }]).map((e) => ({
      ...e,
      count: Math.max(1, Math.round((e.count || 20) * (reduced ? 0.35 : 1))),
      list: [],
    }));
    const bursts = [];

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function fill(initial) {
      emitters.forEach((e) => {
        const target = Math.round(e.count * state.density);
        while (e.list.length < target) e.list.push(spawn(e.type, W, H, e, initial, state.area));
        if (e.list.length > target) e.list.length = target;
      });
    }

    function stepParticle(p, e, dt, t) {
      const sp = state.speed * (e.speed || 1) * (reduced ? 0.5 : 1);
      const wind = state.wind * (0.4 + p.depth * 0.8);
      switch (p.type) {
        case 'petals':
          p.x += (p.vx + wind + Math.sin(t * p.swayF + p.phase) * p.sway) * dt * sp;
          p.y += p.vy * dt * sp;
          p.rot += p.vr * dt * sp;
          p.flip += p.vflip * dt * sp;
          return p.y < H + 40 && p.x > -80 && p.x < W + 80;
        case 'hearts':
          p.x += (p.vx + wind * 0.5 + Math.sin(t * p.swayF + p.phase) * p.sway * 0.6) * dt * sp;
          p.y += p.vy * dt * sp;
          p.alpha = p.baseAlpha * Math.min(1, (H - Math.max(0, H * 0.08 - p.y)) / H);
          return p.y > -40;
        case 'bokeh':
          p.x += (p.vx + wind * 0.3) * dt * sp; p.y += p.vy * dt * sp;
          p.alpha = p.baseAlpha * (0.7 + 0.3 * Math.sin(t * p.tw + p.phase));
          if (p.x < -p.size) p.x = W + p.size; if (p.x > W + p.size) p.x = -p.size;
          if (p.y < -p.size) p.y = H + p.size; if (p.y > H + p.size) p.y = -p.size;
          return true;
        case 'sparkles':
          p.x += (p.vx + wind * 0.2) * dt * sp; p.y += p.vy * dt * sp; p.rot += p.vr * dt;
          p.alpha = p.baseAlpha * Math.max(0, Math.sin(t * p.tw + p.phase)) ** 3;
          if (p.y < -20) { p.y = H + 10; p.x = R(0, W); }
          return p.x > -30 && p.x < W + 30;
        default: // fireflies
          p.turn += R(-1.5, 1.5) * dt;
          p.vx += Math.cos(p.turn) * 12 * dt; p.vy += Math.sin(p.turn) * 12 * dt;
          p.vx *= 0.985; p.vy *= 0.985;
          p.x += (p.vx + wind * 0.15) * dt * sp; p.y += p.vy * dt * sp;
          p.alpha = p.baseAlpha * (0.35 + 0.65 * Math.max(0, Math.sin(t * p.tw + p.phase)));
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
          return true;
      }
    }

    function draw(p) {
      if (p.alpha <= 0.01) return;
      const s = p.size;
      ctx.globalAlpha = Math.min(1, p.alpha);
      if (p.type === 'petals') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(Math.cos(p.flip) * 0.85 + 0.15 * Math.sign(Math.cos(p.flip) || 1), 1);
        ctx.drawImage(p.img, -s, -s, s * 2, s * 2);
        ctx.restore();
      } else if (p.rot) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(p.img, -s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.drawImage(p.img, p.x - s, p.y - s, s * 2, s * 2);
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, W, H);
      emitters.forEach((e) => {
        ctx.globalCompositeOperation = e.blend || (e.type === 'petals' || e.type === 'hearts' ? 'source-over' : 'lighter');
        for (let i = 0; i < e.list.length; i++) {
          const p = e.list[i];
          if (!stepParticle(p, e, dt, t)) e.list[i] = spawn(e.type, W, H, e, false, state.area);
          draw(p);
        }
      });
      // bursts: ballistic, fade with age
      ctx.globalCompositeOperation = 'source-over';
      for (let i = bursts.length - 1; i >= 0; i--) {
        const p = bursts[i];
        p.age += dt;
        if (p.age >= p.life) { bursts.splice(i, 1); continue; }
        p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
        if (p.vflip) p.flip += p.vflip * dt;
        const k = p.age / p.life;
        p.alpha = p.baseAlpha * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        if (p.type === 'sparkles') ctx.globalCompositeOperation = 'lighter';
        draw(p);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }

    function start() {
      if (running) return api;
      running = true;
      if (!W) { resize(); fill(true); }
      last = performance.now();
      raf = requestAnimationFrame(frame);
      return api;
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      return api;
    }

    function burst(x, y, o = {}) {
      const type = o.type || 'hearts';
      const n = Math.round((o.count || 24) * (reduced ? 0.4 : 1));
      const spread = o.spread || 1;
      for (let i = 0; i < n; i++) {
        const p = spawn(type, W, H, o, true, null);
        const a = o.angle != null ? o.angle + R(-0.6, 0.6) * spread : R(0, TAU);
        const v = R(80, 260) * spread;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - (type === 'hearts' ? 60 : 0);
        p.g = type === 'petals' ? 70 : type === 'hearts' ? -30 : 10;
        p.age = 0; p.life = R(1.4, 2.6) * (o.life || 1);
        p.size *= o.scale || 1;
        p.alpha = p.baseAlpha = type === 'sparkles' ? 1 : R(0.75, 1);
        p.rot = type === 'hearts' ? R(-0.4, 0.4) : p.rot || R(0, TAU);
        p.vr = R(-2, 2);
        bursts.push(p);
      }
      if (!running) start();
      return api;
    }

    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { resize(); }) : null;
    ro ? ro.observe(canvas) : window.addEventListener('resize', resize);
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else if (running) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVis);

    const api = {
      start, stop, burst,
      setWind(v) { state.wind = v; return api; },
      setSpeed(v) { state.speed = v; return api; },
      setDensity(v) { state.density = Math.max(0, v); fill(false); return api; },
      setArea(a) { state.area = a; return api; },
      resize() { resize(); return api; },
      /** GSAP can tween these directly: gsap.to(fx.state, {wind: 80}) */
      state,
      get running() { return running; },
      destroy() {
        stop();
        ro ? ro.disconnect() : window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVis);
        emitters.forEach((e) => (e.list.length = 0));
        bursts.length = 0;
        ctx.clearRect(0, 0, W, H);
      },
    };
    return api;
  }

  window.Love = window.Love || {};
  window.Love.Particles = { create, PALETTE };
})();
