import { describe, expect, it } from 'vitest';

import type { InkPoint, InkStroke } from '@/services/handwriting/model';
import {
  MIN_SCALE,
  boundsOf,
  clampMove,
  duplicateStrokes,
  kindOf,
  maxScale,
  moveStrokes,
  rectPath,
  scaleStrokes,
  selectStrokes,
  strokesByIds,
} from '@/services/handwriting/selection';

const stroke = (id: string, points: InkPoint[], extra: Partial<InkStroke> = {}): InkStroke => ({
  id,
  color: '#1a1a1a',
  width: 0.006,
  points,
  ...extra,
});

/** A loop around the top-left quarter of the page. */
const LOOP: InkPoint[] = [
  [0.1, 0.1],
  [0.4, 0.1],
  [0.4, 0.4],
  [0.1, 0.4],
];

describe('kindOf', () => {
  it('calls marker ink highlighter and everything else handwriting', () => {
    expect(kindOf(stroke('a', [[0.2, 0.2]]))).toBe('handwriting');
    expect(kindOf(stroke('b', [[0.2, 0.2]], { tool: 'marker' }))).toBe('highlighter');
  });
});

describe('selectStrokes', () => {
  it('catches a stroke inside the loop and leaves one outside alone', () => {
    const strokes = [
      stroke('in', [
        [0.2, 0.2],
        [0.3, 0.3],
      ]),
      stroke('out', [
        [0.7, 0.7],
        [0.8, 0.8],
      ]),
    ];
    expect(selectStrokes(strokes, LOOP)).toEqual(['in']);
  });

  it('catches a stroke that is only partly inside', () => {
    const half = stroke('half', [
      [0.2, 0.2],
      [0.9, 0.9],
    ]);
    expect(selectStrokes([half], LOOP)).toEqual(['half']);
  });

  it('catches a line that crosses the loop with both its ends outside', () => {
    // A stroke stores only the samples it needed, and a ruled highlighter
    // line keeps just its two ends. Testing those points alone would find
    // nothing inside the loop and miss a line drawn clean through it.
    const ruled = stroke('ruled', [
      [0.05, 0.25],
      [0.95, 0.25],
    ]);
    expect(selectStrokes([ruled], LOOP)).toEqual(['ruled']);
  });

  it('accurate mode takes only what is wholly inside', () => {
    const strokes = [
      stroke('whole', [
        [0.2, 0.2],
        [0.3, 0.3],
      ]),
      stroke('half', [
        [0.2, 0.2],
        [0.9, 0.9],
      ]),
    ];
    expect(selectStrokes(strokes, LOOP, { shape: 'accurate' })).toEqual(['whole']);
    expect(selectStrokes(strokes, LOOP, { shape: 'free' })).toEqual(['whole', 'half']);
  });

  it('obeys the Selectable switches', () => {
    const strokes = [
      stroke('pen', [[0.2, 0.2]]),
      stroke('marker', [[0.25, 0.25]], { tool: 'marker' }),
    ];
    expect(selectStrokes(strokes, LOOP, { kinds: ['handwriting'] })).toEqual(['pen']);
    expect(selectStrokes(strokes, LOOP, { kinds: ['highlighter'] })).toEqual(['marker']);
    expect(selectStrokes(strokes, LOOP, { kinds: [] })).toEqual([]);
    expect(selectStrokes(strokes, LOOP)).toEqual(['pen', 'marker']);
  });

  it('never catches ink pinned to a book, which cannot be moved', () => {
    const pinned = stroke('pinned', [[0.2, 0.2]], { anchor: 'epubcfi(/6/4!/4/2)' });
    expect(selectStrokes([pinned], LOOP)).toEqual([]);
  });

  it('selects nothing for a path too short to enclose anything', () => {
    const inside = stroke('in', [[0.2, 0.2]]);
    expect(
      selectStrokes([inside], [
        [0.1, 0.1],
        [0.4, 0.4],
      ]),
    ).toEqual([]);
  });

  it('works the same through a rectangle built from two corners', () => {
    const strokes = [stroke('in', [[0.2, 0.2]]), stroke('out', [[0.8, 0.8]])];
    const path = rectPath([0.1, 0.1], [0.4, 0.4]);
    expect(selectStrokes(strokes, path, { shape: 'rect' })).toEqual(['in']);
  });

  it('builds the same rectangle whichever corner is dragged from', () => {
    const strokes = [stroke('in', [[0.2, 0.2]])];
    for (const [from, to] of [
      [
        [0.1, 0.1],
        [0.4, 0.4],
      ],
      [
        [0.4, 0.4],
        [0.1, 0.1],
      ],
      [
        [0.4, 0.1],
        [0.1, 0.4],
      ],
    ] as [InkPoint, InkPoint][]) {
      expect(selectStrokes(strokes, rectPath(from, to), { shape: 'rect' })).toEqual(['in']);
    }
  });
});

