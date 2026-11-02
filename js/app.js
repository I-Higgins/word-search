// Word Search — app shell: routing, screens, game, PWA wiring.
import { CATEGORIES, LEVELS_PER_CATEGORY, categoryById } from '../data/categories.js';
import { generateLevel, matchSelection } from './generator.js';
import { GridInput } from './input.js';
import { categoryIcon, uiIcon, ERROR_ART } from './icons.js';
import * as store from './storage.js';
import { playFound, playComplete, unlockAudio } from './sound.js';

export const VERSION = '1.0';
const SOURCE_URL = 'https://github.com/I-Higgins/word-search';
const LEVELS_PER_PAGE = 20;
const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const app = document.getElementById('app');
const live = document.getElementById('live');

const ui = {
  updateWorker: null, // waiting service worker
  updating: false,
  levelsPage: {}, // categoryId -> page index
  current: null, // active game controller
};

// ---------------------------------------------------------------------------
// Helpers

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tintOf = (cat) => `var(--tint-${(CATEGORIES.indexOf(cat) % 8) + 1})`;
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function announce(text) {
  live.textContent = '';
  // New text on the next frame so screen readers notice a repeat.
  requestAnimationFrame(() => { live.textContent = text; });
}

let inAppNavs = 0;
function navigate(hash, { replace = false } = {}) {
  if (!replace) inAppNavs++;
  if (location.hash === hash) render();
  else if (replace) { history.replaceState(null, '', hash); render(); }
  else location.hash = hash;
}

function focusTitle() {
  const h = app.querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

// ---------------------------------------------------------------------------
// Settings → document

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applySettings() {
  const s = store.getSettings();
  const theme = s.theme || (darkQuery.matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.text = s.textSize;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim() || '#F6F1E7');
}
darkQuery.addEventListener?.('change', () => { if (!store.getSettings().theme) applySettings(); });

// ---------------------------------------------------------------------------
// Shared pieces

function updateBanner() {
  if (ui.updating) {
    return `<div class="banner banner--busy" role="status">${uiIcon('refresh', 28)}<span class="banner-text">Updating…</span></div>`;
  }
  if (!ui.updateWorker) return '';
  return `<div class="banner" role="status">${uiIcon('refresh', 28)}
    <span class="banner-text">A new version is ready.</span>
    <button class="banner-btn" data-action="refresh">Refresh</button></div>`;
}

function installCard() {
  const s = store.getSettings();
  if (isStandalone() || Date.now() - (s.installDismissedAt || 0) < INSTALL_SNOOZE_MS) return '';
  return `<section class="piece install" aria-labelledby="install-title">
    <h2 id="install-title">Keep Word Search on your Home Screen</h2>
    <ol class="steps">
      <li><span class="step-num" aria-hidden="true">1</span><span class="step-text">Tap Share
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Share button"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M8 10H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/></svg></span></li>
      <li><span class="step-num" aria-hidden="true">2</span><span class="step-text">Choose <b>Add to Home Screen</b> ${uiIcon('addSquare', 28)}</span></li>
      <li><span class="step-num" aria-hidden="true">3</span><span class="step-text">Open it once with Wi-Fi on. After that it works offline.</span></li>
    </ol>
    <button class="btn" data-action="install-later">Not now</button>
  </section>`;
}

function errorCard() {
  return `<section class="piece error-card" role="alert" aria-labelledby="err-title">
    ${ERROR_ART}
    <h2 id="err-title">We couldn't find your saved levels</h2>
    <p>The puzzles are all still here. You can try again, or carry on from level 1.</p>
    <div class="error-actions">
      <button class="btn btn--primary" data-action="retry-load">Try again</button>
      <button class="btn" data-action="start-fresh">Carry on from level 1</button>
    </div>
  </section>`;
}

function backButton(label, action, extra = '') {
  return `<button class="pill pill--back" data-action="${action}" ${extra}>${uiIcon('chevronLeft', 28)}${esc(label)}</button>`;
}

// ---------------------------------------------------------------------------
// Dialogs

let dialogReturnFocus = null;

function openDialog(html, { onKey } = {}) {
  closeDialog();
  dialogReturnFocus = document.activeElement;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.id = 'dialog';
  scrim.innerHTML = html;
  document.body.appendChild(scrim);
  app.setAttribute('aria-hidden', 'true');
  app.inert = true;
  const focusables = () => [...scrim.querySelectorAll('button, a[href]')];
  scrim.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    } else if (e.key === 'Escape' && onKey) onKey('Escape');
  });
  const first = scrim.querySelector('[data-autofocus]') || focusables()[0];
  first?.focus();
  return scrim;
}

