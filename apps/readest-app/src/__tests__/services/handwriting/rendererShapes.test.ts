import { describe, expect, it } from 'vitest';

import type { InkStroke } from '@/services/handwriting/model';
import { renderStrokes } from '@/services/handwriting/renderer';

/**
 * A canvas context that records what it was asked to draw, so the two things
 * shapes added to the renderer — exact corners, and a fill under the outline
 * — can be checked without a real canvas.
 */
const recorder = () => {
  const calls: string[] = [];
  const note =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(args.length ? `${name}(${args.length})` : name);
    };
  const ctx = {
    calls,
    canvas: undefined,
    lineCap: '',
    lineJoin: '',
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
    globalAlpha: 1,
    save: note('save'),
    restore: note('restore'),
    beginPath: note('beginPath'),
    closePath: note('closePath'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    quadraticCurveTo: note('quadraticCurveTo'),
    arc: note('arc'),
    stroke: note('stroke'),
    fill: note('fill'),
    clearRect: note('clearRect'),
    setTransform: note('setTransform'),
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
};

const RECT = { left: 0, top: 0, width: 400, height: 560 };

/** An even-width stroke: no pressure, and a nib that does not vary. */
const base = (over: Partial<InkStroke> = {}): InkStroke => ({
  id: 's1',
  color: '#1a1a1a',
  width: 0.004,
  nib: 'ballpoint',
  points: [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
    [0.2, 0.2],
  ],
  ...over,
});

const countOf = (ctx: { calls: string[] }, name: string) =>
  ctx.calls.filter((call) => call.startsWith(name)).length;

describe('renderer: shapes', () => {
  it('draws a sharp stroke corner for corner', () => {
    const ctx = recorder();
    renderStrokes(ctx, [base({ sharp: true })], RECT);
    expect(countOf(ctx, 'lineTo')).toBe(4);
    expect(countOf(ctx, 'quadraticCurveTo')).toBe(0);
  });

  it('still smooths a stroke that is not a shape — the reader draws these', () => {
    const ctx = recorder();
    renderStrokes(ctx, [base()], RECT);
    expect(countOf(ctx, 'quadraticCurveTo')).toBeGreaterThan(0);
  });

  it('fills a shape under its outline, so the outline is still its edge', () => {
    const ctx = recorder();
    renderStrokes(ctx, [base({ sharp: true, fill: '#ffcc00' })], RECT);
    const fillAt = ctx.calls.indexOf('fill');
    const strokeAt = ctx.calls.indexOf('stroke');
    expect(fillAt).toBeGreaterThan(-1);
    expect(strokeAt).toBeGreaterThan(fillAt);
  });

  it('leaves a stroke with no fill unfilled', () => {
    const ctx = recorder();
    renderStrokes(ctx, [base({ sharp: true })], RECT);
    expect(countOf(ctx, 'fill')).toBe(0);
  });

  it('draws ink that predates shapes exactly as it did before', () => {
    // Neither field set: the path a note or a book annotation already stored.
    const before = recorder();
    renderStrokes(before, [base()], RECT);
    const after = recorder();
    renderStrokes(after, [base({ sharp: undefined, fill: undefined })], RECT);
    expect(after.calls).toEqual(before.calls);
    expect(countOf(before, 'fill')).toBe(0);
  });

  it('does not reach for a fill on a stroke of changing width', () => {
    // A pressure-shaped stroke takes the traced-outline path, which fills by
    // nature; a shape never goes down it, and nothing there reads `fill`.
    const ctx = recorder();
    renderStrokes(
      ctx,
      [
        base({
          nib: 'fountain',
          sharp: undefined,
          points: [
            [0.2, 0.2, 0.3],
            [0.5, 0.5, 0.9],
            [0.8, 0.2, 0.3],
          ],
        }),
      ],
      RECT,
    );
    expect(countOf(ctx, 'quadraticCurveTo') + countOf(ctx, 'lineTo')).toBeGreaterThan(0);
  });
});

describe('renderer: a drawn shape is ordinary ink', () => {
  it('goes down the same path as handwriting, one path per stroke', () => {
    const ctx = recorder();
    renderStrokes(ctx, [base({ id: 'ink' }), base({ id: 'shape', sharp: true })], RECT);
    expect(countOf(ctx, 'beginPath')).toBe(2);
  });
});
