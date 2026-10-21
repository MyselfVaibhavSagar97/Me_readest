import type { InkPage, InkPoint, InkStroke } from './model';
import { splitStroke, strokeInsidePath } from './pointEraser';

/**
 * `stroke` takes away every stroke the eraser touches. `area` takes away only
 * the ink under it, so a line rubbed through the middle comes back as two.
 * `lasso` takes away every stroke caught inside a loop drawn around them.
 */
export type EraseMode = 'stroke' | 'area' | 'lasso';

/** Which ink an erase is allowed to touch. */
export type EraseTarget = 'all' | 'highlighter';

export interface EraseOptions {
  mode?: EraseMode;
  target?: EraseTarget;
}

interface PageState {
  strokes: InkStroke[];
  undo: InkStroke[][];
  redo: InkStroke[][];
  updatedAt: number;
}

type Seg = [number, number, number, number];

const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
  (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);

const intersects = (a: Seg, b: Seg) =>
  ccw(a[0], a[1], b[0], b[1], b[2], b[3]) !== ccw(a[2], a[3], b[0], b[1], b[2], b[3]) &&
  ccw(a[0], a[1], a[2], a[3], b[0], b[1]) !== ccw(a[0], a[1], a[2], a[3], b[2], b[3]);

const pointSegDist = (px: number, py: number, s: Seg) => {
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s[0]) * dx + (py - s[1]) * dy) / len2));
  return Math.hypot(px - (s[0] + t * dx), py - (s[1] + t * dy));
};

const segDist = (a: Seg, b: Seg) =>
  intersects(a, b)
    ? 0
    : Math.min(
        pointSegDist(a[0], a[1], b),
        pointSegDist(a[2], a[3], b),
        pointSegDist(b[0], b[1], a),
        pointSegDist(b[2], b[3], a),
      );

const segments = (pts: ArrayLike<InkPoint>): Seg[] => {
  if (pts.length === 1) return [[pts[0]![0], pts[0]![1], pts[0]![0], pts[0]![1]]];
  const out: Seg[] = [];
  for (let i = 1; i < pts.length; i++) {
    out.push([pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1]]);
  }
  return out;
};

/** Where a stroke is drawn now, as polylines; null when it isn't shown. */
export type PlaceStroke = (stroke: InkStroke) => InkPoint[][] | null;

const asStored: PlaceStroke = (stroke) => [stroke.points];

/** Whether a path (eraser sweep or tap) comes within `radius` of the placed stroke. */
const touches = (stroke: InkStroke, placed: InkPoint[][], pathSegs: Seg[], radius: number) => {
  const reach = radius + stroke.width / 2;
  return placed.some((points) => {
    const strokeSegs = segments(points);
    return pathSegs.some((e) => strokeSegs.some((s) => segDist(e, s) <= reach));
  });
};

/**
 * Pure in-memory ink store with per-page undo/redo. Every mutation snapshots
 * the page's stroke list, so add, erase and clear all undo the same way.
 * Strokes are treated as immutable.
 */
export class HandwritingEditor {
  private pages = new Map<string, PageState>();
  private listeners = new Set<() => void>();
  /** The drag whose frames are folding into one undo entry; see `commit`. */
  private gesture: string | undefined;

  constructor(pages?: Record<string, InkPage>) {
    for (const [key, page] of Object.entries(pages ?? {})) {
      this.pages.set(key, { strokes: page.strokes, undo: [], redo: [], updatedAt: page.updatedAt });
    }
  }

  strokes(page: string): readonly InkStroke[] {
    return this.pages.get(page)?.strokes ?? [];
  }

