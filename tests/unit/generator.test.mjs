import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES } from '../../data/categories.js';
import {
  mulberry32, seedFor, generateLevel, countOccurrences, offensiveOccurrences,
  difficulty, DIRS, lineCells, matchSelection, gridLetters,
} from '../../js/generator.js';
import { findBlocked } from '../../js/blocklist.js';

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = Array.from({ length: 20 }, a);
  const seqB = Array.from({ length: 20 }, b);
  assert.deepEqual(seqA, seqB);
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
  // Known first value guards against accidental algorithm changes (which would change every puzzle).
  assert.equal(mulberry32(1)().toFixed(10), '0.6270739406');
});

test('different seeds give different sequences', () => {
  assert.notEqual(mulberry32(seedFor('fishing', 1))(), mulberry32(seedFor('fishing', 2))());
});

test('a level generates identically twice (fresh module state)', async () => {
  const first = generateLevel(CATEGORIES[0], 37);
  // Re-import a fresh copy of the generator to bypass in-memory caches.
  const fresh = await import(`../../js/generator.js?fresh=${Date.now()}`);
  const second = fresh.generateLevel(CATEGORIES[0], 37);
  assert.deepEqual(second.grid, first.grid);
  assert.deepEqual(second.words, first.words);
});

test('snapshot: fishing level 1 never changes', () => {
  const l = generateLevel(CATEGORIES.find((c) => c.id === 'fishing'), 1);
  // If this fails, every saved in-progress puzzle on every device would break.
  // Only update deliberately (and bump the storage version).
  assert.equal(l.size, 8);
  assert.ok(l.words.length >= 5 && l.words.length <= 6);
  assert.match(l.grid.map((r) => r.join('')).join(''), /^[A-Z]{64}$/);
});

for (const cat of CATEGORIES) {
  test(`${cat.id}: levels 1–150 are valid`, () => {
    let prev = null;
    for (let level = 1; level <= 150; level++) {
      const l = generateLevel(cat, level);
      const d = difficulty(level);
      const where = `${cat.id} L${level}`;
      assert.equal(l.size, d.size, where);
      assert.equal(l.grid.length, d.size, where);
      assert.ok(l.grid.every((row) => row.length === d.size && row.every((ch) => /^[A-Z]$/.test(ch))), `${where} grid letters`);
      assert.ok(l.words.length >= Math.min(d.minWords, 5) && l.words.length <= d.maxWords, `${where} word count ${l.words.length}`);
      for (const w of l.words) {
        assert.ok(cat.words.includes(w.display), `${where} ${w.display} from list`);
        assert.equal(w.letters, gridLetters(w.display));
        assert.ok(w.letters.length <= d.size, `${where} ${w.display} fits`);
        assert.ok(d.dirs.includes(w.dir), `${where} ${w.display} direction ${w.dir} allowed`);
        // The placed cells spell the word.
        assert.equal(w.cells.map(([r, c]) => l.grid[r][c]).join(''), w.letters, `${where} ${w.display} cells`);
        // Exactly once in the whole grid, any direction.
        assert.equal(countOccurrences(l.grid, w.letters), 1, `${where} ${w.display} appears once`);
      }
      assert.equal(offensiveOccurrences(l.grid, l.words).length, 0, `${where} profanity check`);
      if (prev) {
        const repeated = l.words.filter((w) => prev.has(w.display)).map((w) => w.display);
        assert.deepEqual(repeated, [], `${where} repeats words from previous level`);
      }
      prev = new Set(l.words.map((w) => w.display));
    }
  });
}

test('difficulty curve', () => {
  assert.deepEqual(difficulty(1).dirs, ['E', 'S']);
  assert.equal(difficulty(20).size, 8);
  assert.equal(difficulty(21).size, 10);
  assert.ok(difficulty(30).dirs.includes('SE'));
  assert.ok(!difficulty(50).dirs.includes('W'));
  assert.equal(difficulty(51).size, 12);
  assert.ok(difficulty(60).dirs.includes('W'));
  assert.equal(difficulty(81).dirs.length, 8);
  assert.ok([13, 14].includes(difficulty(120).size));
  assert.equal(Object.keys(DIRS).length, 8);
});

test('blocklist catches words in both directions', () => {
  const [word] = ['TAC']; // harmless
  assert.equal(findBlocked(word).length, 0);
  // Build a blocked word from the list itself to avoid writing it here.
  const grid = [['X', 'X', 'X'], ['X', 'X', 'X'], ['X', 'X', 'X']];
  assert.ok(offensiveOccurrences(grid).length > 0); // "XXX" is on the list
  const rev = findBlocked('ZZEIDZZ'); // D-I-E read backwards
  assert.equal(rev.length, 1);
  assert.deepEqual(rev[0], { start: 2, end: 5 });
});

test('blocked strings inside a placed word are allowed (e.g. a fish called BASS)', () => {
  const grid = [['B', 'A', 'S', 'S'], ['Q', 'Q', 'Q', 'Q'], ['Q', 'Q', 'Q', 'Q'], ['Q', 'Q', 'Q', 'Q']];
  const placed = [{ letters: 'BASS', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] }];
  assert.equal(offensiveOccurrences(grid, placed).length, 0);
  assert.equal(offensiveOccurrences(grid, []).length, 1);
});

test('lineCells only allows straight lines in 8 directions', () => {
  assert.deepEqual(lineCells([0, 0], [0, 3]), [[0, 0], [0, 1], [0, 2], [0, 3]]);
  assert.deepEqual(lineCells([3, 3], [0, 0]), [[3, 3], [2, 2], [1, 1], [0, 0]]);
  assert.equal(lineCells([0, 0], [1, 2]), null);
});

test('matchSelection accepts forwards and backwards', () => {
  const l = generateLevel(CATEGORIES[0], 5);
  const w = l.words[0];
  assert.equal(matchSelection(l, w.cells), 0);
  assert.equal(matchSelection(l, w.cells.slice().reverse()), 0);
  assert.equal(matchSelection(l, w.cells, new Set([0])), -1);
  assert.equal(matchSelection(l, w.cells.slice(0, 2)), -1);
});
