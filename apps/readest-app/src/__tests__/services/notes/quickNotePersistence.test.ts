import { describe, it, expect } from 'vitest';

import { loadQuickNotes, saveQuickNotes } from '@/services/notes/quickNotePersistence';
import type { FileSystem } from '@/types/system';
import type { QuickNote } from '@/types/notes';

/** Just enough of the FileSystem for safeLoadJSON / safeSaveJSON. */
const fakeFs = (files: Record<string, string> = {}) => {
  const store = { ...files };
  const fs = {
    readFile: async (path: string) => {
      if (!(path in store)) throw new Error(`ENOENT: ${path}`);
      return store[path]!;
    },
    writeFile: async (path: string, _base: string, content: string) => {
      store[path] = content;
    },
  } as unknown as FileSystem;
  return { fs, store };
};

const note = (overrides: Partial<QuickNote> = {}): QuickNote => ({
  id: 'n1',
  title: 'A note',
  createdAt: 1,
  updatedAt: 2,
  ink: [{ id: 's1', color: '#1a1a1a', width: 0.006, points: [[0.1, 0.2, 0.5]] }],
  ...overrides,
});

describe('quick note persistence', () => {
  it('reads back the notes it saved, ink and all', async () => {
    const { fs } = fakeFs();
    await saveQuickNotes(fs, [note()]);

    expect(await loadQuickNotes(fs)).toEqual([note()]);
  });

  it('starts empty rather than throwing when nothing has been saved yet', async () => {
    const { fs } = fakeFs();

    expect(await loadQuickNotes(fs)).toEqual([]);
  });

  it('falls back to the backup copy when the main file is corrupt', async () => {
    // safeSaveJSON writes the .bak first, so a write cut off halfway leaves a
    // good backup and a broken main file.
    const { fs } = fakeFs({
      'quicknotes.json': '{ this is not json',
      'quicknotes.json.bak': JSON.stringify({ notes: [note()] }),
    });

    expect(await loadQuickNotes(fs)).toEqual([note()]);
  });

  it('ignores a file whose notes are not a list, instead of handing one back', async () => {
    const { fs } = fakeFs({ 'quicknotes.json': JSON.stringify({ notes: 'nonsense' }) });

    expect(await loadQuickNotes(fs)).toEqual([]);
  });
});
