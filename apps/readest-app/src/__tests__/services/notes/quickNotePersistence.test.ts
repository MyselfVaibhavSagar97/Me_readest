import { describe, it, expect } from 'vitest';

import { loadQuickNotes, saveQuickNotes } from '@/services/notes/quickNotePersistence';
import type { FileSystem } from '@/types/system';
import type { QuickNote, QuickNotesData } from '@/types/notes';

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

const data = (overrides: Partial<QuickNotesData> = {}): QuickNotesData => ({
  notes: [note()],
  folders: ['Maths'],
  ...overrides,
});

describe('quick note persistence', () => {
  it('reads back the notes and folders it saved, ink and all', async () => {
    const { fs } = fakeFs();
    await saveQuickNotes(fs, data());

    expect(await loadQuickNotes(fs)).toEqual(data());
  });

  it('starts empty rather than throwing when nothing has been saved yet', async () => {
    const { fs } = fakeFs();

    expect(await loadQuickNotes(fs)).toEqual({ notes: [], folders: [] });
  });

  it('reads a file written before notes had folders', async () => {
    // The shape the first version of the feature saved: notes and nothing
    // else. Those notes must still be there, at the top level.
    const { fs } = fakeFs({
      'quicknotes.json': JSON.stringify({ notes: [note()] }),
    });

    expect(await loadQuickNotes(fs)).toEqual({ notes: [note()], folders: [] });
  });

  it('falls back to the backup copy when the main file is corrupt', async () => {
    // safeSaveJSON writes the .bak first, so a write cut off halfway leaves a
    // good backup and a broken main file.
    const { fs } = fakeFs({
      'quicknotes.json': '{ this is not json',
      'quicknotes.json.bak': JSON.stringify(data()),
    });

    expect(await loadQuickNotes(fs)).toEqual(data());
  });

  it('keeps the notes when the folder list is damaged, and the reverse', async () => {
    // The two halves are checked separately, so nonsense in one cannot take
    // the other down with it.
    const { fs: badFolders } = fakeFs({
      'quicknotes.json': JSON.stringify({ notes: [note()], folders: 'nonsense' }),
    });
    const { fs: badNotes } = fakeFs({
      'quicknotes.json': JSON.stringify({ notes: 'nonsense', folders: ['Maths'] }),
    });

    expect(await loadQuickNotes(badFolders)).toEqual({ notes: [note()], folders: [] });
    expect(await loadQuickNotes(badNotes)).toEqual({ notes: [], folders: ['Maths'] });
  });

  it('drops an empty folder path, which would mean the top level', async () => {
    const { fs } = fakeFs({
      'quicknotes.json': JSON.stringify({ notes: [], folders: ['', 'Maths'] }),
    });

    expect((await loadQuickNotes(fs)).folders).toEqual(['Maths']);
  });
});
