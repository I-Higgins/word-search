// Deterministic word search generator.
//
// Level N in a category is always the same puzzle on every device: every random
// choice comes from a mulberry32 PRNG seeded from (category id, level, attempt).
// Nothing is stored; puzzles are rebuilt on demand.
//
// This module is pure (no DOM) so it runs in the browser and in `node --test`.

import { findBlocked } from './blocklist.js';

// ---------------------------------------------------------------------------
// PRNG + hashing

/** mulberry32: small, fast, good-enough 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a string. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seedFor(...parts) {
  return hashString(parts.join(':'));
}

function randInt(rng, min, max) {
  // inclusive
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Directions + difficulty

/** [dRow, dCol] */
export const DIRS = {
  E: [0, 1], // left to right
  S: [1, 0], // top to bottom
  SE: [1, 1], // diagonal down-right
  NE: [-1, 1], // diagonal up-right
  W: [0, -1], // backwards
  N: [-1, 0], // bottom to top
  SW: [1, -1],
  NW: [-1, -1],
};

/**
 * Difficulty curve. Grid size depends only on the level number so the word
 * selection (which needs to know what fits) never depends on the grid.
 */
export function difficulty(level) {
  if (level <= 20) return { size: 8, minWords: 5, maxWords: 6, dirs: ['E', 'S'] };
  if (level <= 50) return { size: 10, minWords: 7, maxWords: 8, dirs: ['E', 'S', 'SE', 'NE'] };
  if (level <= 80) return { size: 12, minWords: 9, maxWords: 10, dirs: ['E', 'S', 'SE', 'NE', 'W', 'N'] };
  return { size: level <= 100 ? 13 : 14, minWords: 10, maxWords: 12, dirs: Object.keys(DIRS) };
}

// ---------------------------------------------------------------------------
// Words

/** "SPARK PLUG" -> "SPARKPLUG" (what goes in the grid). */
export function gridLetters(word) {
  return word.toUpperCase().replace(/[^A-Z]/g, '');
}

function reverse(s) {
  return s.split('').reverse().join('');
}

/** Two words clash if one (or its reverse) contains the other: both would be found twice. */
function clashes(a, b) {
  return a.includes(b) || b.includes(a) || a.includes(reverse(b)) || b.includes(reverse(a));
}

const selectionCache = new Map();

/**
 * Word lists for levels 1..level of a category, computed as a chain so that
 * consecutive levels never share a word (where the list is big enough).
 *
 * The category's words are dealt from a seeded shuffled deck. Each level takes
 * the next words that fit its grid and don't clash with the previous level or
 * each other. When the deck runs out it is reshuffled with a new seed.
 * Only word *selection* is chained; grid building is independent per level.
 */
export function wordsForLevel(category, level) {
  const key = category.id;
  let state = selectionCache.get(key);
  if (!state || state.words !== category.words) {
    state = { words: category.words, levels: [null], deck: [], cycle: 0, cursor: 0 };
    selectionCache.set(key, state);
  }
  const pool = category.words.map((w) => ({ display: w, letters: gridLetters(w) }));

  while (state.levels.length <= level) {
    const n = state.levels.length;
    const { size, minWords, maxWords } = difficulty(n);
    const rng = mulberry32(seedFor(category.id, n, 'count'));
    const count = randInt(rng, minWords, maxWords);
    const prev = new Set((state.levels[n - 1] || []).map((w) => w.display));
    const picked = [];
    const skipped = []; // fit nothing now; put back at the front of the deck for later levels
    let guard = 0;
    while (picked.length < count && guard < pool.length * 3) {
      guard++;
      if (state.cursor >= state.deck.length) {
        state.deck = shuffle(mulberry32(seedFor(category.id, 'deck', state.cycle++)), pool);
        state.cursor = 0;
      }
      const w = state.deck[state.cursor++];
      const ok =
        w.letters.length <= size &&
        w.letters.length >= 3 &&
        !prev.has(w.display) &&
        !picked.some((p) => p.display === w.display || clashes(p.letters, w.letters));
      if (ok) picked.push(w);
      else skipped.push(w);
    }
    // Words skipped only because of length/clash are returned to the deck so
    // larger later levels can still use them.
    if (skipped.length) {
      state.deck.splice(state.cursor, 0, ...skipped);
    }
    state.levels.push(picked);
  }
  return state.levels[level];
}

// ---------------------------------------------------------------------------
// Filler letters, weighted toward common English letters.

