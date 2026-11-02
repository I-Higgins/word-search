import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCategories } from '../../scripts/validate-words.mjs';
import { CATEGORIES } from '../../data/categories.js';

test('word lists pass validation', () => {
  assert.deepEqual(validateCategories(), []);
});

test('at least 12 categories with 120+ words each', () => {
  assert.ok(CATEGORIES.length >= 12);
  for (const c of CATEGORIES) assert.ok(c.words.length >= 120, c.id);
});

test('validator rejects bad input', () => {
  const bad = [{ id: 'x', name: 'X', icon: 'nope', words: ['ok word', 'AB', 'CAT', 'CAT', 'LEVEL', 'V8'] }];
  const errors = validateCategories(bad).join('\n');
  assert.match(errors, /unknown icon/);
  assert.match(errors, /needs 120\+/);
  assert.match(errors, /uppercase/);
  assert.match(errors, /must be 3–14/);
  assert.match(errors, /duplicate word "CAT"/);
  assert.match(errors, /palindrome/);
});