function closeDialog() {
  const d = document.getElementById('dialog');
  if (!d) return;
  d.remove();
  app.removeAttribute('aria-hidden');
  app.inert = false;
  if (dialogReturnFocus && document.contains(dialogReturnFocus)) dialogReturnFocus.focus({ preventScroll: true });
  dialogReturnFocus = null;
}

function showHelp() {
  const scrim = openDialog(`<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="help-t">
    <h2 id="help-t">How to play</h2>
    <ol class="steps">
      <li><span class="step-num" aria-hidden="true">1</span><span class="step-text">Tap the first letter of a word.</span></li>
      <li><span class="step-num" aria-hidden="true">2</span><span class="step-text">Then tap the last letter.</span></li>
      <li><span class="step-num" aria-hidden="true">3</span><span class="step-text">Or slide your finger along the word.</span></li>
    </ol>
    <p>Words go across and down. Later levels add diagonal and backwards words. Stuck? Tap <b>Hint</b> as often as you like.</p>
    <div class="dialog-actions"><button class="btn btn--primary btn--tall" data-autofocus data-close>Got it</button></div>
  </div>`, { onKey: () => close() });
  const close = () => { store.setSetting('seenHelp', true); closeDialog(); };
  scrim.querySelector('[data-close]').addEventListener('click', close);
}

function confirmReset() {
  const scrim = openDialog(`<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="ws-reset-t" aria-describedby="ws-reset-d">
    <h2 id="ws-reset-t">Start again from level 1?</h2>
    <p id="ws-reset-d">This clears the levels you've finished in every topic. It can't be undone.</p>
    <div class="dialog-actions">
      <button class="btn btn--primary btn--tall" data-autofocus data-keep>Keep my progress</button>
      <button class="btn btn--danger btn--tall" data-reset>Yes, reset everything</button>
    </div>
  </div>`, { onKey: () => closeDialog() });
  scrim.querySelector('[data-keep]').addEventListener('click', closeDialog);
  scrim.querySelector('[data-reset]').addEventListener('click', () => {
    store.resetProgress();
    ui.levelsPage = {};
    closeDialog();
    announce('Progress reset. Every topic starts from level 1.');
  });
}

// ---------------------------------------------------------------------------
// Screens

function homeScreen() {
  const loadFailed = store.hadLoadError();
  let cont = '';
  if (!loadFailed) {
    const g = store.getGame();
    const lastId = g ? g.categoryId : store.getLastCategory();
    const cat = lastId && categoryById(lastId);
    if (cat) {
      const level = g ? g.level : store.nextLevel(cat.id, LEVELS_PER_CATEGORY);
      cont = `<button class="hero" data-action="play" data-cat="${cat.id}" data-level="${level}">
        <span class="hero-disc" aria-hidden="true">${categoryIcon(cat.icon, parseInt(getVar('--cont-icon'), 10) || 44)}</span>
        <span class="hero-text"><span class="hero-title">Continue</span><span class="hero-sub">${esc(cat.name)} · Level ${level}</span></span>
        ${uiIcon('chevronRight', 28)}
      </button>`;
    }
  }

  const iconSize = parseInt(getVar('--disc-icon'), 10) || 42;
  const tiles = CATEGORIES.map((cat) => {
    const done = store.completedLevels(cat.id).length;
    const next = store.nextLevel(cat.id, LEVELS_PER_CATEGORY);
    const started = done > 0 || (store.getGame() && store.getGame().categoryId === cat.id);
    const progress = started ? `Level ${next} of ${LEVELS_PER_CATEGORY}` : 'Not started';
    const pct = Math.round((done / LEVELS_PER_CATEGORY) * 100);
    return `<li><button class="topic" data-action="topic" data-cat="${cat.id}" aria-label="${esc(cat.name)}, ${progress}">
      <span class="disc" style="background:${tintOf(cat)}" aria-hidden="true">${categoryIcon(cat.icon, iconSize)}</span>
      <span class="topic-name">${esc(cat.name)}</span>
      <span class="topic-progress">${progress}</span>
      <span class="bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
    </button></li>`;
  }).join('');

  return `<main class="screen" data-screen="home">
    <header class="topbar">
      <h1 class="home-title">Word Search</h1>
      <button class="pill" data-action="settings">${uiIcon('settings', 28)}Settings</button>
    </header>
    ${updateBanner()}
    ${loadFailed ? errorCard() : `
      ${cont}
      ${installCard()}
      <h2 class="section-title">Choose a topic</h2>
      <ul class="topics">${tiles}</ul>`}
    <div class="screen-end"></div>
  </main>`;
}

function getVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function levelsScreen(cat) {
  const done = new Set(store.completedLevels(cat.id));
  const next = store.nextLevel(cat.id, LEVELS_PER_CATEGORY);
  const pages = Math.ceil(LEVELS_PER_CATEGORY / LEVELS_PER_PAGE);
  if (ui.levelsPage[cat.id] === undefined) ui.levelsPage[cat.id] = Math.floor((next - 1) / LEVELS_PER_PAGE);
  const page = ui.levelsPage[cat.id];
  const from = page * LEVELS_PER_PAGE + 1;
  const to = Math.min(LEVELS_PER_CATEGORY, from + LEVELS_PER_PAGE - 1);

  const segs = Array.from({ length: pages }, (_, i) => {
    const a = i * LEVELS_PER_PAGE + 1;
    const b = Math.min(LEVELS_PER_CATEGORY, a + LEVELS_PER_PAGE - 1);
    const on = i === page;
    return `<button class="seg" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-action="page" data-page="${i}" aria-label="Levels ${a} to ${b}">${a}–${b}</button>`;
  }).join('');

  const tiles = [];
  for (let n = from; n <= to; n++) {
    if (done.has(n)) {
      tiles.push(`<li><button class="level level--done" data-action="play" data-cat="${cat.id}" data-level="${n}" aria-label="Level ${n}, done">
        <span class="level-num">${n}</span><span class="level-sub">${uiIcon('check', 17)}Done</span></button></li>`);
    } else if (n === next) {
      tiles.push(`<li><button class="level level--current" data-action="play" data-cat="${cat.id}" data-level="${n}" aria-label="Level ${n}, play next">
        <span class="level-num">${n}</span><span class="level-sub">Play</span></button></li>`);
    } else {
      tiles.push(`<li><button class="level level--todo" data-action="play" data-cat="${cat.id}" data-level="${n}" aria-label="Level ${n}, not played yet">
        <span class="level-num">${n}</span></button></li>`);
    }
  }

  return `<main class="screen screen--fit" data-screen="levels">
    <header class="topbar topbar--3">
      ${backButton('Topics', 'home')}
      <div class="screen-title">
        <span class="title-disc" style="background:${tintOf(cat)}" aria-hidden="true">${categoryIcon(cat.icon, parseInt(getVar('--title-disc-icon'), 10) || 34)}</span>
        <h1>${esc(cat.name)}</h1>
      </div>
      <div class="topbar-meta"><span class="meta-long">${done.size} of ${LEVELS_PER_CATEGORY} done</span><span class="meta-short" aria-hidden="true">${done.size} done</span></div>
    </header>
    ${updateBanner()}
    <button class="play-btn" data-action="play" data-cat="${cat.id}" data-level="${next}">${uiIcon('play', 28)}Play level ${next}</button>
    <div class="segmented" role="radiogroup" aria-label="Choose a group of levels">${segs}</div>
    <div class="stepper">
      <button class="step-btn" data-action="page" data-page="${page - 1}" aria-label="Earlier levels" ${page === 0 ? 'disabled' : ''}>${uiIcon('chevronLeft', 24)}</button>
      <div class="stepper-label" aria-live="polite">Levels ${from}–${to}</div>
      <button class="step-btn" data-action="page" data-page="${page + 1}" aria-label="Later levels" ${page >= pages - 1 ? 'disabled' : ''}>${uiIcon('chevronRight', 24)}</button>
    </div>
    <ul class="level-grid" aria-label="Levels ${from} to ${to}">${tiles.join('')}</ul>
  </main>`;
}

