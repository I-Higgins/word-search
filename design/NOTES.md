# Design reference

`Word_Search_Game_Design.html` is the original Claude Design export (a self-unpacking bundle; open it in a browser).
`source/` holds the readable screen templates extracted from it, and `screens/` holds a rendered PNG of every board.

This folder is **reference only**. It is not served by the local server, not deployed to Pages, and not precached.

## What the design covers

| Board | Implemented in |
| --- | --- |
| Home: iPad landscape/portrait, iPhone, Extra large text | `homeScreen()` in `js/app.js` |
| Levels: iPad landscape/portrait, iPhone (segmented vs stepper) | `levelsScreen()` |
| Settings: iPad landscape, iPhone, reset confirmation | `settingsScreen()`, `confirmReset()` |
| Small pieces: update banner (+ "Updating…"), install card, error state | `updateBanner()`, `installCard()`, `errorCard()` |
| Category icons (16) | `js/icons.js` |

## Gaps filled in the design's style

The export didn't include these, so they were built from the existing tokens and components:

- **Game screen**: top bar like Levels (Back "Levels" pill, category disc and serif title, "Hint" pill with a light-bulb icon in the same line style). The grid sits on a surface card. Found words are drawn as rounded capsules in the category tints, and the word list is a card. In landscape the list sits beside the grid; in portrait and on phone it sits below.
- **Cell states**: normal; first-tap anchor (filled primary circle); drag/selection (translucent primary capsule); found (tinted capsule, bold letter); hint (amber ring using the design's warning colours, gently pulsing); wrong (soft red capsule that fades out).
- **Level complete**: dialog in the style of the reset dialog, with a "done" check badge using the Levels "Done" colours. Buttons: "Next level" and "Back to levels".
- **How to play**: dialog using the install card's numbered steps. Opened from Settings → "Show how to play", and shown once automatically on the first puzzle.
- **Dark and High contrast palettes**: the design only shows the swatches (`#20252B`/`#F2EEE6` and `#FFFFFF`/`#000000`). The full palettes in `css/tokens.css` are derived from those.
- **Theme note**: when no colour is chosen, a small line under Colours says it's following the device.
- **Motion**: none was specified, so motion is gentle (fades, a small pop, capsule draw-in, hint pulse). Under `prefers-reduced-motion` it becomes quick fades only, and the hint ring stays still.
- **App icon**: none was provided. `icons/src/app-icon.svg` is a mini word-search grid in the design colours.
- **Continue button**: hidden until the first puzzle has been started.
