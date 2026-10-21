import type { BaseDir, FileSystem } from '@/types/system';
import type { NoteImage } from '@/types/notes';
import { extensionOf } from './noteImages';

/**
 * Where a note's pictures live on disk.
 *
 * The pictures sit beside the notes file rather than inside it. A photograph
 * written into `quicknotes.json` would be rewritten in full every time any
 * note was saved, and a handful of them would turn a readable file into
 * megabytes of encoded bytes. The note keeps a file name; the bytes stay a
 * file.
 */

/** The same place the notes file lives, so notes and pictures travel together. */
const BASE: BaseDir = 'Settings';

export const NOTE_IMAGES_DIR = 'quicknote-images';

const pathOf = (file: string) => `${NOTE_IMAGES_DIR}/${file}`;

/**
 * Copies a chosen picture in beside the notes and returns the name it was
 * stored under. The original is left where it was — a picture inserted into
 * a note must not depend on a file the person may later move or delete.
 */
export const saveNoteImage = async (
  fs: FileSystem,
  sourcePath: string,
  id: string,
): Promise<string> => {
  const file = `${id}.${extensionOf(sourcePath)}`;
  // `None` means the path is already absolute, as the file picker returns it.
  const bytes = (await fs.readFile(sourcePath, 'None', 'binary')) as ArrayBuffer;
  try {
    await fs.createDir(NOTE_IMAGES_DIR, BASE, true);
  } catch {
    // Already there, which is the usual case after the first picture.
  }
  await fs.writeFile(pathOf(file), BASE, bytes);
  return file;
};

/**
 * A URL the page can show the picture at.
 *
 * A blob URL rather than a file one: on Android a file outside the webview's
 * granted scopes will not load, and this reads the bytes we already own
 * instead of asking for permission to a path. The caller revokes it when the
 * picture leaves the screen.
 */
export const noteImageURL = (fs: FileSystem, file: string): Promise<string> =>
  fs.getBlobURL(pathOf(file), BASE);

/**
 * Removes a stored picture. A missing file is not an error: a note whose
 * picture has already gone should still be able to drop its reference to it.
 */
export const deleteNoteImage = async (fs: FileSystem, file: string): Promise<void> => {
  try {
    await fs.removeFile(pathOf(file), BASE);
  } catch {
    // Already gone.
  }
};

/** Removes the files behind these pictures — a note being deleted, say. */
export const deleteNoteImages = async (
  fs: FileSystem,
  images: readonly NoteImage[] | undefined,
): Promise<void> => {
  for (const image of images ?? []) {
    await deleteNoteImage(fs, image.file);
  }
};

/**
 * Deletes every stored picture that no note refers to any more.
 *
 * Pictures are removed from a note in the editor, and a note can be deleted
 * from the notes screen; either way the file is only known to be unused once
 * the notes are saved. Sweeping afterwards keeps that simple, and means a
 * save interrupted half way cannot take a picture a note still points at.
 */
export const pruneNoteImages = async (
  fs: FileSystem,
  notes: readonly { images?: NoteImage[] }[],
): Promise<number> => {
  let removed = 0;
  const kept = new Set<string>();
  for (const note of notes) {
    for (const image of note.images ?? []) kept.add(image.file);
  }
  let stored: { path: string }[];
  try {
    stored = await fs.readDir(NOTE_IMAGES_DIR, BASE);
  } catch {
    // No pictures have ever been saved, so there is nothing to sweep.
    return 0;
  }
  for (const item of stored) {
    // `readDir` reports a path; the note refers to the file's name alone.
    const file = item.path.split(/[\\/]/).pop() ?? '';
    if (!file || kept.has(file)) continue;
    await deleteNoteImage(fs, file);
    removed += 1;
  }
  return removed;
};
