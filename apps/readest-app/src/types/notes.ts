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
   * The folder the note lives in: names joined with '/', empty for the top
   * level. Absent on notes written before notes had folders, which read as
   * being at the top level.
   */
  folder?: string;
  ink: InkStroke[];
}

/**
 * Everything the notes screen keeps. Folders are listed in their own right
 * so an empty one survives being made, rather than existing only as long as
 * something is filed in it.
 */
export interface QuickNotesData {
  notes: QuickNote[];
  folders: string[];
}
