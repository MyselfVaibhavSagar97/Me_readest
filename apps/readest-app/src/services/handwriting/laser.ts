/**
 * The laser pointer's trail: where it has been, and how bright each part of
 * it still is.
 *
 * Laser marks are the first thing in a note that is not meant to last. They
 * are never committed to the editor, never saved with the note, and cannot
 * be erased, lassoed or undone — there is nothing to erase, because in a
 * second or two there is nothing there. That makes this module pure
 * arithmetic over timestamped points, with no editor and no storage behind
 * it at all.
 */

/** A line that follows the hand, or a single dot that sits under it. */
export type LaserMode = 'line' | 'dot';

/** A point of the trail: x and y as fractions of the page, and when it was made. */
export type LaserPoint = [number, number, number];

/**
 * The part of a mark's life it stays at full brightness before fading. A
 * trail that starts dimming the instant it is drawn reads as faulty rather
 * than as fading, so it holds first and then goes.
 */
export const LASER_HOLD = 0.4;

/**
 * A ceiling on how many points a trail keeps. Time does the real trimming;
 * this is only so that a very long duration and a very fast hand cannot
 * grow the trail without limit.
 */
export const MAX_TRAIL = 2000;

/** How bright a mark of this age still is, from 1 down to 0. */
export const laserAlpha = (age: number, duration: number): number => {
  if (duration <= 0) return 0;
  if (age <= 0) return 1;
  if (age >= duration) return 0;
  const hold = duration * LASER_HOLD;
  if (age <= hold) return 1;
  const fading = (age - hold) / (duration - hold);
  return Math.max(0, Math.min(1, 1 - fading));
};

/** The trail with everything that has finished fading dropped. */
export const trimTrail = (
  points: readonly LaserPoint[],
  now: number,
  duration: number,
): LaserPoint[] => {
  const alive = points.filter((point) => now - point[2] < duration);
  return alive.length > MAX_TRAIL ? alive.slice(alive.length - MAX_TRAIL) : alive;
};

/** Whether anything is still showing, so the redrawing can stop when not. */
export const trailAlive = (
  points: readonly LaserPoint[],
  now: number,
  duration: number,
): boolean => points.some((point) => now - point[2] < duration);

export interface LaserSegment {
  from: [number, number];
  to: [number, number];
  /** The brightness of the newer of its two ends. */
  alpha: number;
}

/**
 * The trail as segments to draw, each with its own brightness, so the line
 * fades along its length — brightest under the hand, gone at the tail.
 *
 * A gap in time longer than `breakMs` ends the line and starts another, so
 * lifting the pen and putting it down somewhere else does not draw a streak
 * across the page between the two.
 */
export const trailSegments = (
  points: readonly LaserPoint[],
  now: number,
  duration: number,
  breakMs = 120,
): LaserSegment[] => {
  const out: LaserSegment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]!;
    const point = points[i]!;
    if (point[2] - previous[2] > breakMs) continue;
    const alpha = laserAlpha(now - point[2], duration);
    if (alpha <= 0) continue;
    out.push({ from: [previous[0], previous[1]], to: [point[0], point[1]], alpha });
  }
  return out;
};

/** The dot: where the hand is now, and how bright it still is. */
export const trailDot = (
  points: readonly LaserPoint[],
  now: number,
  duration: number,
): { at: [number, number]; alpha: number } | null => {
  const last = points[points.length - 1];
  if (!last) return null;
  const alpha = laserAlpha(now - last[2], duration);
  return alpha > 0 ? { at: [last[0], last[1]], alpha } : null;
};
