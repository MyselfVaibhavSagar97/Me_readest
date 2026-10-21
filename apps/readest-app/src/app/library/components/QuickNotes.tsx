import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RiFileList3Line } from 'react-icons/ri';

import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import { uniqueId } from '@/utils/misc';
import {
  ROOT,
  addFolder,
  deleteFolder,
  deleteNote,
  joinPath,
  moveNote,
  parentOf,
  renameFolder,
  renameNote,
  uniqueFolderName,
  upsertNote,
} from '@/services/notes/noteTree';
import type { QuickNote, QuickNotesData } from '@/types/notes';
import NotesHome from './NotesHome';
import QuickNoteEditor from './QuickNoteEditor';

const EMPTY: QuickNotesData = { notes: [], folders: [] };

/**
 * Handwritten notes on the library screen: a Notes button in the bottom
 * corner opens the notes screen, where notes are kept in folders and shown
 * as their own ink. Notes are standalone — they belong to no book — and are
 * stored in their own file, like the RSS feeds are.
 */
const QuickNotes: React.FC = () => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { safeAreaInsets } = useThemeStore();
  const [data, setData] = useState<QuickNotesData>(EMPTY);
  const [homeOpen, setHomeOpen] = useState(false);
  const [folder, setFolder] = useState(ROOT);
  const [editing, setEditing] = useState<QuickNote | null>(null);
  /**
   * The load, kept so a save that happens before it finishes still merges
   * into what was on disk instead of overwriting it.
   */
  const loadRef = useRef<Promise<QuickNotesData> | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (!appService) return EMPTY;
    loadRef.current ??= appService.loadQuickNotes();
    return loadRef.current;
  }, [appService]);

  useEffect(() => {
    let active = true;
    void ensureLoaded().then((loaded) => {
      if (active) setData(loaded);
      // Sweep up picture files no note points at any more — one taken off a
      // page, or left behind by a deleted note. Done on the way in rather
      // than on the way out, so a save that never finished cannot have left
      // a note pointing at a picture that was already deleted.
      if (appService) void appService.pruneNoteImages(loaded.notes);
    });
    return () => {
      active = false;
    };
  }, [appService, ensureLoaded]);

  const persist = useCallback(
    async (update: (previous: QuickNotesData) => QuickNotesData) => {
      const next = update(await ensureLoaded());
      loadRef.current = Promise.resolve(next);
      setData(next);
      await appService?.saveQuickNotes(next);
    },
    [appService, ensureLoaded],
  );

  const handleNewNote = useCallback(() => {
    const now = Date.now();
    setEditing({
      id: uniqueId(),
      title: new Date(now).toLocaleString(),
      createdAt: now,
      updatedAt: now,
      folder,
      ink: [],
    });
  }, [folder]);

  const handlePersistNote = useCallback(
    (note: QuickNote) => {
      // An untouched new note is not worth keeping, and storing it would
      // leave a blank card on the notes screen. A note holding only a
      // picture has something on it, so it counts.
      if (note.ink.length === 0 && (note.images?.length ?? 0) === 0) return;
      void persist((previous) => upsertNote(previous, note));
    },
    [persist],
  );

  const handleDeleteFolder = useCallback(
    (path: string) => {
      // Standing inside a folder that is being deleted, step up to its parent.
      if (folder === path || folder.startsWith(`${path}/`)) setFolder(parentOf(path));
      void persist((previous) => deleteFolder(previous, path));
    },
    [folder, persist],
  );

  if (!appService) return null;

  return (
    <>
      <div
        className='fixed bottom-0 end-0 z-40 flex flex-col items-center pe-4'
        style={{ paddingBottom: `${(safeAreaInsets?.bottom ?? 0) / 4 + 16}px` }}
      >
        <button
          type='button'
          aria-label={_('Notes')}
          title={_('Notes')}
          onClick={() => setHomeOpen(true)}
          className={clsx(
            'btn btn-contrast btn-circle h-12 min-h-12 w-12 p-0 not-eink:shadow-lg',
            'focus-visible:ring-base-content/15 focus-visible:outline-hidden focus-visible:ring-2',
          )}
        >
          <RiFileList3Line className='h-5 w-5' />
        </button>
      </div>

      {homeOpen && (
        <NotesHome
          data={data}
          folder={folder}
          onOpenFolder={setFolder}
          onOpenNote={setEditing}
          onNewNote={handleNewNote}
          onAddFolder={(name) =>
            void persist((previous) =>
              addFolder(previous, joinPath(folder, uniqueFolderName(previous, folder, name))),
            )
          }
          onRenameFolder={(path, name) =>
            void persist((previous) => renameFolder(previous, path, joinPath(parentOf(path), name)))
          }
          onDeleteFolder={handleDeleteFolder}
          onRenameNote={(id, title) => void persist((previous) => renameNote(previous, id, title))}
          onMoveNote={(id, to) => void persist((previous) => moveNote(previous, id, to))}
          onDeleteNote={(id) => void persist((previous) => deleteNote(previous, id))}
          onClose={() => setHomeOpen(false)}
        />
      )}

      {editing && (
        <QuickNoteEditor
          // Remounts the editor per note, so its ink starts from that note.
          key={editing.id}
          note={editing}
          onPersist={handlePersistNote}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
};

export default QuickNotes;
