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
  /**
   * How many pages the note has. Absent on notes written before notes had
   * more than one, which read as a single page; a page is kept even when it
   * is blank, so adding one and writing on the next still leaves it there.
   */
  pages?: number;
  /** Every stroke in the note; `page` says which page it sits on. */
  ink: InkStroke[];
}