function settingsScreen() {
  const s = store.getSettings();
  const phone = window.matchMedia('(max-width: 599px)').matches;
  const effectiveTheme = s.theme || (darkQuery.matches ? 'dark' : 'light');
  const check = `<span class="option-check" aria-hidden="true">${uiIcon('checkBold', 15)}</span>`;
  const sizeOpt = (value, label, sample) => `<button class="option" role="radio" aria-checked="${s.textSize === value}" tabindex="${s.textSize === value ? 0 : -1}" data-action="text" data-value="${value}">
      <span class="option-sample" aria-hidden="true" style="font-size:${sample}px">Aa</span>
      <span class="option-label">${label}</span>${check}</button>`;
  const themeOpt = (value, label) => `<button class="option" role="radio" aria-checked="${effectiveTheme === value}" tabindex="${effectiveTheme === value ? 0 : -1}" data-action="theme" data-value="${value}">
      <span class="swatch swatch--${value}" aria-hidden="true">A</span>
      <span class="option-label">${label}</span>${check}</button>`;

  return `<main class="screen" data-screen="settings">
    <header class="topbar topbar--3">
      ${backButton('Back', 'back')}
      <h1 class="screen-title serif" style="font-size:var(--fs-screen-title);font-weight:700">Settings</h1>
      <div></div>
    </header>
    <div class="settings-cols">
      <div class="settings-col">
        <section class="card">
          <h2 id="ts-h">Text size</h2>
          <div class="options" role="radiogroup" aria-labelledby="ts-h">
            ${sizeOpt('normal', 'Normal', phone ? 20 : 24)}
            ${sizeOpt('large', 'Large', phone ? 25 : 30)}
            ${sizeOpt('xl', phone ? 'X-large' : 'Extra large', phone ? 30 : 36)}
          </div>
        </section>
        <section class="card">
          <h2 id="th-h">Colours</h2>
          <div class="options" role="radiogroup" aria-labelledby="th-h">
            ${themeOpt('light', 'Light')}
            ${themeOpt('dark', 'Dark')}
            ${themeOpt('hc', 'High contrast')}
          </div>
          ${s.theme ? '' : `<p class="theme-note">Matching your device's light or dark setting.</p>`}
        </section>
        <section class="card card--row">
          <div style="display:flex;flex-direction:column;gap:4px">
            <h2 id="snd-h">Sounds</h2>
            <span class="muted" style="font-size:var(--fs-settings-body);font-weight:500">Soft sounds when you find a word</span>
          </div>
          <button class="switch-wrap" role="switch" aria-checked="${s.sound}" aria-labelledby="snd-h" data-action="sound">
            <span aria-hidden="true">${s.sound ? 'On' : 'Off'}</span>
            <span class="switch" aria-hidden="true"><span class="switch-knob"></span></span>
          </button>
        </section>
      </div>
      <div class="settings-col">
        <section class="card" style="gap:12px">
          <h2>Help</h2>
          <button class="btn" data-action="help">${uiIcon('help', 26)}Show how to play</button>
        </section>
        <section class="card" style="gap:12px">
          <h2>Your progress</h2>
          <p class="muted">Start every topic again from level 1.</p>
          <button class="btn btn--danger" data-action="reset">Reset progress…</button>
        </section>
        <section class="card" style="gap:10px">
          <h2>About</h2>
          <p>Word Search is free, with no ads. It works without the internet once installed.</p>
          <p>Your progress stays on this device. Nothing is sent anywhere.</p>
          <p>Open source: <a href="${SOURCE_URL}" target="_blank" rel="noopener">see the code</a> · Version ${VERSION}</p>
        </section>
      </div>
    </div>
    <div class="screen-end"></div>
  </main>`;
}

// ---------------------------------------------------------------------------
// Game

function gameScreen(cat, levelNum) {
  const level = generateLevel(cat, levelNum);
  const n = level.size;
  const rows = level.grid.map((row, r) => `<div role="row" style="display:contents">${row.map((ch, c) =>
    `<div class="cell" role="gridcell" data-r="${r}" data-c="${c}" tabindex="${r === 0 && c === 0 ? 0 : -1}" aria-label="${ch}, row ${r + 1}, column ${c + 1}">${ch}</div>`).join('')}</div>`).join('');
  const words = level.words.map((w, i) => `<li class="word" data-word="${i}">
      <span class="word-check" aria-hidden="true">${uiIcon('check', 20)}</span>
      <span class="word-text">${esc(w.display)}</span>
      <span class="visually-hidden word-state">, not found yet</span></li>`).join('');

  return `<main class="screen screen--fit" data-screen="game">
    <header class="topbar topbar--3">
      ${backButton('Levels', 'levels', `data-cat="${cat.id}"`)}
      <div class="screen-title game-title">
        <span class="title-disc" style="background:${tintOf(cat)}" aria-hidden="true">${categoryIcon(cat.icon, parseInt(getVar('--title-disc-icon'), 10) || 34)}</span>
        <h1><span class="visually-hidden">${esc(cat.name)}, </span>Level ${levelNum}</h1>
      </div>
      <button class="pill" data-action="hint" aria-label="Hint: show the first letter of a word">${uiIcon('hint', 28)}Hint</button>
    </header>
    <div class="game-body">
      <div class="board-area">
        <div class="board" style="--n:${n}">
          <div class="board-inner">
            <svg class="marks" viewBox="0 0 ${n} ${n}" preserveAspectRatio="none" aria-hidden="true"></svg>
            <div class="cells" role="grid" aria-label="Letter grid, ${n} by ${n}. Tap the first and last letter of a word." aria-describedby="grid-help">${rows}</div>
          </div>
        </div>
        <p id="grid-help" class="visually-hidden">Use arrow keys to move. Press Enter or Space on the first letter of a word, then on the last letter.</p>
      </div>
      <section class="card words" aria-labelledby="words-h">
        <div class="words-head"><h2 id="words-h">Find these words</h2><span class="words-count" data-count></span></div>
        <ul class="word-list">${words}</ul>
      </section>
    </div>
  </main>`;
}

class Game {
  constructor(root, cat, levelNum) {
    this.root = root;
    this.cat = cat;
    this.levelNum = levelNum;
    this.level = generateLevel(cat, levelNum);
    const saved = store.getGame();
    this.found = new Set(
      saved && saved.categoryId === cat.id && saved.level === levelNum
        ? saved.found.filter((i) => i >= 0 && i < this.level.words.length)
        : [],
    );
    this.justFound = -1;
    this.hint = -1;
    this.anchor = null;
    this.preview = null;
    this.wrong = null;
    this.focus = [0, 0];
    this.svg = root.querySelector('svg.marks');
    this.cellsEl = root.querySelector('.cells');
    this.cellEls = [...root.querySelectorAll('.cell')];
    this.input = new GridInput(this.cellsEl, this.level.size, {
      onAnchor: (cell) => { this.anchor = cell; this.wrong = null; this.paint(); if (cell) unlockAudio(); },
      onPreview: (cells) => { this.preview = cells; this.wrong = null; this.paint(); },
      onSelect: (cells) => this.select(cells),
    });
    this.cellsEl.addEventListener('keydown', (e) => this.onKey(e));
    this.cellsEl.addEventListener('click', (e) => {
      // Clicks with detail 0 come from keyboards / screen readers (VoiceOver double-tap).
      if (e.detail !== 0) return;
      const el = e.target.closest('.cell');
      if (el) this.input.tap([+el.dataset.r, +el.dataset.c]);
    });
    store.saveGame(cat.id, levelNum, this.found);
    this.paint();
    if (this.found.size === this.level.words.length) this.complete(false);
  }

  destroy() { this.input.destroy(); }

  cellEl(r, c) { return this.cellEls[r * this.level.size + c]; }

  select(cells) {
    const idx = matchSelection(this.level, cells, this.found);
    if (idx >= 0) {
      this.found.add(idx);
      this.justFound = idx;
      if (this.hint === idx) this.hint = -1;
      store.saveGame(this.cat.id, this.levelNum, this.found);
      if (store.getSettings().sound) playFound();
      const left = this.level.words.length - this.found.size;
      announce(`Found ${this.level.words[idx].display}. ${left ? `${left} to go.` : 'All words found!'}`);
      this.wrong = null;
      this.paint();
      if (left === 0) this.complete(true);
    } else {
      this.wrong = cells;
      this.paint();
      announce('Not one of the words. Try again.');
      clearTimeout(this.wrongTimer);
      this.wrongTimer = setTimeout(() => { this.wrong = null; this.paint(); }, 800);
    }
  }

  showHint() {
    const left = this.level.words.map((_, i) => i).filter((i) => !this.found.has(i));
    if (!left.length) return;
    // Pick a different word than the current hint where possible.
    const choices = left.length > 1 ? left.filter((i) => i !== this.hint) : left;
    this.hint = choices[Math.floor(Math.random() * choices.length)];
    const [r, c] = this.level.words[this.hint].cells[0];
    announce(`Hint: a word starts at row ${r + 1}, column ${c + 1}, letter ${this.level.grid[r][c]}.`);
    this.paint();
  }

  complete(animate) {
    store.markCompleted(this.cat.id, this.levelNum);
    if (animate && store.getSettings().sound) playComplete();
    const next = this.levelNum < LEVELS_PER_CATEGORY ? this.levelNum + 1 : null;
    setTimeout(() => {
      if (ui.current !== this) return;
      const scrim = openDialog(`<div class="dialog dialog--center" role="dialog" aria-modal="true" aria-labelledby="done-t" aria-describedby="done-d">
        <div class="done-badge" aria-hidden="true">${uiIcon('checkBold', 52)}</div>
        <h2 id="done-t">Well done!</h2>
        <p id="done-d">You found all ${this.level.words.length} words in ${esc(this.cat.name)} level ${this.levelNum}.</p>
        <div class="dialog-actions" style="width:100%">
          ${next ? `<button class="btn btn--primary btn--tall" data-autofocus data-next>Next level</button>` : `<button class="btn btn--primary btn--tall" data-autofocus data-topics>Choose another topic</button>`}
          <button class="btn btn--tall" data-levels>Back to levels</button>
        </div>
      </div>`, { onKey: () => { closeDialog(); navigate(`#/topic/${this.cat.id}`); } });
      scrim.querySelector('[data-next]')?.addEventListener('click', () => { closeDialog(); navigate(`#/play/${this.cat.id}/${next}`); });
      scrim.querySelector('[data-topics]')?.addEventListener('click', () => { closeDialog(); navigate('#/'); });
      scrim.querySelector('[data-levels]').addEventListener('click', () => { closeDialog(); navigate(`#/topic/${this.cat.id}`); });
    }, animate ? 700 : 0);
  }

  onKey(e) {
    const n = this.level.size;
    let [r, c] = this.focus;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      r = Math.max(0, Math.min(n - 1, r + moves[e.key][0]));
      c = Math.max(0, Math.min(n - 1, c + moves[e.key][1]));
      this.moveFocus(r, c);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      this.moveFocus(r, e.key === 'Home' ? 0 : n - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.input.tap([r, c]);
    } else if (e.key === 'Escape' && this.anchor) {
      this.input.setAnchor(null);
    }
  }

  moveFocus(r, c) {
    const old = this.cellEl(...this.focus);
    old.tabIndex = -1;
    this.focus = [r, c];
    const el = this.cellEl(r, c);
    el.tabIndex = 0;
    el.focus();
  }

  /** Redraw marks, cell states and the word list from current state. */
  paint() {
    const { level } = this;
    const n = level.size;
    const W = 0.78; // capsule width in cells
    const line = (cells, cls, width, style = '', extra = '') => {
      const [r1, c1] = cells[0];
      const [r2, c2] = cells[cells.length - 1];
      const len = Math.hypot(r2 - r1, c2 - c1);
      return `<line class="mark ${cls}" x1="${c1 + 0.5}" y1="${r1 + 0.5}" x2="${c2 + 0.5}" y2="${r2 + 0.5}" stroke-width="${width}" style="${style}${extra ? `;--len:${len + 1};stroke-dasharray:${len + 1}` : ''}"/>`;
    };
    let marks = '';
    level.words.forEach((w, i) => {
      if (!this.found.has(i)) return;
      const isNew = i === this.justFound;
      marks += line(w.cells, 'mark--found-outline' + (isNew ? ' mark--found-new' : ''), W + 0.06, '', isNew);
      marks += line(w.cells, 'mark--found' + (isNew ? ' mark--found-new' : ''), W - 0.02, `stroke:var(--c-found-fill, var(--tint-${(i % 7) + 1}))`, isNew);
    });
    if (this.wrong) marks += line(this.wrong, 'mark--wrong', W);
    if (this.preview && this.preview.length) {
      marks += line(this.preview, 'mark--select', W);
      marks += line(this.preview, 'mark--select-line', 0.05, 'opacity:.6');
    }
    this.svg.innerHTML = marks;
    this.justFound = -1;

    const key = (r, c) => r * n + c;
    const foundCells = new Set();
    level.words.forEach((w, i) => { if (this.found.has(i)) w.cells.forEach(([r, c]) => foundCells.add(key(r, c))); });
    const sel = new Set((this.preview || []).map(([r, c]) => key(r, c)));
    const hintCell = this.hint >= 0 ? key(...level.words[this.hint].cells[0]) : -1;
    const anchorCell = this.anchor ? key(...this.anchor) : -1;
    this.cellEls.forEach((el, k) => {
      el.classList.toggle('is-found', foundCells.has(k));
      el.classList.toggle('is-selected', sel.has(k));
      el.classList.toggle('is-hint', k === hintCell);
      el.classList.toggle('is-anchor', k === anchorCell);
      el.setAttribute('aria-selected', String(k === anchorCell || sel.has(k)));
    });

    this.root.querySelectorAll('.word').forEach((li) => {
      const i = +li.dataset.word;
      const f = this.found.has(i);
      li.classList.toggle('is-found', f);
      li.querySelector('.word-state').textContent = f ? ', found' : ', not found yet';
    });
    this.root.querySelector('[data-count]').textContent = `${this.found.size} of ${level.words.length} found`;
  }
}

