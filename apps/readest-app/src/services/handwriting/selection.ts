import type { InkPoint, InkStroke } from './model';
import { isInsidePath } from './pointEraser';

/**
 * Picking ink up: which strokes a lasso caught, where they sit, and what
 * moving or resizing them does to their points.
 *
 * All of it is arithmetic on normalized coordinates, kept apart from the
 * editor so the rules can be checked on their own. Nothing here mutates a
 * stroke: every function returns new ones, as the rest of the engine expects.
 */

/**
 * How a loop decides what it caught.
 *
 * `free` and `rect` take anything they touch, which is what a hand drawing a
 * quick circle round a word means. `accurate` takes only what is wholly
 * inside, for picking one word out of a line without dragging its neighbours
 * along.
 */
export type LassoShape = 'free' | 'rect' | 'accurate';

/** The kinds of thing a lasso can be told to pick up. */
export type SelectableKind = 'handwriting' | 'highlighter';

export const SELECTABLE_KINDS: readonly SelectableKind[] = ['handwriting', 'highlighter'] as const;

/** Which kind a stroke is, as the Selectable switches name it. */
export const kindOf = (stroke: InkStroke): SelectableKind =>
  stroke.tool === 'marker' ? 'highlighter' : 'handwriting';

/** The rectangle between two corners, as a closed path the lasso can use. */
export const rectPath = (from: InkPoint, to: InkPoint): InkPoint[] => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
};

export interface SelectOptions {
  shape?: LassoShape;
  /** Kinds the lasso is allowed to pick up; all of them when absent. */
  kinds?: readonly SelectableKind[];
}

/**
 * How finely a stroke is walked when asking whether it entered the loop:
 * about 0.8mm across an A4 page.
 */
const STEP = 1 / 256;

/** As in the point eraser: a cap, so one enormous stroke cannot stall a drag. */
const MAX_SAMPLES = 4000;

/**
 * Whether a stroke goes anywhere near the inside of the loop.
 *
 * Testing the stroke's own points is not enough. A stroke stores only the
 * samples it needed — a ruled highlighter line keeps just its two ends — so a
 * line drawn clean through the loop has nothing inside it to find, and a
 * lasso round the middle of a highlight would come up empty. The stroke is
 * walked between its points instead, which is what the point eraser does for
 * the same reason.
 */
const entersPath = (path: readonly InkPoint[], points: readonly InkPoint[]): boolean => {
  let budget = MAX_SAMPLES;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    if (isInsidePath(path, p[0], p[1])) return true;
    const q = points[i + 1];
    if (!q || budget <= 0) continue;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const steps = Math.min(budget, Math.floor(Math.hypot(dx, dy) / STEP));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / (steps + 1);
      if (isInsidePath(path, p[0] + dx * t, p[1] + dy * t)) return true;
    }
    budget -= steps;
  }
  return false;
};

/**
 * The ids of the strokes a loop caught, in the order they are drawn.
 *
 * Ink pinned to a book's text is never caught: a pinned stroke is placed by
 * the text it belongs to, so it cannot be moved or resized, and a selection
 * that cannot be acted on is worse than no selection.
 */
export const selectStrokes = (
  strokes: readonly InkStroke[],
  path: readonly InkPoint[],
  { shape = 'free', kinds }: SelectOptions = {},
): string[] => {
  if (path.length < 3) return [];
  const allowed = kinds ? new Set(kinds) : null;
  const caught: string[] = [];
  for (const stroke of strokes) {
    if (stroke.anchor) continue;
    if (allowed && !allowed.has(kindOf(stroke))) continue;
    if (stroke.points.length === 0) continue;
    const hit =
      shape === 'accurate'
        ? stroke.points.every((p) => isInsidePath(path, p[0], p[1]))
        : entersPath(path, stroke.points);
    if (hit) caught.push(stroke.id);
  }
  return caught;
};

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The box the given strokes occupy, widened by half each stroke's width so
 * the ink sits inside the box rather than poking out of it. Null when there
 * is nothing to bound.
 */
