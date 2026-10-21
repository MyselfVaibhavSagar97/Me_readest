import type { QuickNote, QuickNotesData } from '@/types/notes';

/** The top level, which every note belongs to until it is filed somewhere. */
export const ROOT = '';

/** How notes can be ordered on the notes screen. */
export type NoteSort = 'updated' | 'created' | 'title';

export const folderOf = (note: QuickNote) => note.folder ?? ROOT;

export const joinPath = (parent: string, name: string) =>
  parent ? `${parent}/${name}` : name;

export const parentOf = (path: string) => {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? ROOT : path.slice(0, cut);
};

export const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** A folder name can't carry the separator, or it would invent a folder. */
export const sanitizeName = (name: string) => name.replace(/\//g, ' ').trim();

/** The folders from the root down to `path`, for a breadcrumb trail. */
export const breadcrumbs = (path: string): { name: string; path: string }[] => {
  if (!path) return [];
  const names = path.split('/');
  return names.map((name, index) => ({ name, path: names.slice(0, index + 1).join('/') }));
};

const isDescendant = (path: string, ancestor: string) =>
  ancestor === ROOT ? path !== ROOT : path === ancestor || path.startsWith(`${ancestor}/`);

/**
 * Every folder that exists, including the ones only a note implies.
 *
 * A note filed in a folder missing from the list would otherwise be
 * unreachable — invisible at the top level and in a folder nothing can
 * navigate to. Deriving the folders from the notes as well means ink can
 * never be stranded by a gap in the data.
 */
export const allFolders = (data: QuickNotesData): string[] => {
  const paths = new Set<string>(data.folders.filter(Boolean));
  for (const note of data.notes) {
    let path = folderOf(note);
    while (path) {
      paths.add(path);
      path = parentOf(path);
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
};

/** The folders directly inside `parent`, in name order. */
export const childFolders = (data: QuickNotesData, parent: string): string[] =>
  allFolders(data)
    .filter((path) => parentOf(path) === parent && path !== parent)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

export const notesIn = (notes: QuickNote[], folder: string): QuickNote[] =>
  notes.filter((note) => folderOf(note) === folder);

export const sortNotes = (notes: QuickNote[], sort: NoteSort): QuickNote[] =>
  [...notes].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'created') return b.createdAt - a.createdAt;
    return b.updatedAt - a.updatedAt;
  });

/** A name not already taken inside `parent`: "Folder", "Folder 2", … */
export const uniqueFolderName = (data: QuickNotesData, parent: string, base: string): string => {
  const taken = new Set(childFolders(data, parent).map(nameOf));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
};

export const addFolder = (data: QuickNotesData, path: string): QuickNotesData => ({
  ...data,
  folders: data.folders.includes(path) ? data.folders : [...data.folders, path],
});

/** Renames a folder, carrying everything inside it along. */
export const renameFolder = (
  data: QuickNotesData,
  from: string,
  to: string,
): QuickNotesData => {
  if (!from || from === to) return data;
  const moved = (path: string) =>
    path === from ? to : path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
  return {
    folders: [...new Set(allFolders(data).map(moved))],
    notes: data.notes.map((note) =>
      isDescendant(folderOf(note), from) ? { ...note, folder: moved(folderOf(note)) } : note,
    ),
  };
};

/** Deletes a folder, everything under it, and every note filed inside. */
export const deleteFolder = (data: QuickNotesData, path: string): QuickNotesData => {
  if (!path) return data;
  return {
    folders: allFolders(data).filter((folder) => !isDescendant(folder, path)),
    notes: data.notes.filter((note) => !isDescendant(folderOf(note), path)),
  };
};

/** How many notes a folder holds, counting the ones in folders inside it. */
export const countIn = (data: QuickNotesData, path: string): number =>
  data.notes.filter((note) => isDescendant(folderOf(note), path)).length;

export const moveNote = (data: QuickNotesData, id: string, folder: string): QuickNotesData => ({
  ...data,
  notes: data.notes.map((note) => (note.id === id ? { ...note, folder } : note)),
});

export const renameNote = (data: QuickNotesData, id: string, title: string): QuickNotesData => ({
  ...data,
  notes: data.notes.map((note) =>
    note.id === id ? { ...note, title, updatedAt: Date.now() } : note,
  ),
});

export const deleteNote = (data: QuickNotesData, id: string): QuickNotesData => ({
  ...data,
  notes: data.notes.filter((note) => note.id !== id),
});

/** Writes a note into the data, replacing the one with its id if present. */
export const upsertNote = (data: QuickNotesData, note: QuickNote): QuickNotesData => {
  const exists = data.notes.some((existing) => existing.id === note.id);
  return {
    ...data,
    notes: exists
      ? data.notes.map((existing) => (existing.id === note.id ? note : existing))
      : [...data.notes, note],
  };
};
