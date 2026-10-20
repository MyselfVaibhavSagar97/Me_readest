import type { InkPage, InkStroke } from '@/services/handwriting/model';
import type { PageRect } from '@/services/handwriting/coords';
import type { QuickNote } from '@/types/notes';

/**
 * A note is a stack of pages, and the ink engine already keys its strokes by
 * page, so a note's pages are just editor pages with a key of their own.
 * Strokes carry their page index on the note, exactly as a fixed-layout book's
 * ink carries the page it was drawn on.
 */
export const notePageKey = (index: number) => `p${index}`;

/** The page a stroke belongs to. Ink saved before notes had pages is page 0. */
const pageOf = (stroke: InkStroke) => stroke.page ?? 0;

/**
 * How many pages a note has: the count it recorded, but never fewer than its
 * ink needs, so a note can't lose a page that has writing on it.
 */
export const pageCountOf = (note: QuickNote): number => {
  const needed = note.ink.reduce((max, stroke) => Math.max(max, pageOf(stroke) + 1), 0);
  return Math.max(1, note.pages ?? 0, needed);
};

/** Distance from a point to a rect; zero when the point is inside it. */
const distanceTo = (rect: PageRect, x: number, y: number) =>
  Math.hypot(
    Math.max(rect.left - x, 0, x - (rect.left + rect.width)),
    Math.max(rect.top - y, 0, y - (rect.top + rect.height)),
  );

/**
 * Which page a stroke centred at (x, y) was drawn on: the page it is inside,
 * or failing that the nearest one. Nearest rather than strictly inside,
 * because a stroke may start or end in the gap between two pages, or run off
 * the edge of one — and ink that lands nowhere would simply be lost.
 *
 * Rects are in viewport coordinates and a missing one means the page is not
 * laid out (it can't be drawn on, so it can't win).
 */
export const nearestPageIndex = (
  rects: readonly (PageRect | null | undefined)[],
  x: number,
  y: number,
): number | null => {
  let best: number | null = null;
  let bestDistance = Infinity;
  rects.forEach((rect, index) => {
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const distance = distanceTo(rect, x, y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
};

/** A note's ink as editor pages, ready to hand to a HandwritingEditor. */
export const pagesFromNote = (note: QuickNote): Record<string, InkPage> => {
  const pages: Record<string, InkPage> = {};
  for (const stroke of note.ink) {
    const key = notePageKey(pageOf(stroke));
    const page = (pages[key] ??= { strokes: [], updatedAt: note.updatedAt });
    page.strokes.push(stroke);
  }
  return pages;
};

/**
 * The editor's ink as it is stored on the note: every stroke stamped with the
 * page it sits on, in page order.
 */
export const strokesForNote = (
  strokesOf: (key: string) => readonly InkStroke[],
  pageCount: number,
): InkStroke[] => {
  const out: InkStroke[] = [];
  for (let index = 0; index < pageCount; index++) {
    for (const stroke of strokesOf(notePageKey(index))) out.push({ ...stroke, page: index });
  }
  return out;
};