// ---------------------------------------------------------------------------
// Router

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'topic' && categoryById(parts[1])) return { name: 'levels', cat: categoryById(parts[1]) };
  if (parts[0] === 'play' && categoryById(parts[1])) {
    const level = parseInt(parts[2], 10);
    if (level >= 1 && level <= LEVELS_PER_CATEGORY) return { name: 'game', cat: categoryById(parts[1]), level };
  }
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

let lastScreen = null;

function render() {
  closeDialog();
  if (ui.current) { ui.current.destroy(); ui.current = null; }
  const route = parseRoute();
  let html;
  if (route.name === 'levels') html = levelsScreen(route.cat);
  else if (route.name === 'game') html = gameScreen(route.cat, route.level);
  else if (route.name === 'settings') html = settingsScreen();
  else html = homeScreen();
  const scroller = app.querySelector('.screen');
  const keepScroll = lastScreen === route.name && scroller ? scroller.scrollTop : 0;
  app.innerHTML = html;
  const screen = app.querySelector('.screen');
  if (keepScroll) screen.scrollTop = keepScroll;
  if (route.name === 'game') {
    ui.current = new Game(screen, route.cat, route.level);
    if (!store.getSettings().seenHelp) showHelp();
  }
  if (!store.hadLoadError()) store.setRoute(location.hash || '#/');
  const titleChanged = lastScreen !== route.name;
  lastScreen = route.name;
  document.title = route.name === 'game' ? `${route.cat.name} · Level ${route.level} — Word Search`
    : route.name === 'levels' ? `${route.cat.name} — Word Search`
    : route.name === 'settings' ? 'Settings — Word Search' : 'Word Search';
  if (titleChanged && !(route.name === 'game' && !store.getSettings().seenHelp)) focusTitle();
}

