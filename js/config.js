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

  /* Music. Your song plays the moment the visitor taps the opening screen.
     Set src: null to go back to the site's own soft, generated piano score. */
  music: {
    src: 'assets/audio/our-song.mp3',
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
        'Another month with you, my love. ❤️',
        'Ik, naa jud tay mga kaagi nga usahay down tang duha, and sometimes ma drain ta because of our situation nga layo ta sa usag usa. Daghan kaayog doubts and what ifs nga mosulod satong huna huna, and sometimes mao na ang reason nganong mag away ta, mawad an tag gana, and even lose hope sa atong relationship.',
        'But despite everything, padayon gihapon ko sa pagpalangga nimo, ik usahay dili kaayo ta stable duha, and there are days nga lisod jud ang tanan, but please know nga palangga kaayo tika. I can’t even explain how much I love you. No matter how hard things get, I will always choose you, over and over again.',
        'I’m sorry sa mga nabuhat nako nga nakapasuko nimo, sa mga times nga tungod sa akong batasan, mag-away na pud ta. I know nga naa koy mga shortcomings, and I’m not perfect, but I’m willing to learn, grow, and become better for us. I don’t want my mistakes to be the reason nga mawala ka sa akong kinabuhi.',
        'I love you so much, langga. Bisan layo ta karon, bisan naa tay mga struggles and uncertainties, I still believe in us. I hope nga tagaan ta sa Ginoo og maayong path, more patience, understanding, and strength para malampasan nato tanan nga challenges together. I pray nga someday, dili na distance ang atong kalaban, and we can finally be together without all these doubts and what ifs.',
        'Happy monthsary, my love! Thank you for staying, for loving me, and for being part of my life. No matter how difficult things get, I hope we never forget why we started and why we keep choosing each other.',
        'Palangga kaayo tika, langga, more than words can explain. Always remember nga ikaw gihapon akong eh choose always mwaaaa',
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
