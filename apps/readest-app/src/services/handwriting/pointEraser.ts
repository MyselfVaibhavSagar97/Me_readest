import { roundPoints, simplifyPoints, type InkPoint, type InkStroke } from './model';

/**
 * Erasing by area, the way a paint program's eraser works: only the ink
 * actually under the eraser goes, and a line rubbed through the middle comes
 * back as two shorter lines rather than vanishing.
 *
 * Ink here is a polyline, not pixels, so the work is to find which parts of a
 * stroke the eraser covered and rebuild what is left. The stroke is walked in
 * small steps rather than tested point by point: a simplified stroke can hold
 * a long straight run between two samples, and testing only those two would
 * let an eraser pass through the middle of it without touching anything.
 */

/** Distance from a point to a line segment. */
const pointToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** Distance from a point to the whole eraser path. */
const distanceToPath = (x: number, y: number, path: readonly InkPoint[]) => {
  if (path.length === 1) return Math.hypot(x - path[0]![0], y - path[0]![1]);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    best = Math.min(best, pointToSegment(x, y, a[0], a[1], b[0], b[1]));
    if (best === 0) return 0;
  }
  return best;
};

/** A long stroke is not walked more finely than this, to bound the work. */
const MAX_SAMPLES = 4000;

/** The stroke resampled evenly, so a sparse straight run is still covered. */
const walk = (points: readonly InkPoint[], step: number): InkPoint[] => {
  if (points.length < 2) return [...points];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  const spacing = Math.max(step, length / MAX_SAMPLES);

  const samples: InkPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    const span = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(1, Math.ceil(span / spacing));
    for (let k = samples.length === 0 ? 0 : 1; k <= steps; k++) {
      const t = k / steps;
      const pressure =
        from[2] === undefined || to[2] === undefined
          ? (from[2] ?? to[2])
          : from[2] + (to[2] - from[2]) * t;
      const x = from[0] + (to[0] - from[0]) * t;
      const y = from[1] + (to[1] - from[1]) * t;
      samples.push(pressure === undefined ? [x, y] : [x, y, pressure]);
    }
  }
  return samples;
};

/**
 * What survives of `points` after the eraser passes: zero or more runs, in
 * order. A run of a single sample is dropped — a lone dot left behind where a
 * line was rubbed out reads as dirt, not as ink the user meant to keep.
 */
export const erasedRuns = (
  points: readonly InkPoint[],
  path: readonly InkPoint[],
  radius: number,
): InkPoint[][] => {
  if (points.length === 0 || path.length === 0) return [];
  if (points.length === 1) {
    const [x, y] = points[0]!;
    return distanceToPath(x, y, path) <= radius ? [] : [[...points]];
  }

  const samples = walk(points, radius / 2);
  const runs: InkPoint[][] = [];
  let run: InkPoint[] = [];
  for (const sample of samples) {
    if (distanceToPath(sample[0], sample[1], path) <= radius) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else {
      run.push(sample);
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
};

let pieceCounter = 0;
const nextPieceId = () => `e${Date.now().toString(36)}${(pieceCounter++).toString(36)}`;

/**
 * The stroke as it is left by the eraser: the pieces that survive, each one a
 * stroke in its own right with the same pen, colour and width. An empty
 * result means the eraser took all of it.
 *
 * Surviving pieces are simplified again before they are stored, because
 * walking the stroke leaves far more samples than its shape needs.
 */
export const splitStroke = (
  stroke: InkStroke,
  path: readonly InkPoint[],
  radius: number,
): InkStroke[] =>
  erasedRuns(stroke.points, path, radius).map((run) => ({
    ...stroke,
    id: nextPieceId(),
    points: roundPoints(simplifyPoints(run)),
  }));