/** Re-render in place (same screen), keeping scroll and focus where possible. */
function refresh() {
  const active = document.activeElement;
  const sel = active && active.dataset && active.dataset.action
    ? `[data-action="${active.dataset.action}"]${active.dataset.value ? `[data-value="${active.dataset.value}"]` : ''}${active.dataset.page ? `[data-page="${active.dataset.page}"]` : ''}`
    : null;
  render();
  if (sel) app.querySelector(sel)?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Events (delegated)

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  switch (a) {
    case 'settings': navigate('#/settings'); break;
    case 'home': navigate('#/'); break;
    case 'back': if (inAppNavs > 0) history.back(); else navigate('#/'); break;
    case 'topic': navigate(`#/topic/${t.dataset.cat}`); break;
    case 'levels': navigate(`#/topic/${t.dataset.cat}`); break;
    case 'play': unlockAudio(); navigate(`#/play/${t.dataset.cat}/${t.dataset.level}`); break;
    case 'page': {
      const route = parseRoute();
      const p = parseInt(t.dataset.page, 10);
      if (route.cat && p >= 0 && p < Math.ceil(LEVELS_PER_CATEGORY / LEVELS_PER_PAGE)) { ui.levelsPage[route.cat.id] = p; refresh(); }
      break;
    }
    case 'hint': ui.current?.showHint(); break;
    case 'text': store.setSetting('textSize', t.dataset.value); applySettings(); refresh(); break;
    case 'theme': store.setSetting('theme', t.dataset.value); applySettings(); refresh(); break;
    case 'sound': {
      const on = !store.getSettings().sound;
      store.setSetting('sound', on);
      if (on) { unlockAudio(); playFound(); }
      refresh();
      break;
    }
    case 'help': showHelp(); break;
    case 'reset': confirmReset(); break;
    case 'install-later': store.setSetting('installDismissedAt', Date.now()); refresh(); break;
    case 'retry-load': store.load(); applySettings(); refresh(); break;
    case 'start-fresh': store.startFresh(); applySettings(); refresh(); break;
    case 'refresh': applyUpdate(); break;
    default: break;
  }
});