  /** Keys of the pages that currently hold ink. */
  pageKeys(): string[] {
    return [...this.pages].filter(([, state]) => state.strokes.length).map(([key]) => key);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  addStroke(page: string, stroke: InkStroke) {
    if (stroke.points.length === 0) return;
    this.commit(page, [...this.strokes(page), stroke]);
  }

  /** Adds several strokes at once — pasting a copy — as one undoable step. */
  addStrokes(page: string, strokes: readonly InkStroke[]) {
    const wanted = strokes.filter((stroke) => stroke.points.length > 0);
    if (wanted.length === 0) return;
    this.commit(page, [...this.strokes(page), ...wanted]);
  }

  /**
   * Puts the given strokes in place of the ones carrying their ids, leaving
   * every other stroke and the drawing order alone. This is how a selection
   * moves and resizes: the ids stay the same, only the points change.
   *
   * `gesture` is what makes a drag undoable in one step. A run of calls
   * sharing it keeps the single undo entry taken at the start, so dragging
   * ink across the page and then undoing puts it back where it began rather
   * than walking it back one frame at a time. Pass a fresh value per drag.
   */
  replaceStrokes(page: string, strokes: readonly InkStroke[], gesture?: string) {
    if (strokes.length === 0) return;
    const byId = new Map(strokes.map((stroke) => [stroke.id, stroke]));
    const current = this.strokes(page);
    if (!current.some((stroke) => byId.has(stroke.id))) return;
    this.commit(
      page,
      current.map((stroke) => byId.get(stroke.id) ?? stroke),
      gesture,
    );
  }

  /** Removes the strokes carrying these ids, as one undoable step. */
  removeStrokes(page: string, ids: readonly string[]) {
    const doomed = new Set(ids);
    if (doomed.size === 0) return;
    const current = this.strokes(page);
    const next = current.filter((stroke) => !doomed.has(stroke.id));
    if (next.length !== current.length) this.commit(page, next);
  }

  /**
   * Rubs out along the eraser path; returns how many strokes it touched.
   *
   * In `area` mode a touched stroke is cut rather than removed, so only the
   * ink under the eraser goes. Ink pinned to a book's text is removed whole
   * even then: a piece of a pinned stroke has no anchor of its own, so it
   * could not be placed again after a relayout.
   */
  erase(
    page: string,
    path: ArrayLike<InkPoint> | [number, number][],
    radius: number,
    place: PlaceStroke = asStored,
    { mode = 'stroke', target = 'all' }: EraseOptions = {},
  ): number {
    const points = path as InkPoint[];
    const eraserSegs = segments(points);
    if (eraserSegs.length === 0) return 0;
    const current = this.strokes(page);
    const next: InkStroke[] = [];
    let touched = 0;
    for (const stroke of current) {
      const placed = place(stroke);
      // An eraser aimed at the highlighter passes over pen ink entirely, so
      // marking up text does not cost you the writing underneath it.
      const eligible = target === 'all' || stroke.tool === 'marker';
      const caught =
        !!placed &&
        eligible &&
        (mode === 'lasso'
          ? placed.some((piece) => strokeInsidePath(piece, points))
          : touches(stroke, placed, eraserSegs, radius));
      if (!caught) {
        next.push(stroke);
        continue;
      }
      touched++;
      if (mode === 'area' && !stroke.anchor) {
        next.push(...splitStroke(stroke, points, radius));
      }
    }
    if (touched > 0) this.commit(page, next);
    return touched;
  }

  /** Whether any stroke on the page lies within `radius` of the point. */
  hits(page: string, point: InkPoint, radius: number, place: PlaceStroke = asStored): boolean {
    const tap = segments([point]);
    return this.strokes(page).some((stroke) => {
      const placed = place(stroke);
      return !!placed && touches(stroke, placed, tap, radius);
    });
  }

  clear(page: string) {
    if (this.strokes(page).length > 0) this.commit(page, []);
  }

  undo(page: string) {
    const state = this.pages.get(page);
    const prev = state?.undo.pop();
    if (!state || !prev) return;
    state.redo.push(state.strokes);
    state.strokes = prev;
    state.updatedAt = Date.now();
    // Whatever drag was folding into one entry is over; the next commit
    // starts its own, even if it carries the same gesture.
    this.gesture = undefined;
    this.notify();
  }

  redo(page: string) {
    const state = this.pages.get(page);
    const next = state?.redo.pop();
    if (!state || !next) return;
    state.undo.push(state.strokes);
    state.strokes = next;
    state.updatedAt = Date.now();
    this.gesture = undefined;
    this.notify();
  }

  private commit(page: string, strokes: InkStroke[], gesture?: string) {
    const state = this.pages.get(page) ?? { strokes: [], undo: [], redo: [], updatedAt: 0 };
    // A continuing gesture folds into the undo entry its first frame took;
    // anything else — a new drag, a stroke, an erase — starts a fresh one.
    const continuing = gesture !== undefined && gesture === this.gesture;
    if (!continuing) {
      state.undo.push(state.strokes);
      state.redo = [];
    }
    this.gesture = gesture;
    state.strokes = strokes;
    state.updatedAt = Date.now();
    this.pages.set(page, state);
    this.notify();
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }
}
