// SVG icons from the design (design/source/CatIcon.dc.html and the screen files).
// All are 24x24 line icons drawn with currentColor.

const CATEGORY_PATHS = {
  fishing: `<path d="M2.5 12c3-4.2 8.3-5.2 12.5-2.6L19.5 6v12L15 14.6C10.8 17.2 5.5 16.2 2.5 12z"/><circle cx="7" cy="11.2" r="0.9" fill="currentColor"/><path d="M10.5 9.5c.8 1.6.8 3.4 0 5"/>`,
  boats: `<path d="M12 3v13"/><path d="M12 4.5L18.5 15H12z"/><path d="M10 6.5L5.5 15H10"/><path d="M3 17.5h18l-2.6 3.5H5.6z"/>`,
  cars: `<path d="M4.2 16.5H2.5v-4.2L5.3 7.5h10.2l4 4.8h2v4.2h-1.6"/><path d="M9.4 16.5h5.2"/><path d="M6 12.3h13.5"/><path d="M10.5 7.5v4.8"/><circle cx="6.8" cy="16.7" r="2.4"/><circle cx="17.2" cy="16.7" r="2.4"/>`,
  classic: `<path d="M5 21.5V3"/><path d="M5 4h14v9.5H5"/><path d="M9.7 4v9.5"/><path d="M14.3 4v9.5"/><path d="M5 8.75h14"/><path d="M5 4h4.7v4.75H5z" fill="currentColor"/><path d="M14.3 4H19v4.75h-4.7z" fill="currentColor"/><path d="M9.7 8.75h4.6v4.75H9.7z" fill="currentColor"/>`,
  animals: `<path d="M12 12.5c-3 0-5.5 3-5.5 5.2 0 1.6 1.3 2.6 2.8 2.6 1.1 0 1.8-.6 2.7-.6s1.6.6 2.7.6c1.5 0 2.8-1 2.8-2.6 0-2.2-2.5-5.2-5.5-5.2z"/><ellipse cx="5" cy="10" rx="1.9" ry="2.4"/><ellipse cx="9" cy="5.6" rx="1.9" ry="2.5"/><ellipse cx="15" cy="5.6" rx="1.9" ry="2.5"/><ellipse cx="19" cy="10" rx="1.9" ry="2.4"/>`,
  birds: `<path d="M16 6.5c1.8 0 3 1.2 3.3 2.6L21.5 10l-2.3.9c0 5-3.8 9.1-9.7 9.1H3.5l3-3.2C5 14.8 5.6 11 8.8 9.6c2.2-.9 4.2-.6 5.2-1.5.5-.9 1-1.6 2-1.6z"/><circle cx="16.3" cy="9" r="0.9" fill="currentColor"/><path d="M8.5 13.5c1.8 1.3 4.2 1.4 6.2.2"/>`,
  places: `<path d="M12 21.5s-6.5-6.2-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11.5-6.5 11.5z"/><circle cx="12" cy="10" r="2.4"/>`,
  sport: `<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6c3.2 3.2 3.2 9.6 0 12.8"/><path d="M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8"/>`,
  food: `<path d="M4.5 11h15v5a4.5 4.5 0 0 1-4.5 4.5H9A4.5 4.5 0 0 1 4.5 16z"/><path d="M2.5 11h19"/><path d="M2.5 13.5h2M19.5 13.5h2"/><path d="M9 3.5v3M12 2.5v4M15 3.5v3"/>`,
  garden: `<path d="M6.5 15.5h11l-1.6 6H8.1z"/><path d="M12 15.5V9.5"/><path d="M12 9.5c0-3.2 2.2-5.5 5.5-5.5 0 3.2-2.2 5.5-5.5 5.5z"/><path d="M12 12c0-2.7-1.9-4.5-4.8-4.5 0 2.7 1.9 4.5 4.8 4.5z"/>`,
  weather: `<circle cx="8" cy="8" r="3"/><path d="M8 2v1.2M2 8h1.2M3.8 3.8l.9.9M12.2 3.8l-.9.9M3.8 12.2l.9-.9"/><path d="M9 20.5h8.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.4 1.3A2.9 2.9 0 0 0 9 20.5z"/>`,
  music: `<path d="M9 18V5.5l11-2.5v12.5"/><path d="M9 9l11-2.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>`,
  house: `<path d="M2.5 11.5L12 3.5l9.5 8"/><path d="M5 9.5V20.5h14V9.5"/><path d="M10 20.5v-5.5h4v5.5"/>`,
  space: `<circle cx="12" cy="12.5" r="5.5"/><path d="M6.6 14.6c-2.6 1.6-3.8 3.2-3.2 4.1 1 1.6 6.4-.2 12-4.1s8.6-8.3 7.6-9.9c-.6-.9-2.5-.7-5 .4"/><path d="M5 4v3M3.5 5.5h3"/>`,
  ocean: `<path d="M7.5 11a4.5 4.5 0 0 1 9 0"/><path d="M12 3.5v1.5M5.6 6.1l1 1M18.4 6.1l-1 1"/><path d="M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.2-1.8 6-.6"/><path d="M2 19.5c2.5-2 4.5-2 7 0s4.5 2 7 0 4.2-1.8 6-.6"/>`,
  trees: `<circle cx="12" cy="8" r="2.2"/><path d="M12 5.8c-.8-2.4 1.6-3.8 2.6-2.4.9 1.3-.6 2.8-2.6 2.4zM14.2 8c2.4-.8 3.8 1.6 2.4 2.6-1.3.9-2.8-.6-2.4-2.6zM12 10.2c.8 2.4-1.6 3.8-2.6 2.4-.9-1.3.6-2.8 2.6-2.4zM9.8 8c-2.4.8-3.8-1.6-2.4-2.6 1.3-.9 2.8.6 2.4 2.6z"/><path d="M12 12.5v9"/><path d="M12 18c-2.8 0-4.5-1.6-4.5-3.5 2.6 0 4.5 1.4 4.5 3.5z"/>`,
};

