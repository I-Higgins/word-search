#!/usr/bin/env node
// Validates data/categories.js. Exits non-zero on any problem.
// Usage: node scripts/validate-words.mjs
import { CATEGORIES } from '../data/categories.js';
import { ICON_NAMES } from '../js/icons.js';
import { difficulty, gridLetters } from '../js/generator.js';
import { containsBlocked, BLOCKLIST } from '../js/blocklist.js';

export function validateCategories(categories = CATEGORIES) {
  const errors = [];
  const ids = new Set();
  const minPerSize = {};
  for (const level of [1, 21, 51, 81, 101]) {
    const d = difficulty(level);
    minPerSize[d.size] = d.maxWords * 2; // enough for back-to-back levels without repeats
  }

  for (const cat of categories) {
    const where = `[${cat.id}]`;
    if (!/^[a-z][a-z0-9-]*$/.test(cat.id || '')) errors.push(`${where} bad id`);
    if (ids.has(cat.id)) errors.push(`${where} duplicate category id`);
    ids.add(cat.id);
    if (!cat.name) errors.push(`${where} missing name`);
    if (!ICON_NAMES.includes(cat.icon)) errors.push(`${where} unknown icon "${cat.icon}"`);
    if (!Array.isArray(cat.words)) { errors.push(`${where} words must be an array`); continue; }
    if (cat.words.length < 120) errors.push(`${where} has ${cat.words.length} words; needs 120+`);

    const seen = new Set();
    const seenLetters = new Map();
    for (const word of cat.words) {
      if (!/^[A-Z][A-Z -]*[A-Z]$/.test(word)) errors.push(`${where} "${word}": uppercase letters, spaces and hyphens only`);
      if (/[ -]{2}/.test(word)) errors.push(`${where} "${word}": double space/hyphen`);
      const letters = gridLetters(word);
      if (letters.length < 3 || letters.length > 14) errors.push(`${where} "${word}": ${letters.length} letters (must be 3–14)`);
      if (seen.has(word)) errors.push(`${where} duplicate word "${word}"`);
      seen.add(word);
      if (seenLetters.has(letters) && seenLetters.get(letters) !== word) {
        errors.push(`${where} "${word}" and "${seenLetters.get(letters)}" are the same in the grid`);
      }
      seenLetters.set(letters, word);
      if (letters === letters.split('').reverse().join('')) errors.push(`${where} "${word}" is a palindrome (would be found twice)`);
      if (BLOCKLIST.includes(letters)) errors.push(`${where} "${word}" is on the blocklist`);
    }

    for (const [size, need] of Object.entries(minPerSize)) {
      const fit = cat.words.filter((x) => gridLetters(x).length <= Number(size)).length;
      if (fit < need) errors.push(`${where} only ${fit} words fit a ${size}x${size} grid; needs ${need}+`);
    }
  }
  return errors;
}

// Run as a script
if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateCategories();
  if (errors.length) {
    console.error(errors.join('\n'));
    console.error(`\n${errors.length} problem(s) found.`);
    process.exit(1);
  }
  const total = CATEGORIES.reduce((n, c) => n + c.words.length, 0);
  console.log(`OK: ${CATEGORIES.length} categories, ${total} words.`);
  // Informational only: words that contain a blocklisted string inside a real word.
  const inside = CATEGORIES.flatMap((c) => c.words.filter((x) => containsBlocked(x)).map((x) => `${c.id}:${x}`));
  if (inside.length && process.argv.includes('--verbose')) console.log('Contain a blocked string (allowed inside the word):', inside.join(', '));
}
