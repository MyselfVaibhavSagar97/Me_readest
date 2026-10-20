import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MdAdd } from 'react-icons/md';
import { RiFileList3Line } from 'react-icons/ri';

import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import { uniqueId } from '@/utils/misc';
import type { QuickNote } from '@/types/notes';
import QuickNoteEditor from './QuickNoteEditor';
import QuickNotesPanel from './QuickNotesPanel';

/**
 * Handwritten quick notes on the library screen: an Add button in the bottom
 * corner opens a blank page to write on, and the saved notes are listed beside
 * it. Notes are standalone — they belong to no book — and are stored in their
 * own file, like the RSS feeds are.
 */
const QuickNotes: React.FC = () => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { safeAreaInsets } = useThemeStore();
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [editing, setEditing] = useState<QuickNote | null>(null);
  const [listOpen, setListOpen] = useState(false);
  /**
   * The load, kept so a save that happens before it finishes still merges into
   * what was on disk instead of overwriting it with an empty list.
   */
  const loadRef = useRef<Promise<QuickNote[]> | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (!appService) return [];
    loadRef.current ??= appService.loadQuickNotes();
    return loadRef.current;
  }, [appService]);

  useEffect(() => {
    let active = true;
    void ensureLoaded().then((loaded) => {
      if (active) setNotes(loaded);
    });
    return () => {
      active = false;
    };
  }, [ensureLoaded]);

  const persist = useCallback(
    async (update: (previous: QuickNote[]) => QuickNote[]) => {
      const next = update(await ensureLoaded());
      loadRef.current = Promise.resolve(next);
      setNotes(next);
      await appService?.saveQuickNotes(next);
    },
    [appService, ensureLoaded],
  );

  const handleAdd = () => {
    const now = Date.now();
    setEditing({
      id: uniqueId(),
      title: new Date(now).toLocaleString(),
      createdAt: now,
      updatedAt: now,
      ink: [],
    });
  };

  const handlePersist = useCallback(
    (note: QuickNote) => {
      // An untouched new note is not worth keeping, and storing it would leave
      // a blank row in the list.
      if (note.ink.length === 0) return;
      void persist((previous) => {
        const index = previous.findIndex((n) => n.id === note.id);
        if (index < 0) return [...previous, note];
        return previous.map((n) => (n.id === note.id ? note : n));
      });
    },
    [persist],
  );

  const handleDelete = useCallback(
    (note: QuickNote) => {
      void persist((previous) => previous.filter((n) => n.id !== note.id));
    },
    [persist],
  );

  if (!appService) return null;

  return (
    <>
      <div
        className='fixed bottom-0 end-0 z-40 flex flex-col items-center gap-2 pe-4'
        style={{ paddingBottom: `${(safeAreaInsets?.bottom ?? 0) / 4 + 16}px` }}
      >
        {notes.length > 0 && (
          <button
            type='button'
            aria-label={_('Notes')}
            title={_('Notes')}
            onClick={() => setListOpen(true)}
            className={clsx(
              'eink-bordered bg-base-100 border-base-200 flex h-9 w-9 items-center justify-center',
              'rounded-full border not-eink:shadow-md',
              'not-eink:hover:bg-base-200 transition-colors duration-150',
              'focus-visible:ring-base-content/15 focus-visible:outline-hidden focus-visible:ring-2',
            )}
          >
            <RiFileList3Line className='h-4 w-4' />
          </button>
        )}
        <button
          type='button'
          aria-label={_('Add Note')}
          title={_('Add Note')}
          onClick={handleAdd}
          className={clsx(
            'btn btn-contrast btn-circle h-12 min-h-12 w-12 p-0 not-eink:shadow-lg',
            'focus-visible:ring-base-content/15 focus-visible:outline-hidden focus-visible:ring-2',
          )}
        >
          <MdAdd className='h-6 w-6' />
        </button>
      </div>
      {listOpen && (
        <QuickNotesPanel
          notes={notes}
          onOpenNote={(note) => {
            setListOpen(false);
            setEditing(note);
          }}
          onDeleteNote={handleDelete}
          onClose={() => setListOpen(false)}
        />
      )}
      {editing && (
        <QuickNoteEditor
          // Remounts the editor per note, so its ink starts from that note.
          key={editing.id}
          note={editing}
          onPersist={handlePersist}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
};

export default QuickNotes;
