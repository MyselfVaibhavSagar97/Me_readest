import { describe, it, expect } from 'vitest';

import { erasedRuns, splitStroke } from '@/services/handwriting/pointEraser';
import type { InkPoint, InkStroke } from '@/services/handwriting/model';

/** A horizontal line from x=0 to x=1 at y=0.5, as two stored points. */
const line = (): InkPoint[] => [
  [0, 0.5],
  [1, 0.5],
];

const stroke = (points: InkPoint[]): InkStroke => ({
  id: 'a',
  color: '#1a1a1a',
  width: 0.006,
  points,
});

const spans = (runs: InkPoint[][]) =>
  runs.map((run) => [run[0]![0], run[run.length - 1]![0]].map((x) => Number(x.toFixed(2))));

describe('erasing by area', () => {
  it('cuts a line in two where the eraser crosses its middle', () => {
    // The behaviour the whole feature is for: rubbing through a line leaves
    // the two ends behind instead of deleting the line.
    const runs = erasedRuns(line(), [[0.5, 0.5]], 0.05);

    expect(runs).toHaveLength(2);
    // Where exactly the cut falls depends on the walking step, so the gap is
    // asserted as a gap around the eraser rather than to the last decimal.
    const [before, after] = spans(runs) as [number[], number[]];
    expect(before[0]).toBe(0);
    expect(before[1]!).toBeLessThan(0.46);
    expect(after[0]!).toBeGreaterThan(0.54);
    expect(after[1]).toBe(1);
  });

  it('cuts a long straight run even though it is stored as two points', () => {
    // A simplified stroke holds no sample between its ends. Testing only the
    // stored points would let the eraser pass straight through the middle
    // and take nothing, which is how a point eraser usually goes wrong.
    const runs = erasedRuns(line(), [[0.5, 0.5]], 0.02);

    expect(runs).toHaveLength(2);
  });

  it('shortens a line rubbed at one end rather than splitting it', () => {
    const runs = erasedRuns(line(), [[0, 0.5]], 0.1);

    expect(runs).toHaveLength(1);
    expect(runs[0]![0]![0]).toBeGreaterThan(0.09);
    expect(runs[0]![runs[0]!.length - 1]![0]).toBeCloseTo(1, 2);
  });

  it('takes the whole line when the eraser is dragged along it', () => {
    const path: InkPoint[] = [
      [0, 0.5],
      [1, 0.5],
    ];

    expect(erasedRuns(line(), path, 0.05)).toEqual([]);
  });

  it('leaves a line the eraser misses completely alone', () => {
    const runs = erasedRuns(line(), [[0.5, 0.9]], 0.05);

    expect(runs).toHaveLength(1);
    expect(spans(runs)).toEqual([[0, 1]]);
  });

  it('cuts twice when the eraser crosses a line in two places', () => {
    const runs = erasedRuns(line(), [[0.3, 0.5]], 0.04).flatMap((run) =>
      erasedRuns(run, [[0.7, 0.5]], 0.04),
    );

    expect(runs).toHaveLength(3);
  });

  it('erases a dot only when the eraser covers it', () => {
    const dot: InkPoint[] = [[0.5, 0.5]];

    expect(erasedRuns(dot, [[0.5, 0.5]], 0.02)).toEqual([]);
    expect(erasedRuns(dot, [[0.9, 0.9]], 0.02)).toEqual([dot]);
  });

  it('drops a sliver too small to be ink the user meant to keep', () => {
    // An eraser covering all but the very end leaves at most one sample,
    // which would read as a speck of dirt.
    const runs = erasedRuns(line(), [[0.49, 0.5]], 0.49);

    for (const run of runs) expect(run.length).toBeGreaterThan(1);
  });

  it('carries pressure through the cut, interpolated where it is split', () => {
    const pressured: InkPoint[] = [
      [0, 0.5, 0.2],
      [1, 0.5, 1],
    ];

    const runs = erasedRuns(pressured, [[0.5, 0.5]], 0.05);

    for (const run of runs) {
      for (const point of run) {
        expect(point).toHaveLength(3);
        expect(point[2]!).toBeGreaterThanOrEqual(0.2);
        expect(point[2]!).toBeLessThanOrEqual(1);
      }
    }
    // The piece after the gap starts firmer than the piece before it ends.
    expect(runs[1]![0]![2]!).toBeGreaterThan(runs[0]![runs[0]!.length - 1]![2]!);
  });

  it('keeps a stroke with no pressure free of it', () => {
    for (const run of erasedRuns(line(), [[0.5, 0.5]], 0.05)) {
      for (const point of run) expect(point).toHaveLength(2);
    }
  });

  it('does nothing when the eraser path is empty', () => {
    expect(erasedRuns(line(), [], 0.05)).toEqual([]);
  });
});

describe('splitStroke', () => {
  it('gives each surviving piece the pen it was drawn with and its own id', () => {
    const original: InkStroke = {
      ...stroke(line()),
      color: '#c62828',
      nib: 'calligraphy',
      sensitivity: 0.4,
    };

    const pieces = splitStroke(original, [[0.5, 0.5]], 0.05);

    expect(pieces).toHaveLength(2);
    for (const piece of pieces) {
      expect(piece.color).toBe('#c62828');
      expect(piece.nib).toBe('calligraphy');
      expect(piece.sensitivity).toBe(0.4);
      expect(piece.width).toBe(original.width);
    }
    expect(pieces[0]!.id).not.toBe(pieces[1]!.id);
    expect(pieces[0]!.id).not.toBe(original.id);
  });

  it('simplifies the pieces, so rubbing a line does not bloat the note', () => {
    // Walking the stroke produces far more samples than its shape needs; a
    // straight piece should come back as about its endpoints, not hundreds.
    const pieces = splitStroke(stroke(line()), [[0.5, 0.5]], 0.05);

    for (const piece of pieces) expect(piece.points.length).toBeLessThan(5);
  });

  it('returns nothing when the eraser took all of it', () => {
    expect(
      splitStroke(stroke(line()), [
        [0, 0.5],
        [1, 0.5],
      ], 0.05),
    ).toEqual([]);
  });
});