describe('boundsOf', () => {
  it('wraps the ink, widened by half the stroke width so nothing pokes out', () => {
    const bounds = boundsOf([
      stroke('a', [
        [0.2, 0.3],
        [0.5, 0.6],
      ]),
    ]);
    expect(bounds).toEqual({ left: 0.197, top: 0.297, right: 0.503, bottom: 0.603 });
  });

  it('covers every stroke in the selection', () => {
    const bounds = boundsOf([
      stroke('a', [[0.2, 0.2]], { width: 0 }),
      stroke('b', [[0.6, 0.4]], { width: 0 }),
    ]);
    expect(bounds).toEqual({ left: 0.2, top: 0.2, right: 0.6, bottom: 0.4 });
  });

  it('has nothing to bound when the selection is empty', () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe('moveStrokes', () => {
  it('shifts every point and keeps pressure', () => {
    const [moved] = moveStrokes([stroke('a', [[0.2, 0.3, 0.5]])], 0.1, -0.1);
    expect(moved!.points).toEqual([[0.30000000000000004, 0.19999999999999998, 0.5]]);
  });

  it('leaves the originals untouched', () => {
    const original = stroke('a', [[0.2, 0.3]]);
    moveStrokes([original], 0.5, 0.5);
    expect(original.points).toEqual([[0.2, 0.3]]);
  });
});

describe('clampMove', () => {
  const bounds = { left: 0.2, top: 0.2, right: 0.4, bottom: 0.4 };

  it('passes a move that stays on the page straight through', () => {
    expect(clampMove(bounds, 0.1, 0.1)).toEqual([0.1, 0.1]);
  });

  it('stops at the edge rather than letting ink off the page', () => {
    expect(clampMove(bounds, 5, 5)).toEqual([0.6, 0.6]);
    expect(clampMove(bounds, -5, -5)).toEqual([-0.2, -0.2]);
  });

  it('clamps each axis on its own, so sliding along an edge still works', () => {
    expect(clampMove(bounds, -5, 0.1)).toEqual([-0.2, 0.1]);
  });
});

describe('scaleStrokes', () => {
  it('scales about the held corner, leaving it where it was', () => {
    const [scaled] = scaleStrokes(
      [
        stroke('a', [
          [0.2, 0.2],
          [0.4, 0.4],
        ]),
      ],
      [0.2, 0.2],
      0.5,
    );
    expect(scaled!.points[0]).toEqual([0.2, 0.2]);
    expect(scaled!.points[1]![0]).toBeCloseTo(0.3, 10);
    expect(scaled!.points[1]![1]).toBeCloseTo(0.3, 10);
  });

  it('scales the width with the ink, so a pen does not change thickness', () => {
    const [scaled] = scaleStrokes([stroke('a', [[0.4, 0.4]], { width: 0.01 })], [0, 0], 0.5);
    expect(scaled!.width).toBeCloseTo(0.005, 10);
  });

  it('will not shrink past the floor, where ink could not be recovered', () => {
    const [scaled] = scaleStrokes([stroke('a', [[1, 1]], { width: 0.01 })], [0, 0], 0);
    expect(scaled!.points[0]![0]).toBeCloseTo(MIN_SCALE, 10);
  });

  it('keeps pressure through a resize', () => {
    const [scaled] = scaleStrokes([stroke('a', [[0.4, 0.4, 0.7]])], [0, 0], 0.5);
    expect(scaled!.points[0]![2]).toBe(0.7);
  });
});

describe('maxScale', () => {
  const bounds = { left: 0.2, top: 0.2, right: 0.4, bottom: 0.4 };

  it('stops a selection growing off the page', () => {
    // Held at its top-left corner, the box's right edge sits 0.2 from that
    // corner and can travel to 0.8 from it, so it may grow fourfold.
    expect(maxScale(bounds, [0.2, 0.2])).toBeCloseTo(4, 10);
  });

  it('takes the tightest edge when the corners differ', () => {
    expect(maxScale({ left: 0.1, top: 0.4, right: 0.9, bottom: 0.5 }, [0.5, 0.45])).toBeCloseTo(
      1.25,
      10,
    );
  });

  it('never reports less than the floor, so a resize is always possible', () => {
    expect(maxScale({ left: 0, top: 0, right: 1, bottom: 1 }, [0.5, 0.5])).toBeGreaterThanOrEqual(
      MIN_SCALE,
    );
  });
});

describe('duplicateStrokes', () => {
  it('copies the ink with new ids, offset from the original', () => {
    const original = stroke('a', [[0.2, 0.2]]);
    const [copy] = duplicateStrokes([original]);
    expect(copy!.id).not.toBe('a');
    expect(copy!.points[0]![0]).toBeCloseTo(0.22, 10);
    expect(copy!.color).toBe(original.color);
  });

  it('gives every copy its own id', () => {
    const copies = duplicateStrokes([stroke('a', [[0.2, 0.2]]), stroke('b', [[0.3, 0.3]])]);
    expect(new Set(copies.map((c) => c.id)).size).toBe(2);
  });

  it('keeps a copy of ink in the corner on the page', () => {
    const [copy] = duplicateStrokes([stroke('a', [[0.999, 0.999]], { width: 0 })]);
    expect(copy!.points[0]![0]).toBeLessThanOrEqual(1);
    expect(copy!.points[0]![1]).toBeLessThanOrEqual(1);
  });
});

describe('strokesByIds', () => {
  it('returns the named strokes in page order', () => {
    const strokes = [
      stroke('a', [[0.1, 0.1]]),
      stroke('b', [[0.2, 0.2]]),
      stroke('c', [[0.3, 0.3]]),
    ];
    expect(strokesByIds(strokes, ['c', 'a']).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('skips an id whose stroke has gone', () => {
    expect(strokesByIds([stroke('a', [[0.1, 0.1]])], ['a', 'gone']).map((s) => s.id)).toEqual(['a']);
  });
});
