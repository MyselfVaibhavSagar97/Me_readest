import type { InkStroke } from '@/services/handwriting/model';

/**
 * Width ÷ height of a quick note's page. A4 portrait, the shape of paper,
 * which is exactly 1:√2 — that is what makes folding a sheet in half give
 * the next size down.
 */
export const QUICK_NOTE_ASPECT = 1 / Math.SQRT2;

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
  /**
   * Pictures on the page, under the ink. Absent on every note written before
   * a note could hold anything but strokes, which reads as a note with no
   * pictures — the same note it has always been.
   */
  images?: NoteImage[];
}

/**
 * A picture placed on a note's page.
 *
 * Only the file's name is kept here. The picture itself is a file of its own
 * beside the notes, because a photograph held inside the notes file would be
 * rewritten in full every time any note is saved, and a few of them would
 * make that file unreadable to anything but this app.
 *
 * The box is in page fractions, exactly as ink is, so a picture keeps its
 * place on the page whatever screen the note is opened on.
 */
export interface NoteImage {
  id: string;
  /** The file's name under the note-pictures directory. */
  file: string;
  left: number;
  top: number;
  width: number;
  height: number;
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