// Arrow keys inside radiogroups (segmented control, settings options).
app.addEventListener('keydown', (e) => {
  const radio = e.target.closest('[role="radio"]');
  if (!radio || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  const group = [...radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')];
  const i = group.indexOf(radio);
  const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
  const next = group[(i + d + group.length) % group.length];
  e.preventDefault();
  next.click();
});

window.addEventListener('hashchange', render);

// Stop pinch/double-tap zoom on iOS (viewport meta handles most of it).
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350 && e.target.closest('.screen')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

window.addEventListener('resize', () => {
  // Phone/tablet icon sizes come from tokens; re-render non-game screens when crossing breakpoints.
  const route = parseRoute();
  if (route.name !== 'game') {
    clearTimeout(window.__rz);
    window.__rz = setTimeout(refresh, 150);
  }
});

// ---------------------------------------------------------------------------
// Service worker + updates

let reloading = false;

function showUpdate(worker) {
  ui.updateWorker = worker;
  const route = parseRoute();
  // Never interrupt a puzzle: the banner only appears on Home and Levels.
  if (route.name === 'home' || route.name === 'levels') refresh();
}

function applyUpdate() {
  if (!ui.updateWorker) return;
  ui.updating = true;
  refresh();
  reloading = true;
  ui.updateWorker.postMessage({ type: 'SKIP_WAITING' });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) window.location.reload();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch {
    /* offline first load or unsupported: the app still works online */
  }
}

// ---------------------------------------------------------------------------
// Start

store.load();
applySettings();
store.requestPersistence();

// Resume exactly where they left off when the app is reopened.
if (!location.hash && !store.hadLoadError()) {
  const saved = store.getRoute();
  if (saved && saved !== '#/') history.replaceState(null, '', saved);
}
render();
registerServiceWorker();

// Exposed for tests and debugging.
window.__wordsearch = { VERSION, store, generateLevel, categories: CATEGORIES };
