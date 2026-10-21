import { describe, expect, it } from 'vitest';

import type { FileSystem } from '@/types/system';
import {
  NOTE_IMAGES_DIR,
  deleteNoteImages,
  pruneNoteImages,
  saveNoteImage,
} from '@/services/notes/noteImageStore';

/** Just enough filesystem for the rules these cases are about. */
const fakeFs = (files: Record<string, ArrayBuffer> = {}) => {
  const store: Record<string, ArrayBuffer> = { ...files };
  const fs = {
    readFile: async (path: string) => {
      const found = store[path];
      if (!found) throw new Error(`ENOENT: ${path}`);
      return found;
    },
    writeFile: async (path: string, _base: string, content: ArrayBuffer) => {
      store[path] = content;
    },
    removeFile: async (path: string) => {
      if (!(path in store)) throw new Error(`ENOENT: ${path}`);
      delete store[path];
    },
    createDir: async () => {},
    readDir: async () =>
      Object.keys(store)
        .filter((path) => path.startsWith(`${NOTE_IMAGES_DIR}/`))
        .map((path) => ({ path, size: 1 })),
    getBlobURL: async (path: string) => `blob:${path}`,
  } as unknown as FileSystem;
  return { fs, store };
};

const stored = (file: string) => `${NOTE_IMAGES_DIR}/${file}`;

describe('saveNoteImage', () => {
  it('copies the picture in under a name built from its id and format', async () => {
    const { fs, store } = fakeFs({ '/dcim/holiday.JPG': new ArrayBuffer(8) });
    const file = await saveNoteImage(fs, '/dcim/holiday.JPG', 'i9');
    expect(file).toBe('i9.jpg');
    expect(store[stored('i9.jpg')]).toBeDefined();
  });

  it('leaves the original where it was, so the note does not depend on it', async () => {
    const { fs, store } = fakeFs({ '/dcim/holiday.jpg': new ArrayBuffer(8) });
    await saveNoteImage(fs, '/dcim/holiday.jpg', 'i9');
    expect(store['/dcim/holiday.jpg']).toBeDefined();
  });
});

describe('pruneNoteImages', () => {
  it('removes only the pictures no note points at any more', async () => {
    const { fs, store } = fakeFs({
      [stored('keep.png')]: new ArrayBuffer(1),
      [stored('orphan.png')]: new ArrayBuffer(1),
    });
    const removed = await pruneNoteImages(fs, [
      { images: [{ id: 'a', file: 'keep.png', left: 0, top: 0, width: 0.1, height: 0.1 }] },
    ]);
    expect(removed).toBe(1);
    expect(store[stored('keep.png')]).toBeDefined();
    expect(store[stored('orphan.png')]).toBeUndefined();
  });

  it('handles a note written before pictures, which has no list at all', async () => {
    const { fs } = fakeFs({ [stored('a.png')]: new ArrayBuffer(1) });
    await expect(pruneNoteImages(fs, [{}])).resolves.toBe(1);
  });

  it('does nothing when no picture has ever been saved', async () => {
    const fs = {
      readDir: async () => {
        throw new Error('no such directory');
      },
    } as unknown as FileSystem;
    await expect(pruneNoteImages(fs, [])).resolves.toBe(0);
  });
});

describe('deleteNoteImages', () => {
  it('removes the files behind a deleted note', async () => {
    const { fs, store } = fakeFs({ [stored('a.png')]: new ArrayBuffer(1) });
    await deleteNoteImages(fs, [
      { id: 'a', file: 'a.png', left: 0, top: 0, width: 0.1, height: 0.1 },
    ]);
    expect(store[stored('a.png')]).toBeUndefined();
  });

  it('does not throw when the file has already gone', async () => {
    const { fs } = fakeFs();
    await expect(
      deleteNoteImages(fs, [
        { id: 'a', file: 'missing.png', left: 0, top: 0, width: 0.1, height: 0.1 },
      ]),
    ).resolves.toBeUndefined();
  });

  it('is safe on a note that never had pictures', async () => {
    const { fs } = fakeFs();
    await expect(deleteNoteImages(fs, undefined)).resolves.toBeUndefined();
  });
});
