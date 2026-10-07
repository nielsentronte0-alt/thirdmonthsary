/* ==========================================================================
   main.js — boot: preload, loader, sound toggle, first stage, debug params.

   Debug URL params (handy for testing / screenshots):
     ?stage=3        start directly on stage 3 (no loader wait for gesture)
     ?seek=12        after entering, call stage.seek(12) → paused at 12s
     ?speed=4        play every GSAP animation 4× faster
     ?reduced        force reduced-motion mode
     ?mute           start muted
   ========================================================================== */
(function () {
  'use strict';
  const { util, params } = Love;

  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out' });
  if (params.has('speed')) gsap.globalTimeline.timeScale(parseFloat(params.get('speed')) || 1);

  /* every image the experience needs, so nothing pops in mid-cinematic */
  const C = Love.config;
  const CH = 'assets/character/';
  const herCustom = !!(C.her && C.her.sprite);
  const critical = [
    // him (stage 3: standing, handoff layers, cut-ins; stage 4: from behind)
    'him-side.webp', 'him-side-empty.webp', 'him-side-legs.webp', 'him-side-hands.webp',
    'him-face-soft.webp', 'him-back-empty.webp', 'face-happy.webp', 'face-determined.webp',
    // the bouquet (stage 3 in his / her hands, stage 4 at her side)
    'her2-bouquet.webp', 'bouquet.webp',
    // her (Sazzi): stage 4 from behind…
    'her2-back-hold.webp',
    // …and the stage 3 rig: poses, face overlays, live forearms, hold arms,
    // close-up head plates, the walk cut-in busts
    ...(herCustom ? [] : [
      'her2-wait.webp', 'her2-react-mid.webp', 'her2-react.webp', 'her2-hold.webp',
      'her2-smile.webp', 'her2-blink.webp', 'her2-hold-arms.webp',
      'her2-arm-far-cap.webp', 'her2-arm-far-sleeve.webp', 'her2-arm-far-hand.webp',
      'her2-arm-near-cap.webp', 'her2-arm-near-sleeve.webp', 'her2-arm-near-hand.webp',
      'her2-cu-happy.webp', 'her2-cu-look.webp', 'her2-cu-blink.webp', 'her2-cu-laugh.webp',
      'her2-cutR-surprised.webp', 'her2-cutR-blink.webp', 'her2-cutR-happy.webp',
    ]),
  ].map((f) => CH + f).concat([
    ...(herCustom ? [C.her.sprite] : []),
    ...((C.stage2 && C.stage2.moments) || []).map((m) => m.photo + '.webp'),
  ]);

  /* ------------------------------------------------------- sound toggle */
  const soundBtn = document.getElementById('sound-toggle');
  function syncSoundBtn() {
    const muted = !!(Love.audio && Love.audio.muted);
    soundBtn.setAttribute('aria-pressed', String(muted));
    soundBtn.setAttribute('aria-label', muted ? 'Play music' : 'Mute music');
  }
  soundBtn.addEventListener('click', () => {
    if (!Love.audio) return;
    Love.audio.toggle();
    syncSoundBtn();
  });
  Love.on('audio:unlocked', () => { soundBtn.hidden = false; syncSoundBtn(); });
  Love.on('audio:muted', syncSoundBtn);

  /* ---------------------------------------------------------------- boot */
  async function boot() {
    const bar = document.getElementById('loader-bar');
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    await Promise.all([
      util.preload(critical, (p) => { bar.style.width = Math.round(p * 100) + '%'; }),
      fontsReady,
      util.wait(params.has('stage') ? 0 : 900), // let the loader breathe a moment
    ]);

    if (params.has('mute') && Love.audio) Love.audio.setMuted(true);

    const startAt = parseInt(params.get('stage'), 10);
    const first = Love.stages.find((s) => s.index === startAt) ? startAt : Love.stages[0].index;
    await Love.go(first, { instant: true });
    document.getElementById('loader').classList.add('is-done');

    // warm the song so it starts the instant the visitor taps the opening screen
    const songSrc = C.music && C.music.src;
    if (songSrc) { const a = new Audio(); a.preload = 'auto'; a.src = songSrc; }

    // the walk strips stage 3 draws (start, 24-frame cycle, stop on the left
    // heel: WALK_STEPS is odd) are ~1.7 MB: fetch them quietly during stages 1–2
    util.preload([
      'assets/character/walk/walk-start-strip.webp',
      'assets/character/walk/walk-strip-24.webp',
      'assets/character/walk/walk-stop-l-strip.webp',
    ]);

    if (params.has('seek')) {
      // let the stage build its timeline first
      requestAnimationFrame(() => requestAnimationFrame(() => Love.debug.seek(parseFloat(params.get('seek')))));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
