#!/usr/bin/env node
// Copies the app files (and nothing else) into _site/ for GitHub Pages,
// stamping the service worker with the build id so each deploy is a new version.
// Usage: node scripts/build-site.mjs [build-id]
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAppFiles } from './app-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const build = (process.argv[2] || 'local').slice(0, 12).replace(/[^a-zA-Z0-9]/g, '');

await rm(out, { recursive: true, force: true });
for (const f of listAppFiles()) {
  await mkdir(path.dirname(path.join(out, f)), { recursive: true });
  await cp(path.join(root, f), path.join(out, f));
}
const swPath = path.join(out, 'sw.js');
const sw = await readFile(swPath, 'utf8');
if (!sw.includes("const BUILD = 'dev';")) throw new Error('sw.js BUILD marker not found');
await writeFile(swPath, sw.replace("const BUILD = 'dev';", `const BUILD = '${build}';`));
await writeFile(path.join(out, '.nojekyll'), '');
console.log(`Built _site/ with ${listAppFiles().length} files (build ${build}).`);
