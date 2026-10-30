import { describe, expect, it } from 'vitest';

import {
  LASER_HOLD,
  MAX_TRAIL,
  laserAlpha,
  trailAlive,
  trailDot,
  trailSegments,
  trimTrail,
  type LaserPoint,
} from '@/services/handwriting/laser';

/** Two seconds, the duration the panel starts at. */
const D = 2000;
const at = (x: number, y: number, t: number): LaserPoint => [x, y, t];

describe('laserAlpha', () => {
  it('shows a fresh mark at full brightness', () => {
    expect(laserAlpha(0, D)).toBeCloseTo(1, 10);
  });

  it('holds a mark bright before it starts to fade', () => {
    expect(laserAlpha(D * LASER_HOLD * 0.5, D)).toBeCloseTo(1, 10);
    expect(laserAlpha(D * LASER_HOLD, D)).toBeCloseTo(1, 10);
  });

  it('fades a mark to nothing by the end of its life', () => {
    expect(laserAlpha(D, D)).toBeCloseTo(0, 10);
    expect(laserAlpha(D * 2, D)).toBeCloseTo(0, 10);
  });

  it('fades steadily rather than falling off a cliff', () => {
    expect(laserAlpha((D * LASER_HOLD + D) / 2, D)).toBeCloseTo(0.5, 10);
  });

  it('never returns anything outside 0 to 1, whatever it is asked', () => {
    for (const [age, duration] of [
      [-100, D],
      [0, 0],
      [50, -5],
      [1e9, D],
    ]) {
      const alpha = laserAlpha(age!, duration!);
      expect(Number.isFinite(alpha)).toBe(true);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
  });
});

describe('trimTrail', () => {
  it('drops what has finished fading and keeps what has not', () => {
    const points = [at(0.1, 0.1, 0), at(0.2, 0.2, 1500), at(0.3, 0.3, 2500)];
    const kept = trimTrail(points, 3000, D);
    expect(kept.map((p) => p[0])).toEqual([0.2, 0.3]);
  });

  it('copes with an empty trail', () => {
    expect(trimTrail([], 1000, D)).toEqual([]);
  });

  it('caps the trail, so a long duration and a fast hand cannot grow it forever', () => {
    const many = Array.from({ length: MAX_TRAIL + 500 }, () => at(0.5, 0.5, 1000));
    expect(trimTrail(many, 1000, D)).toHaveLength(MAX_TRAIL);
  });

  it('keeps the newest points when it caps', () => {
    const many = Array.from({ length: MAX_TRAIL + 10 }, (_unused, i) => at(i / 10000, 0.5, 1000));
    const kept = trimTrail(many, 1000, D);
    expect(kept[kept.length - 1]![0]).toBeCloseTo((MAX_TRAIL + 9) / 10000, 10);
  });
});

describe('trailAlive', () => {
  it('is true while anything still shows and false once it has gone', () => {
    const points = [at(0.1, 0.1, 1000)];
    expect(trailAlive(points, 1500, D)).toBe(true);
    expect(trailAlive(points, 4000, D)).toBe(false);
    expect(trailAlive([], 0, D)).toBe(false);
  });
});

describe('trailSegments', () => {
  it('joins consecutive points, brightest under the hand', () => {
    const points = [at(0.1, 0.1, 1000), at(0.2, 0.2, 1040), at(0.3, 0.3, 1080)];
    const segments = trailSegments(points, 1080, D);
    expect(segments).toHaveLength(2);
    expect(segments[1]!.alpha).toBeGreaterThanOrEqual(segments[0]!.alpha);
    expect(segments[1]!.to[0]).toBeCloseTo(0.3, 10);
  });

  it('does not streak a line across the page when the pen is lifted', () => {
    const points = [at(0.1, 0.1, 0), at(0.15, 0.1, 30), at(0.9, 0.9, 5000), at(0.92, 0.9, 5030)];
    for (const segment of trailSegments(points, 5030, 10000)) {
      const jump = Math.hypot(
        segment.to[0] - segment.from[0],
        segment.to[1] - segment.from[1],
      );
      expect(jump).toBeLessThan(0.5);
    }
  });

  it('leaves out a segment that has faded rather than drawing it invisible', () => {
    expect(trailSegments([at(0.1, 0.1, 0), at(0.2, 0.2, 30)], 9000, D)).toEqual([]);
  });

  it('makes no segment from a single point', () => {
    expect(trailSegments([at(0.1, 0.1, 0)], 0, D)).toEqual([]);
  });
});

describe('trailDot', () => {
  it('is the newest point, and fades like everything else', () => {
    const points = [at(0.1, 0.1, 0), at(0.4, 0.6, 1000)];
    const dot = trailDot(points, 1000, D);
    expect(dot?.at).toEqual([0.4, 0.6]);
    expect(dot?.alpha).toBeCloseTo(1, 10);
  });

  it('is nothing once it has faded, or when there is no trail', () => {
    expect(trailDot([at(0.1, 0.1, 0)], 9000, D)).toBeNull();
    expect(trailDot([], 0, D)).toBeNull();
  });
});
