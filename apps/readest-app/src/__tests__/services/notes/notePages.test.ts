import { describe, it, expect } from 'vitest';

import {
  nearestPageIndex,
  notePageKey,
  pageCountOf,
  pagesFromNote,
  strokesForNote,
} from '@/services/notes/notePages';
import type { PageRect } from '@/services/handwriting/coords';
import type { InkStroke } from '@/services/handwriting/model';
import type { QuickNote } from '@/types/notes';

const stroke = (id: string, page?: number): InkStroke => ({
  id,
  color: '#1a1a1a',
  width: 0.006,
  ...(page === undefined ? {} : { page }),
  points: [[0.1, 0.2]],
});

const note = (overrides: Partial<QuickNote> = {}): QuickNote => ({
  id: 'n1',
  title: 'A note',
  createdAt: 1,
  updatedAt: 2,
  ink: [],
  ...overrides,
});

/** Stands in for a HandwritingEditor's strokes(key) lookup. */
const strokesOf = (pages: Record<string, InkStroke[]>) => (key: string) => pages[key] ?? [];

describe('note pages', () => {
  describe('pageCountOf', () => {
    it('gives an empty note a single page', () => {
      expect(pageCountOf(note())).toBe(1);
    });

    it('reads a note written before notes had pages as one page', () => {
      // No `pages`, and ink with no page index: the shape saved by the first
      // version of the feature. It must not come back blank.
      expect(pageCountOf(note({ ink: [stroke('a'), stroke('b')] }))).toBe(1);
    });

    it('keeps a blank page the note recorded', () => {
      expect(pageCountOf(note({ pages: 3 }))).toBe(3);
    });

    it('never reports fewer pages than the ink needs', () => {
      // A count that disagrees with the ink would hide a page of writing.
      expect(pageCountOf(note({ pages: 1, ink: [stroke('a', 2)] }))).toBe(3);
    });
  });

  describe('pagesFromNote', () => {
    it('groups ink by the page it was drawn on', () => {
      const pages = pagesFromNote(note({ ink: [stroke('a', 0), stroke('b', 2), stroke('c', 0)] }));

      expect(Object.keys(pages).sort()).toEqual(['p0', 'p2']);
      expect(pages['p0']!.strokes.map((s) => s.id)).toEqual(['a', 'c']);
      expect(pages['p2']!.strokes.map((s) => s.id)).toEqual(['b']);
    });

    it('puts ink with no page on the first page', () => {
      const pages = pagesFromNote(note({ ink: [stroke('a')] }));

      expect(Object.keys(pages)).toEqual(['p0']);
      expect(pages['p0']!.strokes.map((s) => s.id)).toEqual(['a']);
    });
  });

  describe('strokesForNote', () => {
    it('stamps every stroke with its page, in page order', () => {
      const result = strokesForNote(
        strokesOf({ p0: [stroke('a')], p1: [stroke('b')] }),
        2,
      );

      expect(result.map((s) => [s.id, s.page])).toEqual([
        ['a', 0],
        ['b', 1],
      ]);
    });

    it('survives a round trip through the editor shape', () => {
      const original = note({ pages: 3, ink: [stroke('a', 0), stroke('b', 2)] });
      const pages = pagesFromNote(original);
      const back = strokesForNote(
        (key) => pages[key]?.strokes ?? [],
        pageCountOf(original),
      );

      expect(back.map((s) => [s.id, s.page])).toEqual([
        ['a', 0],
        ['b', 2],
      ]);
    });

    it('gives a legacy note an explicit page 0 without moving its ink', () => {
      const legacy = note({ ink: [stroke('a')] });
      const pages = pagesFromNote(legacy);
      const back = strokesForNote((key) => pages[key]?.strokes ?? [], pageCountOf(legacy));

      expect(back).toEqual([{ ...stroke('a'), page: 0 }]);
    });
  });

  describe('nearestPageIndex', () => {
    // Two A4-ish pages stacked with a gap, as they sit on screen.
    const page = (top: number): PageRect => ({ left: 100, top, width: 400, height: 560 });
    const stacked = [page(0), page(576)];

    it('puts a stroke on the page it was drawn inside', () => {
      expect(nearestPageIndex(stacked, 300, 100)).toBe(0);
      expect(nearestPageIndex(stacked, 300, 700)).toBe(1);
    });

    it('puts a stroke that landed in the gap on the page it is closer to', () => {
      // The gap runs from 560 to 576; 563 is nearer the page above.
      expect(nearestPageIndex(stacked, 300, 563)).toBe(0);
      expect(nearestPageIndex(stacked, 300, 574)).toBe(1);
    });

    it('keeps ink that ran off the side rather than dropping it', () => {
      expect(nearestPageIndex(stacked, 20, 100)).toBe(0);
      expect(nearestPageIndex(stacked, 900, 700)).toBe(1);
    });

    it('ignores a page that is not laid out', () => {
      // A page with no element, or a zero-sized one, cannot be drawn on.
      expect(nearestPageIndex([null, page(0)], 300, 100)).toBe(1);
      expect(nearestPageIndex([{ left: 0, top: 0, width: 0, height: 0 }, page(0)], 300, 100)).toBe(
        1,
      );
    });

    it('reports nothing when there is no page to draw on', () => {
      expect(nearestPageIndex([], 10, 10)).toBeNull();
      expect(nearestPageIndex([null, undefined], 10, 10)).toBeNull();
    });
  });

  it('keys pages so they sort and read predictably', () => {
    expect(notePageKey(0)).toBe('p0');
    expect(notePageKey(7)).toBe('p7');
  });
});
