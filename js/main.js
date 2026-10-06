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
  const critical = [
    'assets/character/him-side.webp',
    'assets/character/him-front.webp',
    'assets/character/him-back.webp',
    'assets/character/her-side.svg',
    'assets/character/her-side-react.svg',
    'assets/character/her-back.svg',
    'assets/character/face-happy.webp',
    'assets/character/face-determined.webp',
    ...(C.her && C.her.sprite ? [C.her.sprite] : []),
    ...((C.stage2 && C.stage2.moments) || []).map((m) => m.photo + '.webp'),
  ];

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

    if (params.has('seek')) {
      // let the stage build its timeline first
      requestAnimationFrame(() => requestAnimationFrame(() => Love.debug.seek(parseFloat(params.get('seek')))));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
