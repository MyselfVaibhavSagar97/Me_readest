import { QUICK_NOTE_ASPECT, type NoteImage } from '@/types/notes';

/**
 * Where a picture sits on a note's page, and what moving or resizing does to
 * it. Arithmetic only, so the rules can be checked on their own.
 *
 * A picture's box is stored in page fractions, like ink, which means its
 * shape on screen is not its shape in the numbers: a box that is 0.5 wide and
 * 0.5 high covers half the page each way, and the page is taller than it is
 * wide. Every function here works in that space and converts at the edges, so
 * a photograph is never quietly stretched.
 */

/** The picture formats the gallery picker offers. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'heif'];

/** A picture starts at this much of the page's width, if it fits. */
const INITIAL_WIDTH = 0.6;

/** Neither side may be smaller than this, or a picture becomes unfindable. */
export const MIN_IMAGE_SIZE = 0.05;

/**
 * The height, in page fractions, that shows a picture of this natural shape
 * at the given width without stretching it.
 *
 * The page is taller than it is wide, so a square picture needs a smaller
 * height fraction than width fraction — `QUICK_NOTE_ASPECT` is exactly that
 * difference.
 */
export const heightFor = (width: number, naturalWidth: number, naturalHeight: number): number => {
  if (naturalWidth <= 0 || naturalHeight <= 0) return width * QUICK_NOTE_ASPECT;
  return (width * QUICK_NOTE_ASPECT * naturalHeight) / naturalWidth;
};

/**
 * Where a newly chosen picture lands: as wide as it may be without covering
 * the whole page, in the middle of it, and never taller than the page — a
 * portrait photograph is sized to fit top to bottom instead.
 */
export const placeImage = (
  naturalWidth: number,
  naturalHeight: number,
  maxWidth = INITIAL_WIDTH,
): { left: number; top: number; width: number; height: number } => {
  let width = maxWidth;
  let height = heightFor(width, naturalWidth, naturalHeight);
  if (height > maxWidth) {
    // Taller than the space allowed: fit the height and take the width back.
    width = (width * maxWidth) / height;
    height = heightFor(width, naturalWidth, naturalHeight);
  }
  return { left: (1 - width) / 2, top: (1 - height) / 2, width, height };
};

/** The picture's box as the selection box understands it. */
export const boundsOfImage = (image: NoteImage) => ({
  left: image.left,
  top: image.top,
  right: image.left + image.width,
  bottom: image.top + image.height,
});

/**
 * The picture moved by `dx`, `dy`, stopped at the edge of the page rather
 * than refused, so dragging into a corner settles against it.
 */
export const moveImage = (image: NoteImage, dx: number, dy: number): NoteImage => ({
  ...image,
  left: Math.min(1 - image.width, Math.max(0, image.left + dx)),
  top: Math.min(1 - image.height, Math.max(0, image.top + dy)),
});

/**
 * The picture resized to `factor` of the given box, held by its top-left
 * corner. Both sides scale together — a photograph stretched on one axis
 * reads as a mistake, not a choice — and it stops at the page's edge and at
 * the smallest size that is still a picture.
 */
export const scaleImage = (
  image: NoteImage,
  from: { left: number; top: number; width: number; height: number },
  factor: number,
): NoteImage => {
  const capped = Math.min(
    Math.max(factor, MIN_IMAGE_SIZE / Math.max(from.width, from.height)),
    Math.min((1 - from.left) / from.width, (1 - from.top) / from.height),
  );
  return {
    ...image,
    left: from.left,
    top: from.top,
    width: from.width * capped,
    height: from.height * capped,
  };
};

/** The file extension of a chosen picture, lowercased, without the dot. */
export const extensionOf = (path: string): string => {
  const name = path.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return IMAGE_EXTENSIONS.includes(ext) ? ext : 'png';
};

let imageCounter = 0;

/** An id for a new picture, unique within a session however fast they arrive. */
export const nextImageId = (): string =>
  `i${Date.now().toString(36)}${(imageCounter++).toString(36)}`;

/** The pictures on a note, as a list that is safe to read on any note. */
export const imagesOf = (images: NoteImage[] | undefined): NoteImage[] => images ?? [];