export const boundsOf = (strokes: readonly InkStroke[]): Bounds | null => {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const stroke of strokes) {
    const pad = stroke.width / 2;
    for (const [x, y] of stroke.points) {
      left = Math.min(left, x - pad);
      top = Math.min(top, y - pad);
      right = Math.max(right, x + pad);
      bottom = Math.max(bottom, y + pad);
    }
  }
  return left === Infinity ? null : { left, top, right, bottom };
};

/**
 * The move actually allowed, given where the selection is now: a drag that
 * would carry ink off the page is cut short at the edge rather than refused,
 * so dragging into a corner settles against it instead of snapping back.
 */
export const clampMove = (bounds: Bounds, dx: number, dy: number): [number, number] => [
  Math.min(1 - bounds.right, Math.max(-bounds.left, dx)),
  Math.min(1 - bounds.bottom, Math.max(-bounds.top, dy)),
];

const mapPoints = (stroke: InkStroke, fn: (x: number, y: number) => [number, number]): InkStroke => ({
  ...stroke,
  points: stroke.points.map((p) => {
    const [x, y] = fn(p[0], p[1]);
    return (p[2] === undefined ? [x, y] : [x, y, p[2]]) as InkPoint;
  }),
});

/** The strokes shifted by `dx`, `dy`. */
export const moveStrokes = (strokes: readonly InkStroke[], dx: number, dy: number): InkStroke[] =>
  strokes.map((stroke) => mapPoints(stroke, (x, y) => [x + dx, y + dy]));

/**
 * The smallest a selection may be scaled to. Below this a stroke's points
 * collapse into each other and the ink cannot be recovered by scaling back
 * up, so the handle stops here instead.
 */
export const MIN_SCALE = 0.1;

/**
 * The strokes scaled about `origin` — the corner held still while the
 * opposite one is dragged. Width scales with them: ink resized to half the
 * size and still drawn at its old thickness reads as a different pen.
 */
export const scaleStrokes = (
  strokes: readonly InkStroke[],
  origin: [number, number],
  factor: number,
): InkStroke[] => {
  const scale = Math.max(MIN_SCALE, factor);
  const [ox, oy] = origin;
  return strokes.map((stroke) => ({
    ...mapPoints(stroke, (x, y) => [ox + (x - ox) * scale, oy + (y - oy) * scale]),
    width: stroke.width * scale,
  }));
};

/**
 * The largest scale that keeps the selection on the page when it grows from
 * `origin`. A handle dragged past the edge stops there.
 */
export const maxScale = (bounds: Bounds, origin: [number, number]): number => {
  const [ox, oy] = origin;
  const limits = [
    bounds.left < ox ? ox / (ox - bounds.left) : Infinity,
    bounds.top < oy ? oy / (oy - bounds.top) : Infinity,
    bounds.right > ox ? (1 - ox) / (bounds.right - ox) : Infinity,
    bounds.bottom > oy ? (1 - oy) / (bounds.bottom - oy) : Infinity,
  ];
  return Math.max(MIN_SCALE, Math.min(...limits));
};

let copyCounter = 0;
const nextCopyId = () => `c${Date.now().toString(36)}${(copyCounter++).toString(36)}`;

/**
 * Copies of the strokes, offset a little so the copy is visibly its own ink
 * rather than sitting exactly on the original. Each copy gets a new id, so
 * the copy is what stays selected and the original is left where it was.
 */
export const duplicateStrokes = (
  strokes: readonly InkStroke[],
  offset = 0.02,
): InkStroke[] => {
  const bounds = boundsOf(strokes);
  const [dx, dy] = bounds ? clampMove(bounds, offset, offset) : [0, 0];
  return moveStrokes(strokes, dx, dy).map((stroke) => ({ ...stroke, id: nextCopyId() }));
};

/** The strokes in `ids`, in page order; ids that are no longer there are skipped. */
export const strokesByIds = (
  strokes: readonly InkStroke[],
  ids: readonly string[],
): InkStroke[] => {
  const wanted = new Set(ids);
  return strokes.filter((stroke) => wanted.has(stroke.id));
};
