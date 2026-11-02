// Grid input: supports BOTH tap-tap and drag, with Pointer Events.
//
//  Tap-tap: tap the first letter (it stays marked), then the last letter.
//           Tapping the first letter again cancels. If the two taps aren't in a
//           straight line, the second tap becomes the new first letter.
//  Drag:    press and drag; the selection snaps to the nearest of 8 directions.
//           Movement under 40% of a cell counts as a tap.

import { lineCells } from './generator.js';

const TAP_SLOP = 0.4; // in cells

export class GridInput {
  /**
   * @param {HTMLElement} surface element covering exactly the grid cells
   * @param {number} size grid size (cells per side)
   * @param {{onAnchor(cell|null):void, onPreview(cells|null):void, onSelect(cells):void}} cb
   */
  constructor(surface, size, cb) {
    this.el = surface;
    this.size = size;
    this.cb = cb;
    this.anchor = null;
    this.drag = null; // { id, start:[r,c], x0, y0, moved, cells }

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onCancel = this.onCancel.bind(this);
    surface.addEventListener('pointerdown', this.onDown);
    surface.addEventListener('pointermove', this.onMove);
    surface.addEventListener('pointerup', this.onUp);
    surface.addEventListener('pointercancel', this.onCancel);
    surface.addEventListener('lostpointercapture', this.onCancel);
    // Block long-press callouts, text selection and context menus on the grid.
    this.blocker = (e) => e.preventDefault();
    surface.addEventListener('contextmenu', this.blocker);
    surface.addEventListener('selectstart', this.blocker);
    surface.addEventListener('touchstart', this.blocker, { passive: false });
    surface.addEventListener('touchmove', this.blocker, { passive: false });
    surface.addEventListener('dblclick', this.blocker);
  }

  destroy() {
    const s = this.el;
    s.removeEventListener('pointerdown', this.onDown);
    s.removeEventListener('pointermove', this.onMove);
    s.removeEventListener('pointerup', this.onUp);
    s.removeEventListener('pointercancel', this.onCancel);
    s.removeEventListener('lostpointercapture', this.onCancel);
    s.removeEventListener('contextmenu', this.blocker);
    s.removeEventListener('selectstart', this.blocker);
    s.removeEventListener('touchstart', this.blocker);
    s.removeEventListener('touchmove', this.blocker);
    s.removeEventListener('dblclick', this.blocker);
  }

  metrics() {
    const r = this.el.getBoundingClientRect();
    return { left: r.left, top: r.top, cell: r.width / this.size };
  }

  /** Cell under a point (clamped to the grid). */
  cellAt(x, y, m = this.metrics()) {
    const clamp = (v) => Math.max(0, Math.min(this.size - 1, v));
    return [clamp(Math.floor((y - m.top) / m.cell)), clamp(Math.floor((x - m.left) / m.cell))];
  }

  onDown(e) {
    if (this.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const m = this.metrics();
    const start = this.cellAt(e.clientX, e.clientY, m);
    this.drag = { id: e.pointerId, start, x0: e.clientX, y0: e.clientY, moved: false, cells: [start] };
    try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    const m = this.metrics();
    const dx = (e.clientX - d.x0) / m.cell;
    const dy = (e.clientY - d.y0) / m.cell;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    if (!d.moved) {
      d.moved = true;
      if (this.anchor) this.setAnchor(null);
    }
    d.cells = this.snap(d.start, m, e.clientX, e.clientY);
    this.cb.onPreview(d.cells);
  }

  /** Snap the drag to the nearest of the 8 directions, clamped to the grid. */
  snap(start, m, x, y) {
    const cx = m.left + (start[1] + 0.5) * m.cell;
    const cy = m.top + (start[0] + 0.5) * m.cell;
    const dx = (x - cx) / m.cell;
    const dy = (y - cy) / m.cell;
    const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    const dc = Math.round(Math.cos((k * Math.PI) / 4));
    const dr = Math.round(Math.sin((k * Math.PI) / 4));
    let steps = Math.max(0, Math.round((dx * dc + dy * dr) / (dc * dc + dr * dr)));
    // Clamp so the end stays inside the grid.
    while (steps > 0) {
      const er = start[0] + dr * steps;
      const ec = start[1] + dc * steps;
      if (er >= 0 && er < this.size && ec >= 0 && ec < this.size) break;
      steps--;
    }
    return lineCells(start, [start[0] + dr * steps, start[1] + dc * steps]);
  }

  onUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    this.drag = null;
    try { this.el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (d.moved) {
      this.cb.onPreview(null);
      if (d.cells.length >= 2) this.cb.onSelect(d.cells);
    } else {
      this.tap(d.start);
    }
  }

  onCancel(e) {
    const d = this.drag;
    if (!d || (e.pointerId !== undefined && e.pointerId !== d.id)) return;
    this.drag = null;
    this.cb.onPreview(null);
  }

  /** Tap-tap logic (also used by the keyboard). */
  tap(cell) {
    const a = this.anchor;
    if (!a) return this.setAnchor(cell);
    if (a[0] === cell[0] && a[1] === cell[1]) return this.setAnchor(null); // tap first letter again: cancel
    const line = lineCells(a, cell);
    if (!line) return this.setAnchor(cell); // not straight: start again from here
    this.setAnchor(null);
    this.cb.onSelect(line);
  }

  setAnchor(cell) {
    this.anchor = cell;
    this.cb.onAnchor(cell);
  }
}
