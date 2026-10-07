# For You ❤️ — a 4-stage monthsary surprise

A cinematic, mobile-first love letter in four acts:

1. **For You…** — dark romantic opening, floating petals, "Open Your Surprise"
2. **Our Little Story** — a scroll-drawn timeline of polaroids that develop as they appear
3. **Wait… Someone Is Coming 🌹** — the short film: he walks across a sunset garden to her and gives her the flowers
4. **I Choose You, Always.** — twilight, the final words, and *One More Thing…* (the letter)

## Open it

Double-click `index.html`. That's it — it works offline, no install, no server
(fonts, GSAP and every image are bundled). Best on a phone, sound on.

## Make it yours (all in `js/config.js`)

| What | Where |
| --- | --- |
| Monthsary number, her name, your name | `monthsary`, `herName`, `hisName` |
| "Days together" counter | `startDate: 'YYYY-MM-DD'` |
| Photo captions & little notes | `stage2.moments` |
| The final three lines | `stage4.lines` |
| **Your letter** ✍️ | `stage4.letter` — replace the draft with your own words |

**Add a photo:** save it as `assets/photos/<name>.webp` **and** `.jpg`, then add an
entry to `stage2.moments` with `photo: 'assets/photos/<name>'` (no extension).

**The music:** `assets/audio/our-song.mp3` starts the moment the visitor taps
the opening screen. To swap it, replace that file (or point `music.src` at
another path). Set `music.src: null` to go back to the site's own soft
generated piano score that swells during the walking scene.

**Use your own art for her:** a transparent PNG/WebP of her full body facing left,
feet at the bottom edge → `her: { sprite: 'assets/character/her.png' }`.

## Testing shortcuts

Add these to the URL (e.g. `index.html?stage=3`):

- `?stage=3` — jump straight to a stage
- `?stage=3&seek=20` — freeze the film at 20 seconds
- `?speed=3` — play everything 3× faster
- `?reduced` — calmer, reduced-motion version
- `?mute` — start muted

## Put it online (optional)

It's a static site, so any static host works:

- **GitHub Pages:** push this folder to a repo → Settings → Pages → deploy from branch.
- **Vercel:** `vercel deploy` from this folder (or drag the folder into vercel.com/new).

## Files

```
index.html          page shell
css/base.css        design tokens + shared components   css/stageN.css  per-stage styles
js/config.js        ✍️ all content                       js/stageN.js    each stage
js/core.js          stage manager, transitions, helpers   js/audio.js     music + sound cues
js/particles.js     petals / hearts / bokeh engine        js/main.js      boot + loader
assets/character/   his sprites (cut from the character sheet) + her illustrations
assets/photos/      optimised photos (originals stay in images/)
```
