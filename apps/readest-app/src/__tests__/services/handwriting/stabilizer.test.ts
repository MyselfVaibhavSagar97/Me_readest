import { describe, it, expect } from 'vitest';

import { StrokeStabilizer } from '@/services/handwriting/stabilizer';
import type { InkPoint } from '@/services/handwriting/model';

/** A straight line with a one-pixel tremor on it, as a shaky hand draws. */
const shakyLine = (): InkPoint[] =>
  Array.from({ length: 40 }, (_unused, i): InkPoint => [i, i % 2 === 0 ? 1 : -1]);

/** How far the points stray from y = 0, which is the line really intended. */
const wobble = (points: InkPoint[]) =>
  points.reduce((total, [, y]) => total + Math.abs(y), 0) / points.length;

describe('StrokeStabilizer', () => {
  it('passes points through untouched when it is turned off', () => {
    const stabilizer = new StrokeStabilizer(0);
    const input = shakyLine();

    expect(input.map((point) => stabilizer.push(point))).toEqual(input);
  });

  it('smooths a tremor out of a stroke', () => {
    const stabilizer = new StrokeStabilizer(1);
    const input = shakyLine();

    const output = input.map((point) => stabilizer.push(point));

    expect(wobble(output)).toBeLessThan(wobble(input) / 2);
  });

  it('smooths more the higher it is set', () => {
    const at = (strength: number) => {
      const stabilizer = new StrokeStabilizer(strength);
      return wobble(shakyLine().map((point) => stabilizer.push(point)));
    };

    expect(at(1)).toBeLessThan(at(0.5));
    expect(at(0.5)).toBeLessThan(at(0));
  });

  it('smooths pressure alongside position, so the width does not jitter', () => {
    const stabilizer = new StrokeStabilizer(1);
    stabilizer.push([0, 0, 0.1]);
    const [, , pressure] = stabilizer.push([1, 0, 1]);

    expect(pressure).toBeDefined();
    expect(pressure!).toBeGreaterThan(0.1);
    expect(pressure!).toBeLessThan(1);
  });

  it('keeps a point without pressure free of one', () => {
    const stabilizer = new StrokeStabilizer(1);
    stabilizer.push([0, 0]);

    expect(stabilizer.push([10, 10])).toHaveLength(2);
  });

  it('starts each stroke at the pen, not where the last one ended', () => {
    const stabilizer = new StrokeStabilizer(1);
    stabilizer.push([0, 0]);
    stabilizer.push([1, 1]);

    stabilizer.reset();

    // Without the reset, a new stroke would be dragged back towards the
    // previous one and begin with a leader line across the page.
    expect(stabilizer.push([500, 500])).toEqual([500, 500]);
  });

  it('clamps a strength outside 0..1 rather than inverting the filter', () => {
    const tooHigh = new StrokeStabilizer(5);
    const tooLow = new StrokeStabilizer(-2);
    tooHigh.push([0, 0]);
    tooLow.push([0, 0]);

    const [highX] = tooHigh.push([100, 0]);
    const [lowX] = tooLow.push([100, 0]);

    expect(highX).toBeGreaterThan(0);
    expect(highX).toBeLessThan(100);
    expect(lowX).toBe(100);
  });
});
