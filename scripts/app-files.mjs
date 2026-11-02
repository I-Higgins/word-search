// The single definition of which files make up the app.
// Used by: the local server, the deploy workflow (copies these to the Pages site)
// and the precache test (every one must be in sw.js PRECACHE).
// design/, tests/, scripts/ and docs are never served or precached.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const APP_ROOT_FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
export const APP_DIRS = ['css', 'js', 'data', 'icons'];
// Source art isn't needed at runtime.
const EXCLUDE = [/^icons\/src\//];

function walk(dir) {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

/** All app files, relative to the repo root, using forward slashes. */
export function listAppFiles() {
  return [...APP_ROOT_FILES, ...APP_DIRS.flatMap(walk)]
    .filter((f) => !EXCLUDE.some((re) => re.test(f)))
    .sort();
}

export function isAppFile(rel) {
  return listAppFiles().includes(rel.split(path.sep).join('/'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(listAppFiles().join('\n'));
}
