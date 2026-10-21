import { describe, it, expect } from 'vitest';

import {
  allFolders,
  breadcrumbs,
  childFolders,
  countIn,
  deleteFolder,
  deleteNote,
  folderOf,
  joinPath,
  moveNote,
  nameOf,
  notesIn,
  parentOf,
  renameFolder,
  renameNote,
  sanitizeName,
  sortNotes,
  uniqueFolderName,
  upsertNote,
} from '@/services/notes/noteTree';
import type { QuickNote, QuickNotesData } from '@/types/notes';

const note = (id: string, overrides: Partial<QuickNote> = {}): QuickNote => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  ink: [],
  ...overrides,
});

const data = (overrides: Partial<QuickNotesData> = {}): QuickNotesData => ({
  notes: [],
  folders: [],
  ...overrides,
});

describe('note tree', () => {
  describe('paths', () => {
    it('joins, splits and names folder paths', () => {
      expect(joinPath('', 'Maths')).toBe('Maths');
      expect(joinPath('Maths', 'Algebra')).toBe('Maths/Algebra');
      expect(parentOf('Maths/Algebra')).toBe('Maths');
      expect(parentOf('Maths')).toBe('');
      expect(nameOf('Maths/Algebra')).toBe('Algebra');
    });

    it('refuses a separator in a name, which would invent a folder', () => {
      expect(sanitizeName('Maths/Algebra')).toBe('Maths Algebra');
      expect(sanitizeName('  Physics  ')).toBe('Physics');
    });

    it('builds a trail from the top down to a folder', () => {
      expect(breadcrumbs('Maths/Algebra')).toEqual([
        { name: 'Maths', path: 'Maths' },
        { name: 'Algebra', path: 'Maths/Algebra' },
      ]);
      expect(breadcrumbs('')).toEqual([]);
    });
  });

  describe('folders', () => {
    it('keeps an empty folder that was made but never filled', () => {
      expect(allFolders(data({ folders: ['Maths'] }))).toEqual(['Maths']);
    });

    it('rescues a note whose folder is missing from the list', () => {
      // Without this a note filed in a lost folder would be invisible: not at
      // the top level, and in a folder nothing could navigate to.
      const stranded = data({ notes: [note('a', { folder: 'Maths/Algebra' })] });

      expect(allFolders(stranded)).toEqual(['Maths', 'Maths/Algebra']);
      expect(childFolders(stranded, '')).toEqual(['Maths']);
      expect(notesIn(stranded.notes, 'Maths/Algebra')).toHaveLength(1);
    });

    it('lists only the folders directly inside one', () => {
      const tree = data({ folders: ['Maths', 'Maths/Algebra', 'Maths/Algebra/Linear', 'Physics'] });

      expect(childFolders(tree, '')).toEqual(['Maths', 'Physics']);
      expect(childFolders(tree, 'Maths')).toEqual(['Maths/Algebra']);
      expect(childFolders(tree, 'Maths/Algebra')).toEqual(['Maths/Algebra/Linear']);
    });

    it('counts notes anywhere inside a folder, not just directly in it', () => {
      const tree = data({
        folders: ['Maths', 'Maths/Algebra'],
        notes: [
          note('a', { folder: 'Maths' }),
          note('b', { folder: 'Maths/Algebra' }),
          note('c'),
        ],
      });

      expect(countIn(tree, 'Maths')).toBe(2);
      expect(countIn(tree, 'Maths/Algebra')).toBe(1);
    });

    it('finds a free name rather than colliding', () => {
      const tree = data({ folders: ['Folder', 'Folder 2'] });

      expect(uniqueFolderName(tree, '', 'Folder')).toBe('Folder 3');
      expect(uniqueFolderName(tree, '', 'Other')).toBe('Other');
    });
  });

  describe('renaming a folder', () => {
    it('carries its contents and the folders inside it along', () => {
      const tree = data({
        folders: ['Maths', 'Maths/Algebra'],
        notes: [note('a', { folder: 'Maths' }), note('b', { folder: 'Maths/Algebra' })],
      });

      const renamed = renameFolder(tree, 'Maths', 'Mathematics');

      expect(renamed.folders).toEqual(['Mathematics', 'Mathematics/Algebra']);
      expect(folderOf(renamed.notes[0]!)).toBe('Mathematics');
      expect(folderOf(renamed.notes[1]!)).toBe('Mathematics/Algebra');
    });

    it('leaves a folder whose name merely starts the same alone', () => {
      // 'Mathsy' starts with 'Maths' but is not inside it.
      const tree = data({ folders: ['Maths', 'Mathsy'] });

      expect(renameFolder(tree, 'Maths', 'M').folders.sort()).toEqual(['M', 'Mathsy']);
    });
  });

  describe('deleting a folder', () => {
    it('takes everything inside it, at any depth', () => {
      const tree = data({
        folders: ['Maths', 'Maths/Algebra', 'Physics'],
        notes: [
          note('a', { folder: 'Maths' }),
          note('b', { folder: 'Maths/Algebra' }),
          note('c', { folder: 'Physics' }),
        ],
      });

      const left = deleteFolder(tree, 'Maths');

      expect(left.folders).toEqual(['Physics']);
      expect(left.notes.map((n) => n.id)).toEqual(['c']);
    });

    it('will not delete the top level', () => {
      const tree = data({ notes: [note('a')] });

      expect(deleteFolder(tree, '')).toEqual(tree);
    });
  });

  describe('notes', () => {
    it('reads a note written before folders existed as being at the top', () => {
      const legacy = note('a');

      expect(folderOf(legacy)).toBe('');
      expect(notesIn([legacy], '')).toHaveLength(1);
    });

    it('moves, renames and deletes a note', () => {
      const tree = data({ notes: [note('a'), note('b')] });

      expect(folderOf(moveNote(tree, 'a', 'Maths').notes[0]!)).toBe('Maths');
      expect(renameNote(tree, 'a', 'Shopping').notes[0]!.title).toBe('Shopping');
      expect(deleteNote(tree, 'a').notes.map((n) => n.id)).toEqual(['b']);
    });

    it('replaces a note by id rather than adding a second copy', () => {
      const tree = data({ notes: [note('a', { title: 'old' })] });

      const saved = upsertNote(tree, note('a', { title: 'new' }));

      expect(saved.notes).toHaveLength(1);
      expect(saved.notes[0]!.title).toBe('new');
    });

    it('adds a note it has not seen before', () => {
      expect(upsertNote(data(), note('a')).notes).toHaveLength(1);
    });

    it('orders by last edited, first made, or name', () => {
      const notes = [
        note('a', { title: 'Beta', createdAt: 3, updatedAt: 1 }),
        note('b', { title: 'Alpha', createdAt: 1, updatedAt: 3 }),
      ];

      expect(sortNotes(notes, 'updated').map((n) => n.id)).toEqual(['b', 'a']);
      expect(sortNotes(notes, 'created').map((n) => n.id)).toEqual(['a', 'b']);
      expect(sortNotes(notes, 'title').map((n) => n.id)).toEqual(['b', 'a']);
    });

    it('does not reorder the list it was given', () => {
      const notes = [note('a', { updatedAt: 1 }), note('b', { updatedAt: 2 })];
      sortNotes(notes, 'updated');

      expect(notes.map((n) => n.id)).toEqual(['a', 'b']);
    });
  });
});