const LETTER_WEIGHTS = {
  E: 11, A: 9, R: 7, I: 8, O: 7, T: 8, N: 7, S: 7, L: 5, C: 4, U: 3, D: 4, P: 3,
  M: 3, H: 4, G: 2.5, B: 2, F: 2, Y: 2, W: 1.8, K: 1.2, V: 1, X: 0.3, Z: 0.3, J: 0.3, Q: 0.2,
};
const LETTERS = Object.keys(LETTER_WEIGHTS);
const CUMULATIVE = (() => {
  let total = 0;
  const out = LETTERS.map((l) => (total += LETTER_WEIGHTS[l]));
  return out.map((c) => c / total);
})();

function randomLetter(rng) {
  const r = rng();
  for (let i = 0; i < CUMULATIVE.length; i++) if (r < CUMULATIVE[i]) return LETTERS[i];
  return 'E';
}

// ---------------------------------------------------------------------------
// Placement

function tryPlaceAll(words, size, dirs, rng) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const placements = [];
  // Longest first places most reliably.
  const order = words
    .map((w, i) => ({ ...w, index: i }))
    .sort((a, b) => b.letters.length - a.letters.length || a.index - b.index);

  for (const w of order) {
    const L = w.letters.length;
    const options = [];
    for (const d of dirs) {
      const [dr, dc] = DIRS[d];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const er = r + dr * (L - 1);
          const ec = c + dc * (L - 1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
          let overlaps = 0;
          let ok = true;
          for (let k = 0; k < L; k++) {
            const cell = grid[r + dr * k][c + dc * k];
            if (cell === null) continue;
            if (cell !== w.letters[k]) { ok = false; break; }
            overlaps++;
          }
          // Don't allow a word to sit entirely on top of another.
          if (ok && overlaps < L) options.push({ r, c, d, overlaps });
        }
      }
    }
    if (!options.length) return null;
    // Mild preference for crossings, but keep variety.
    const crossing = options.filter((o) => o.overlaps > 0);
    const useCross = crossing.length && rng() < 0.35;
    const list = useCross ? crossing : options;
    const pick = list[Math.floor(rng() * list.length)];
    const [dr, dc] = DIRS[pick.d];
    const cells = [];
    for (let k = 0; k < L; k++) {
      const rr = pick.r + dr * k;
      const cc = pick.c + dc * k;
      grid[rr][cc] = w.letters[k];
      cells.push([rr, cc]);
    }
    placements[w.index] = { ...w, dir: pick.d, cells };
  }
  return { grid, placements };
}

/** All straight lines through the grid (rows, cols, both diagonals) as cell lists. */
function allLines(size) {
  const lines = [];
  for (let r = 0; r < size; r++) lines.push(Array.from({ length: size }, (_, c) => [r, c]));
  for (let c = 0; c < size; c++) lines.push(Array.from({ length: size }, (_, r) => [r, c]));
  for (let k = -(size - 1); k <= size - 1; k++) {
    const d1 = [];
    const d2 = [];
    for (let r = 0; r < size; r++) {
      const c1 = r + k;
      if (c1 >= 0 && c1 < size) d1.push([r, c1]);
      const c2 = size - 1 - r + k;
      if (c2 >= 0 && c2 < size) d2.push([r, c2]);
    }
    if (d1.length) lines.push(d1);
    if (d2.length) lines.push(d2);
  }
  return lines;
}

const linesCache = new Map();
function linesFor(size) {
  if (!linesCache.has(size)) linesCache.set(size, allLines(size));
  return linesCache.get(size);
}

/** Count occurrences of `word` in the grid, in all 8 directions. */
export function countOccurrences(grid, word) {
  const size = grid.length;
  let n = 0;
  const rev = reverse(word);
  for (const line of linesFor(size)) {
    const s = line.map(([r, c]) => grid[r][c]).join('');
    for (const needle of word === rev ? [word] : [word, rev]) {
      let i = s.indexOf(needle);
      while (i !== -1) { n++; i = s.indexOf(needle, i + 1); }
    }
  }
  return n;
}

/**
 * Find blocked words in any direction. An occurrence is allowed only when it
 * lies entirely inside one placed word along that word's own line (e.g. "BASS").
 * Returns [{cells}] for each offending occurrence.
 */
