import type { InkStroke } from '@/services/handwriting/model';

/** Width ÷ height of a quick note's page. A4 portrait, the shape of paper. */
export const QUICK_NOTE_ASPECT = 1 / 1.414;

/**
 * A standalone handwritten note: ink on its own blank page, with no book
 * behind it. Strokes are normalized to the page (0..1 on both axes) and the
 * page keeps `QUICK_NOTE_ASPECT` wherever it is drawn, so a note written on a
 * tablet reads the same on a phone instead of being stretched to each screen.
 */
export interface QuickNote {
  id: string;
  /** Shown in the notes list; the note's creation date until renamed. */
  title: string;
  createdAt: number;
  updatedAt: number;
  ink: InkStroke[];
}
