import { describe, expect, it } from 'vitest';

import { HandwritingEditor } from '@/services/handwriting/editor';
import type { InkPoint, InkStroke } from '@/services/handwriting/model';
import { moveStrokes, strokesByIds } from '@/services/handwriting/selection';

const stroke = (id: string, points: InkPoint[], extra: Partial<InkStroke> = {}): InkStroke => ({
  id,
  color: '#1a1a1a',
  width: 0.006,
  points,
  ...extra,
});

const editor = () =>
  new HandwritingEditor({
    p: {
      strokes: [
        stroke('a', [
          [0.2, 0.2],
          [0.3, 0.3],
        ]),
        stroke('b', [
          [0.7, 0.7],
          [0.8, 0.8],
        ]),
      ],
      updatedAt: 0,
    },
  });

const xOf = (ed: HandwritingEditor, id: string) =>
  ed.strokes('p').find((s) => s.id === id)!.points[0]![0];

/**
 * Moving, resizing, deleting and copying a selection, as the lasso drives
 * them. The promise that matters most is the last one: a drag is hundreds of
 * updates and has to undo as a single step.
 */
describe('selection edits', () => {
  describe('replaceStrokes', () => {
    it('moves the selected strokes and leaves the rest where they are', () => {
      const ed = editor();
      const moved = moveStrokes(strokesByIds(ed.strokes('p'), ['a']), 0.1, 0);
      ed.replaceStrokes('p', moved);
      expect(xOf(ed, 'a')).toBeCloseTo(0.3, 10);
      expect(xOf(ed, 'b')).toBeCloseTo(0.7, 10);
    });

    it('keeps the drawing order, so moved ink does not jump in front', () => {
      const ed = editor();
      ed.replaceStrokes('p', moveStrokes(strokesByIds(ed.strokes('p'), ['a']), 0.1, 0));
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('ignores strokes that are no longer on the page', () => {
      const ed = editor();
      ed.replaceStrokes('p', [stroke('gone', [[0.5, 0.5]])]);
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('undoes a whole drag in one step, not one frame at a time', () => {
      const ed = editor();
      const original = strokesByIds(ed.strokes('p'), ['a']);
      // A drag: the same gesture, moving a little further each frame.
      for (let frame = 1; frame <= 20; frame++) {
        ed.replaceStrokes('p', moveStrokes(original, frame * 0.01, 0), 'drag-1');
      }
      expect(xOf(ed, 'a')).toBeCloseTo(0.4, 10);

      ed.undo('p');
      expect(xOf(ed, 'a')).toBeCloseTo(0.2, 10);
    });

    it('redoes that drag to where it ended up', () => {
      const ed = editor();
      const original = strokesByIds(ed.strokes('p'), ['a']);
      for (let frame = 1; frame <= 5; frame++) {
        ed.replaceStrokes('p', moveStrokes(original, frame * 0.02, 0), 'drag-1');
      }
      ed.undo('p');
      ed.redo('p');
      expect(xOf(ed, 'a')).toBeCloseTo(0.3, 10);
    });

    it('keeps two drags apart, so each undoes on its own', () => {
      const ed = editor();
      ed.replaceStrokes('p', moveStrokes(strokesByIds(ed.strokes('p'), ['a']), 0.1, 0), 'drag-1');
      ed.replaceStrokes('p', moveStrokes(strokesByIds(ed.strokes('p'), ['a']), 0.1, 0), 'drag-2');
      expect(xOf(ed, 'a')).toBeCloseTo(0.4, 10);

      ed.undo('p');
      expect(xOf(ed, 'a')).toBeCloseTo(0.3, 10);
      ed.undo('p');
      expect(xOf(ed, 'a')).toBeCloseTo(0.2, 10);
    });

    it('does not fold a stroke drawn after a drag into that drag', () => {
      const ed = editor();
      ed.replaceStrokes('p', moveStrokes(strokesByIds(ed.strokes('p'), ['a']), 0.1, 0), 'drag-1');
      ed.addStroke('p', stroke('c', [[0.5, 0.5]]));

      ed.undo('p');
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b']);
      expect(xOf(ed, 'a')).toBeCloseTo(0.3, 10);
    });

    it('does not fold a second drag into the first just because undo came between', () => {
      const ed = editor();
      const original = strokesByIds(ed.strokes('p'), ['a']);
      ed.replaceStrokes('p', moveStrokes(original, 0.1, 0), 'drag-1');
      ed.undo('p');
      ed.replaceStrokes('p', moveStrokes(original, 0.2, 0), 'drag-1');
      ed.undo('p');
      expect(xOf(ed, 'a')).toBeCloseTo(0.2, 10);
    });
  });

  describe('removeStrokes', () => {
    it('deletes the selection and nothing else', () => {
      const ed = editor();
      ed.removeStrokes('p', ['a']);
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['b']);
    });

    it('undoes as one step however many went', () => {
      const ed = editor();
      ed.removeStrokes('p', ['a', 'b']);
      expect(ed.strokes('p')).toHaveLength(0);
      ed.undo('p');
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('does nothing, and costs no undo step, when the ids are not there', () => {
      const ed = editor();
      ed.removeStrokes('p', ['gone']);
      ed.undo('p');
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b']);
    });
  });

  describe('addStrokes', () => {
    it('pastes copies in one undoable step', () => {
      const ed = editor();
      ed.addStrokes('p', [stroke('c', [[0.4, 0.4]]), stroke('d', [[0.5, 0.5]])]);
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
      ed.undo('p');
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('drops empty strokes rather than storing ink with no points', () => {
      const ed = editor();
      ed.addStrokes('p', [stroke('empty', [])]);
      expect(ed.strokes('p').map((s) => s.id)).toEqual(['a', 'b']);
    });
  });
});