export function offensiveOccurrences(grid, placements = []) {
  const size = grid.length;
  const owner = new Map(); // "r,c" -> Set of placement indexes
  placements.forEach((p, i) => p.cells.forEach(([r, c]) => {
    const k = r + ',' + c;
    if (!owner.has(k)) owner.set(k, new Set());
    owner.get(k).add(i);
  }));
  const bad = [];
  for (const line of linesFor(size)) {
    const s = line.map(([r, c]) => grid[r][c]).join('');
    for (const hit of findBlocked(s)) {
      const cells = line.slice(hit.start, hit.end);
      // Allowed if one placed word covers every cell and runs along this line.
      const common = cells
        .map(([r, c]) => owner.get(r + ',' + c) || new Set())
        .reduce((acc, set) => new Set([...acc].filter((x) => set.has(x))));
      const inside = [...common].some((i) => {
        const pc = placements[i].cells;
        const keys = new Set(pc.map(([r, c]) => r + ',' + c));
        // Same line: the hit's cells are consecutive along the placement.
        return cells.every(([r, c]) => keys.has(r + ',' + c)) && cells.length <= pc.length;
      });
      if (!inside) bad.push({ cells });
    }
  }
  return bad;
}

function fillAndClean(base, placements, rng) {
  const size = base.length;
  const grid = base.map((row) => row.slice());
  const fixed = base.map((row) => row.map((c) => c !== null));
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fixed[r][c]) grid[r][c] = randomLetter(rng);

  // Re-roll filler cells inside any blocked word until clean.
  for (let pass = 0; pass < 60; pass++) {
    const bad = offensiveOccurrences(grid, placements);
    if (!bad.length) break;
    let changed = false;
    for (const { cells } of bad) {
      for (const [r, c] of cells) {
        if (!fixed[r][c]) { grid[r][c] = randomLetter(rng); changed = true; }
      }
    }
    if (!changed) return null; // made only of placed letters: need a new layout
  }
  if (offensiveOccurrences(grid, placements).length) return null;
  // Every listed word must appear exactly once (filler can accidentally make a copy).
  for (const p of placements) if (countOccurrences(grid, p.letters) !== 1) return null;
  return grid;
}

const levelCache = new Map();

/**
 * Build level `level` of `category`.
 * Returns { categoryId, level, size, dirs, grid: string[][], words: [{display, letters, dir, cells}] }.
 * `words` are in the order shown in the word list.
 */
export function generateLevel(category, level) {
  const key = category.id + ':' + level;
  if (levelCache.has(key)) return levelCache.get(key);
  const { size, dirs } = difficulty(level);
  let words = wordsForLevel(category, level).slice();

  for (let attempt = 0; attempt < 400; attempt++) {
    // Extremely unlikely, but never loop forever: drop the longest word after many failures.
    if (attempt > 0 && attempt % 100 === 0 && words.length > 3) {
      const longest = words.reduce((m, w, i) => (w.letters.length > words[m].letters.length ? i : m), 0);
      words = words.filter((_, i) => i !== longest);
    }
    const rng = mulberry32(seedFor(category.id, level, attempt));
    const placed = tryPlaceAll(words, size, dirs, rng);
    if (!placed) continue;
    const grid = fillAndClean(placed.grid, placed.placements, rng);
    if (!grid) continue;
    const listOrder = placed.placements
      .slice()
      .sort((a, b) => a.display.localeCompare(b.display));
    const result = {
      categoryId: category.id,
      level,
      size,
      dirs,
      grid,
      words: listOrder.map(({ display, letters, dir, cells }) => ({ display, letters, dir, cells })),
    };
    if (levelCache.size > 50) levelCache.clear();
    levelCache.set(key, result);
    return result;
  }
  throw new Error(`Could not build ${category.id} level ${level}`);
}

/** Cells from a to b (inclusive) if they form a straight line in one of 8 directions, else null. */
export function lineCells(a, b) {
  const dr = b[0] - a[0];
  const dc = b[1] - a[1];
  if (dr === 0 && dc === 0) return [a];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const n = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + sr * k, a[1] + sc * k]);
}

/** Index of the word matched by a selection (forwards or backwards), or -1. */
export function matchSelection(level, cells, foundSet = new Set()) {
  if (!cells || cells.length < 2) return -1;
  const key = (cs) => cs.map(([r, c]) => r + ',' + c).join('|');
  const fwd = key(cells);
  const back = key(cells.slice().reverse());
  return level.words.findIndex((w, i) => {
    if (foundSet.has(i)) return false;
    const k = key(w.cells);
    return k === fwd || k === back;
  });
}
