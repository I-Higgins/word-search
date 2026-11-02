// Saved progress and settings, kept in localStorage on this device only.
// Every access is wrapped in try/catch: storage can be full, disabled (private
// browsing) or corrupted, and the game must never crash because of it.

const KEY = 'wordsearch:v1';

export const DEFAULT_SETTINGS = Object.freeze({
  textSize: 'normal', // 'normal' | 'large' | 'xl'
  theme: null, // null = follow the system (light/dark); 'light' | 'dark' | 'hc'
  sound: false,
  seenHelp: false,
  installDismissedAt: 0,
});

function emptyState() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    completed: {}, // { [categoryId]: number[] }
    game: null, // { categoryId, level, found: number[] } — the puzzle in progress
    route: null, // last screen, to resume where they left off
    lastCategory: null, // for the Continue button after a level is finished
  };
}

let state = emptyState();
let loadError = null;

function sanitise(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') throw new Error('Saved data is not an object');
  if (raw.settings && typeof raw.settings === 'object') {
    const t = raw.settings;
    if (['normal', 'large', 'xl'].includes(t.textSize)) s.settings.textSize = t.textSize;
    if ([null, 'light', 'dark', 'hc'].includes(t.theme)) s.settings.theme = t.theme;
    s.settings.sound = t.sound === true;
    s.settings.seenHelp = t.seenHelp === true;
    if (Number.isFinite(t.installDismissedAt)) s.settings.installDismissedAt = t.installDismissedAt;
  }
  if (raw.completed && typeof raw.completed === 'object') {
    for (const [id, list] of Object.entries(raw.completed)) {
      if (Array.isArray(list)) s.completed[id] = [...new Set(list.filter((n) => Number.isInteger(n) && n > 0))];
    }
  }
  const g = raw.game;
  if (g && typeof g.categoryId === 'string' && Number.isInteger(g.level) && Array.isArray(g.found)) {
    s.game = { categoryId: g.categoryId, level: g.level, found: g.found.filter(Number.isInteger) };
  }
  if (typeof raw.route === 'string' && raw.route.length < 200) s.route = raw.route;
  if (typeof raw.lastCategory === 'string') s.lastCategory = raw.lastCategory;
  return s;
}

/** Load from storage. Returns true on success; on failure the app shows the friendly error state. */
export function load() {
  loadError = null;
  try {
    const text = window.localStorage.getItem(KEY);
    state = text ? sanitise(JSON.parse(text)) : emptyState();
    return true;
  } catch (err) {
    loadError = err;
    state = emptyState();
    return false;
  }
}

export function hadLoadError() {
  return loadError !== null;
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    // Storage full or blocked: keep playing with in-memory progress.
    return false;
  }
}

export function getSettings() {
  return state.settings;
}

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

export function completedLevels(categoryId) {
  return state.completed[categoryId] || [];
}

export function isCompleted(categoryId, level) {
  return completedLevels(categoryId).includes(level);
}

/** Lowest level not yet completed. */
export function nextLevel(categoryId, max = Infinity) {
  const done = new Set(completedLevels(categoryId));
  let n = 1;
  while (done.has(n) && n < max) n++;
  return n;
}

export function markCompleted(categoryId, level) {
  const list = state.completed[categoryId] || (state.completed[categoryId] = []);
  if (!list.includes(level)) list.push(level);
  if (state.game && state.game.categoryId === categoryId && state.game.level === level) state.game = null;
  save();
}

export function getGame() {
  return state.game;
}

/** Save the puzzle in progress, including words found so far. Called after every found word. */
export function saveGame(categoryId, level, found) {
  state.game = { categoryId, level, found: [...found] };
  state.lastCategory = categoryId;
  save();
}

export function getLastCategory() {
  return state.lastCategory;
}

export function clearGame() {
  state.game = null;
  save();
}

export function setRoute(route) {
  state.route = route;
  save();
}

export function getRoute() {
  return state.route;
}

/** Wipe progress (keeps settings). */
export function resetProgress() {
  state.completed = {};
  state.game = null;
  state.route = null;
  state.lastCategory = null;
  save();
}

/** "Carry on from level 1" after a load error: start clean and overwrite the bad data. */
export function startFresh() {
  state = emptyState();
  loadError = null;
  save();
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (!already) await navigator.storage.persist();
    }
  } catch {
    /* not supported: fine */
  }
}

export const STORAGE_KEY = KEY;
