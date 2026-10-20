import { safeLoadJSON, safeSaveJSON } from '@/services/persistence';
import type { FileSystem } from '@/types/system';
import type { QuickNote } from '@/types/notes';

const QUICK_NOTES_FILE = 'quicknotes.json';

export async function loadQuickNotes(fs: FileSystem): Promise<QuickNote[]> {
  const data = await safeLoadJSON<{ notes: QuickNote[] }>(fs, QUICK_NOTES_FILE, 'Settings', {
    notes: [],
  });
  return Array.isArray(data.notes) ? data.notes : [];
}

export async function saveQuickNotes(fs: FileSystem, notes: QuickNote[]): Promise<void> {
  await safeSaveJSON(fs, QUICK_NOTES_FILE, 'Settings', { notes });
}
