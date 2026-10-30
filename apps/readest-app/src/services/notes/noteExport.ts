import { renderStrokes } from '@/services/handwriting/renderer';
import type { InkStroke } from '@/services/handwriting/model';
import { QUICK_NOTE_ASPECT, type NoteImage } from '@/types/notes';
import { PAPER_COLOR } from './penSettings';

/**
 * Painting a note onto a canvas — for the cards on the notes screen, and for
 * exporting a note as a picture or a PDF.
 *
 * One function, so an exported note cannot come out looking different from
 * the note. Pictures sit under the ink here exactly as they do on the page.
 */

/** A picture, decoded and ready to draw. */
export interface DecodedImage {
  image: NoteImage;
  el: CanvasImageSource;
}

export interface PaintBox {
  width: number;
  height: number;
}

export const paintNote = (
  ctx: CanvasRenderingContext2D,
  strokes: InkStroke[],
  images: DecodedImage[],
  box: PaintBox,
  { paper = false }: { paper?: boolean } = {},
): void => {
  ctx.clearRect(0, 0, box.width, box.height);
  // An exported file carries its own paper; on screen the element behind the
  // canvas already provides it.
  if (paper) {
    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, box.width, box.height);
  }
  for (const { image, el } of images) {
    ctx.drawImage(
      el,
      image.left * box.width,
      image.top * box.height,
      image.width * box.width,
      image.height * box.height,
    );
  }
  renderStrokes(ctx, strokes, { left: 0, top: 0, width: box.width, height: box.height });
};

/**
 * How wide an exported note is drawn, in pixels: A4 at 200dpi.
 *
 * High enough that handwriting stays crisp when printed, low enough that a
 * page is a few hundred kilobytes rather than several megabytes — these are
 * shared and mailed, and a tablet has to hold the whole canvas in memory to
 * make one.
 */
export const EXPORT_WIDTH = 1654;

export const exportBox = (width = EXPORT_WIDTH): PaintBox => ({
  width,
  height: Math.round(width / QUICK_NOTE_ASPECT),
});

/** The file name a note is exported under, with its own title in it. */
export const exportFilename = (title: string, extension: string): string => {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `${cleaned || 'Note'}.${extension}`;
};
