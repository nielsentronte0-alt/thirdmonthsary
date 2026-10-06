/* ==========================================================================
   ❤️  EDIT ME — every word, photo and setting on the site lives here.
   Plain text only. Use \n for a line break inside a string.
   ========================================================================== */
window.LOVE_CONFIG = {
  /* Which monthsary is this? (3 → "3rd") */
  monthsary: 3,

  /* What the site calls her, and how you sign off. */
  herName: 'My Love',
  hisName: 'Me',

  /* Optional: the day you became official, 'YYYY-MM-DD'. When set, the
     story stage shows a live "days together" counter. Leave null to hide. */
  startDate: null,

  /* Music. By default the site plays its own soft, generated piano score
     that swells during the walking scene. To use your song instead, drop an
     mp3 in assets/audio/ and set src: 'assets/audio/our-song.mp3'. */
  music: {
    src: null,
    volume: 0.8,
  },

  /* Her character in the walking scene. null = Sazzi, the built-in animated
     character (cut from images/sazzi.png). To use a single still image
     instead, set a transparent PNG/WebP of her full body FACING LEFT, feet at
     the bottom edge, e.g. 'assets/character/her.png'. */
  her: {
    sprite: null,
  },

  /* ---------------------------------------------------------------- Stage 1 */
  stage1: {
    eyebrow: 'For you…',
    title: 'Happy {nth} Monthsary,',
    titleScript: 'My Love',
    subtitle: 'I made you something. Put your sound on, and take your time.',
    cta: 'Open Your Surprise',
    /* The very first screen (browsers need one tap before music can play). */
    gateHint: 'Best with sound on',
    footnote: 'A little film in four chapters',
  },

  /* ---------------------------------------------------------------- Stage 2 */
  stage2: {
    eyebrow: 'Chapter two',
    title: 'Our Little Story',
    subtitle: 'A few of my favourite frames of us — so far.',
    /* Shown in order. `note` is the little message that floats between cards. */
    moments: [
      {
        photo: 'assets/photos/call-late-night',
        alt: 'The two of us on a late-night video call',
        chapter: 'Where it started',
        caption: 'The late-night calls — where "five more minutes" never meant five.',
        note: 'I didn’t know it yet, but I was already falling.',
      },
      {
        photo: 'assets/photos/her-selfie',
        alt: 'Her selfie, curls down, soft daylight',
        chapter: 'The first time it hit me',
        caption: 'This face. I still can’t believe I get to call you mine.',
        note: 'You make ordinary days feel like scenes from a movie.',
      },
      {
        photo: 'assets/photos/call-candles',
        alt: 'Her blowing out a candle over a video call',
        chapter: 'Making wishes',
        caption: 'You made a wish over that candle. I think mine already came true.',
        note: 'Every call with you is my favourite part of the day.',
      },
      {
        photo: 'assets/photos/call-genos',
        alt: 'The two of us on a video call, headphones on',
        chapter: 'Even through a screen',
        caption: 'Even with miles and a screen between us, you’re my favourite view.',
        note: 'Distance is just a number when it’s you.',
      },
      {
        photo: 'assets/photos/her-golden-hour',
        alt: 'Her selfie in golden-hour sunlight',
        chapter: 'Golden hour',
        caption: 'Golden hour has nothing on you.',
        note: 'And somehow you get more beautiful every month.',
      },
      {
        photo: 'assets/photos/robin-starfire',
        alt: 'Robin and Starfire from Teen Titans touching foreheads in the rain',
        chapter: 'Us, basically',
        caption: 'Robin & Starfire. Forehead touches in the rain. That’s the plan.',
        note: 'Okay — now close your eyes for a second…',
      },
    ],
    /* Shown at the end of the timeline, above the button ('' hides it). */
    outroScript: 'to be continued',
    outro: 'And the best part is still on its way…',
    cta: 'Wait… what’s that?',
  },

  /* ---------------------------------------------------------------- Stage 3 */
  stage3: {
    title: 'Wait… someone is coming',
    /* Short lines that appear during the walk (keep them brief). */
    beats: [
      'Across every mile…',
      'every late-night call…',
      'every month, a little closer.',
    ],
    arrival: 'These are for you.',
    arrivalSub: 'Always for you.',
  },

  /* ---------------------------------------------------------------- Stage 4 */
  stage4: {
    eyebrow: 'Under the same sky',
    title: 'I Choose You, Always.',
    lines: [
      'Another month with you, another month I’m grateful for.',
      'Thank you for being part of my life.',
      'I love you, today, tomorrow, and every month after this. ❤️',
    ],
    cta: 'One More Thing…',
    /* ✍️  REPLACE THIS LETTER WITH YOUR OWN WORDS. */
    letter: {
      greeting: 'To my love,',
      paragraphs: [
        'Three months ago I didn’t know that someone could become my favourite part of every single day. Now I can’t imagine a day without you in it.',
        'Thank you for the late-night calls, for your patience, for your laugh, and for choosing me even on the days I’m not easy to choose. You make me want to be better — not because you ask me to, but because you deserve it.',
        'I don’t know everything the next months will bring, but I know I want to spend them with you. Same cap, same bouquet, same heart — always walking toward you.',
      ],
      signoff: 'Forever yours,',
      signature: '{hisName}',
    },
    occasion: 'Our {nth} monthsary',          // small label at the top of the letter
    back: 'Back to the stars',                // button at the end of the letter
    reread: 'Read the letter again',
    ending: null,                             // closing line; null = "Happy {nth} Monthsary, My Love"
    replay: 'Watch it again',
  },
};