export const ICON_NAMES = Object.keys(CATEGORY_PATHS);

/** Category icon. Stroke width follows the design: thinner as the icon grows. */
export function categoryIcon(name, size) {
  const sw = size <= 32 ? 2.2 : size <= 64 ? 1.9 : 1.7;
  const paths = CATEGORY_PATHS[name] || CATEGORY_PATHS.fishing;
  return `<svg class="cat-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

const UI = {
  settings: { sw: 2.1, d: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>` },
  chevronLeft: { sw: 2.6, d: `<path d="M15 5l-7 7 7 7"/>` },
  chevronRight: { sw: 2.6, d: `<path d="M9 5l7 7-7 7"/>` },
  check: { sw: 3.4, d: `<path d="M5 12.5l4.5 4.5L19 7.5"/>` },
  checkBold: { sw: 3.6, d: `<path d="M5 12.5l4.5 4.5L19 7.5"/>` },
  help: { sw: 2.2, d: `<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4"/><circle cx="12" cy="17.6" r="0.6" fill="currentColor"/>` },
  refresh: { sw: 2.4, d: `<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>` },
  share: { sw: 2.2, d: `<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M8 10H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/>` },
  addSquare: { sw: 2.2, d: `<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>` },
  // Not in the design: hint uses a light bulb drawn in the same line style.
  hint: { sw: 2.2, d: `<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>` },
  close: { sw: 2.6, d: `<path d="M6 6l12 12M18 6L6 18"/>` },
};

export function uiIcon(name, size = 24, extra = '') {
  if (name === 'play') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" ${extra}><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>`;
  }
  const i = UI[name];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${i.sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${i.d}</svg>`;
}

/** Illustration for the "saved progress couldn't load" state (from the design). */
export const ERROR_ART = `<svg width="104" height="104" viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">
  <circle cx="60" cy="60" r="56" fill="var(--c-info-bg)" stroke="var(--c-info-line)" stroke-width="3"/>
  <rect x="34" y="34" width="52" height="52" rx="8" fill="var(--c-surface)" stroke="var(--c-primary)" stroke-width="3"/>
  <path d="M34 51h52M34 69h52M51 34v52M69 34v52" stroke="var(--c-primary)" stroke-width="2" opacity="0.4"/>
  <path d="M44 60h32" stroke="var(--c-primary)" stroke-width="12" stroke-linecap="round" opacity="0.25"/>
  <circle cx="86" cy="86" r="14" fill="var(--c-warn-bg)" stroke="var(--c-warn-line)" stroke-width="3"/>
  <path d="M86 79v8" stroke="var(--c-warn-ink)" stroke-width="3.4" stroke-linecap="round"/>
  <circle cx="86" cy="92.5" r="1.8" fill="var(--c-warn-ink)"/>
</svg>`;
