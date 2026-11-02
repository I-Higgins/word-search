# Contributing

Thanks for helping. The easiest and most useful contribution is a new topic or better words.

## Add a topic

1. Open `data/categories.js` and copy an existing entry:

   ```js
   {
     id: 'trains',          // short, lowercase; never change it after release (progress is saved against it)
     name: 'Trains',        // shown on screen
     icon: 'cars',          // one of the icon names in js/icons.js
     words: w(`
       LOCOMOTIVE, CARRIAGE, PLATFORM, STATION, SIGNAL BOX, ...
     `),
   },
   ```

2. Words:
   - **120 or more** per topic, family-friendly, with Australian/NZ spelling and terms where natural.
   - Uppercase letters, spaces and hyphens only. No digits or apostrophes. Write "V EIGHT", not "V8".
   - 3–14 letters (spaces and hyphens don't count). Words with spaces show as written in the list ("SIGNAL BOX") but go into the grid without the space.
   - No palindromes (KAYAK, MINIM). A palindrome would be "found" twice.
   - Include plenty of short words (8 letters or fewer). Early levels use an 8×8 grid.
3. To give the topic its own icon, add a 24×24 line icon to `CATEGORY_PATHS` in `js/icons.js`, in the same style as the others.
4. Check your changes:

   ```bash
   npm run validate
   ```

   ```bash
   npm test
   ```

   The tests generate levels 1–150 of every topic and check that each listed word appears exactly once and that no blocked word appears by accident.

5. Open a pull request.

## Things to know

- **Puzzles come from the word lists.** Changing a topic's words changes its puzzles, and someone part-way through a level will see a different grid when they return. Completed levels stay completed, and words they'd already found stay found if they're still in that puzzle. Adding a new topic doesn't affect any existing topic.
- **Keep it offline.** The app must make no network requests: no CDNs, fonts, analytics or trackers. If you add a file the app needs at runtime, add it to `PRECACHE` in `sw.js`. A test will remind you if you forget.
- **No build step.** Plain HTML, CSS and ES modules only, with no runtime dependencies.
- **Colours and sizes** live in `css/tokens.css`. Don't hard-code them elsewhere.
- **Accessibility:** touch targets at least 44×44 pt, everything usable with a screen reader and keyboard, and respect for `prefers-reduced-motion`.

## Running the tests

See the README section "Tests".
