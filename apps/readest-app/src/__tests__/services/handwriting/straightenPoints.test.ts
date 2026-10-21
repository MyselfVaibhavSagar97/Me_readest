import { describe, it, expect } from 'vitest';

import { straightenPoints } from '@/services/handwriting/model';
import type { InkPoint } from '@/services/handwriting/model';

/** A wobbly path from one corner to another. */
const wobble = (): InkPoint[] => [
  [0, 0],
  [0.2, 0.4],
  [0.4, 0.1],
  [0.6, 0.5],
  [1, 1],
];

describe('straightenPoints', () => {
  it('keeps only the ends, so the stroke is the line between them', () => {
    expect(straightenPoints(wobble(), true)).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('leaves the path alone when a straight line was not asked for', () => {
    expect(straightenPoints(wobble(), false)).toEqual(wobble());
  });

  it('passes a path with no two ends through untouched', () => {
    expect(straightenPoints([], true)).toEqual([]);
    expect(straightenPoints([[0.5, 0.5]], true)).toEqual([[0.5, 0.5]]);
  });

  it('carries the pressure of the two ends it keeps', () => {
    const pressured: InkPoint[] = [
      [0, 0, 0.2],
      [0.5, 0.9, 1],
      [1, 1, 0.6],
    ];

    expect(straightenPoints(pressured, true)).toEqual([
      [0, 0, 0.2],
      [1, 1, 0.6],
    ]);
  });

  it('does not alter the path it was given', () => {
    const points = wobble();
    straightenPoints(points, true);

    expect(points).toHaveLength(5);
  });
});
