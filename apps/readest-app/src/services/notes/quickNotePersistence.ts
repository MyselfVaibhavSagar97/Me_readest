import { safeLoadJSON, safeSaveJSON } from '@/services/persistence';
import type { FileSystem } from '@/types/system';
import type { QuickNotesData } from '@/types/notes';

const QUICK_NOTES_FILE = 'quicknotes.json';

const EMPTY: QuickNotesData = { notes: [], folders: [] };

/**
 * Reads the notes screen's contents. A file written before notes had folders
 * holds only `notes`, which reads as every note at the top level — and each
 * half is checked on its own, so a damaged folder list cannot take the notes
 * down with it.
 */
export async function loadQuickNotes(fs: FileSystem): Promise<QuickNotesData> {
  const data = await safeLoadJSON<Partial<QuickNotesData>>(
    fs,
    QUICK_NOTES_FILE,
    'Settings',
    EMPTY,
  );
  return {
    notes: Array.isArray(data.notes) ? data.notes : [],
    folders: Array.isArray(data.folders) ? data.folders.filter(Boolean) : [],
  };
}

export async function saveQuickNotes(fs: FileSystem, data: QuickNotesData): Promise<void> {
  await safeSaveJSON(fs, QUICK_NOTES_FILE, 'Settings', data);
}
