import { describe, expect, it } from 'vitest';

import type { InkPoint } from '@/services/handwriting/model';
import {
  SHAPE_GROUPS,
  SHAPE_KINDS,
  isClosed,
  isRegular,
  shapeBox,
  shapePoints,
} from '@/services/handwriting/shapes';
import { QUICK_NOTE_ASPECT } from '@/types/notes';

/** The note page: taller than it is wide, which is the whole difficulty. */
const ASPECT = QUICK_NOTE_ASPECT;
const W = 1000;
const H = W / ASPECT;

/** A point in page fractions, as pixels on a page of that size. */
const px = ([x, y]: InkPoint): [number, number] => [x * W, y * H];

const extent = (points: InkPoint[]) => {
  const xs = points.map((p) => px(p)[0]);
  const ys = points.map((p) => px(p)[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

const sides = (points: InkPoint[]) => {
  const out: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = px(points[i - 1]!);
    const [bx, by] = px(points[i]!);
    out.push(Math.hypot(bx - ax, by - ay));
  }
  return out;
};

describe('shapePoints', () => {
  it('gives every shape a drawable run of real numbers', () => {
    for (const kind of SHAPE_KINDS) {
      const points = shapePoints(kind, [0.2, 0.2], [0.7, 0.6], ASPECT);
      expect(points.length, kind).toBeGreaterThanOrEqual(2);
      for (const [x, y] of points) {
        expect(Number.isFinite(x) && Number.isFinite(y), kind).toBe(true);
      }
    }
  });

  it('keeps every shape on the page it was drawn inside', () => {
    for (const kind of SHAPE_KINDS) {
      for (const [a, b] of [
        [
          [0.05, 0.05],
          [0.95, 0.95],
        ],
        [
          [0.4, 0.4],
          [0.6, 0.5],
        ],
      ] as [InkPoint, InkPoint][]) {
        for (const [x, y] of shapePoints(kind, a, b, ASPECT)) {
          expect(x, `${kind} x`).toBeGreaterThanOrEqual(-0.02);
          expect(x, `${kind} x`).toBeLessThanOrEqual(1.02);
          expect(y, `${kind} y`).toBeGreaterThanOrEqual(-0.02);
          expect(y, `${kind} y`).toBeLessThanOrEqual(1.02);
        }
      }
    }
  });

  it('survives a tap, where the box has no size at all', () => {
    for (const kind of SHAPE_KINDS) {
      for (const [x, y] of shapePoints(kind, [0.5, 0.5], [0.5, 0.5], ASPECT)) {
        expect(Number.isFinite(x) && Number.isFinite(y), kind).toBe(true);
      }
    }
  });
});

describe('shapes that must hold their proportions', () => {
  it('draws a square square on screen, not square in the numbers', () => {
    const { w, h } = extent(shapePoints('square', [0.2, 0.2], [0.7, 0.9], ASPECT));
    expect(w / h).toBeCloseTo(1, 6);
  });

  it('draws a circle round', () => {
    const { w, h } = extent(shapePoints('circle', [0.2, 0.2], [0.8, 0.5], ASPECT));
    expect(w / h).toBeCloseTo(1, 6);
  });

  it('gives every regular shape equal sides on screen', () => {
    // The real test of regularity. A regular pentagon's bounding box is never
    // square — it is wider than it is tall — but its sides are all the same.
    for (const kind of SHAPE_KINDS.filter(isRegular)) {
      const measured = sides(shapePoints(kind, [0.2, 0.2], [0.7, 0.9], ASPECT));
      for (const side of measured) expect(side / measured[0]!, kind).toBeCloseTo(1, 8);
    }
  });

  it('never lets a regular shape grow past the box that was dragged', () => {
    for (const kind of SHAPE_KINDS.filter(isRegular)) {
      const box = shapeBox([0.05, 0.05], [0.95, 0.95], kind, ASPECT);
      expect(box.width, kind).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(box.height, kind).toBeLessThanOrEqual(0.9 + 1e-9);
    }
  });

  it('grows a regular shape out from the corner the drag began at', () => {
    for (const kind of SHAPE_KINDS.filter(isRegular)) {
      // Dragged up and to the left, so the start corner is bottom-right.
      const box = shapeBox([0.8, 0.8], [0.2, 0.3], kind, ASPECT);
      expect(box.left + box.width, kind).toBeCloseTo(0.8, 10);
      expect(box.top + box.height, kind).toBeCloseTo(0.8, 10);
    }
  });

  it('leaves a rectangle free to be whatever shape the drag makes it', () => {
    const { w, h } = extent(shapePoints('rectangle', [0.2, 0.2], [0.8, 0.4], ASPECT));
    expect(Math.abs(w / h - 1)).toBeGreaterThan(0.2);
  });

  it('builds an isoceles triangle symmetric without forcing it equilateral', () => {
    expect(isRegular('triangle-isoceles')).toBe(false);
    const points = shapePoints('triangle-isoceles', [0.2, 0.2], [0.8, 0.4], ASPECT);
    expect(points[0]![0]).toBeCloseTo((points[1]![0] + points[2]![0]) / 2, 10);
  });
});

describe('how a shape follows the drag', () => {
  it('draws a box-filling shape the same whichever corner it was dragged from', () => {
    for (const kind of SHAPE_KINDS) {
      // A line and an arrow follow the hand, and a regular shape stays
      // anchored where the drag began; neither is direction-blind, by design.
      if (kind === 'line' || kind === 'arrow' || kind === 'double-arrow') continue;
      if (isRegular(kind)) continue;
      expect(shapePoints(kind, [0.2, 0.2], [0.7, 0.6], ASPECT), kind).toEqual(
        shapePoints(kind, [0.7, 0.6], [0.2, 0.2], ASPECT),
      );
    }
  });

  it('runs a line exactly between the two ends of the drag', () => {
    const line = shapePoints('line', [0.2, 0.3], [0.8, 0.7], ASPECT);
    expect(line[0]).toEqual([0.2, 0.3]);
    expect(line[line.length - 1]).toEqual([0.8, 0.7]);
  });

  it('points an arrow where the hand went, with the head behind the tip', () => {
    const points = shapePoints('arrow', [0.2, 0.5], [0.8, 0.5], ASPECT);
    expect(points[0]).toEqual([0.2, 0.5]);
    expect(points[1]).toEqual([0.8, 0.5]);
    for (const [x] of points) expect(x).toBeLessThanOrEqual(0.8 + 1e-9);
  });

  it('gives an arrow the same head whichever way it points', () => {
    const barb = (a: InkPoint, b: InkPoint) => {
      const points = shapePoints('arrow', a, b, ASPECT);
      const [bx, by] = px(points[2]!);
      const [tx, ty] = px(points[1]!);
      return Math.hypot(bx - tx, by - ty);
    };
    expect(barb([0.3, 0.5], [0.7, 0.5])).toBeCloseTo(barb([0.5, 0.3], [0.5, 0.7]), 8);
  });
});

describe('isClosed', () => {
  it('agrees with whether the points actually come back round', () => {
    for (const kind of SHAPE_KINDS) {
      const points = shapePoints(kind, [0.2, 0.2], [0.7, 0.6], ASPECT);
      const first = points[0]!;
      const last = points[points.length - 1]!;
      const closed = Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9;
      expect(closed, `${kind} closes: ${closed}, isClosed says ${isClosed(kind)}`).toBe(
        isClosed(kind),
      );
    }
  });
});

describe('the panel list', () => {
  it('lists every shape exactly once', () => {
    const all = SHAPE_GROUPS.flatMap((group) => group.kinds);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(SHAPE_KINDS.length);
  });
});
