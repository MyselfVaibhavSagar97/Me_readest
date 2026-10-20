import clsx from 'clsx';
import React from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';

import Dialog from '@/components/Dialog';
import { useTranslation } from '@/hooks/useTranslation';
import type { QuickNote } from '@/types/notes';

interface QuickNotesPanelProps {
  notes: QuickNote[];
  onOpenNote: (note: QuickNote) => void;
  onDeleteNote: (note: QuickNote) => void;
  onClose: () => void;
}

/** The saved quick notes, newest first: open one to keep writing, or delete it. */
const QuickNotesPanel: React.FC<QuickNotesPanelProps> = ({
  notes,
  onOpenNote,
  onDeleteNote,
  onClose,
}) => {
  const _ = useTranslation();
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Dialog
      id='quick-notes'
      isOpen
      title={_('Notes')}
      boxClassName='h-auto! max-h-[80vh]! sm:max-w-md'
      onClose={onClose}
    >
      {sorted.length === 0 ? (
        <p className='text-base-content/70 py-6 text-center text-sm'>{_('No notes yet')}</p>
      ) : (
        <ul className='eink-bordered bg-base-100 border-base-200 divide-base-200 divide-y rounded-lg border'>
          {sorted.map((note) => (
            <li key={note.id} className='flex items-center'>
              <button
                type='button'
                onClick={() => onOpenNote(note)}
                className={clsx(
                  'min-h-11 flex-1 px-4 py-2 text-start',
                  'not-eink:hover:bg-base-200/60 transition-colors duration-150',
                  'focus-visible:ring-base-content/15 focus-visible:outline-hidden focus-visible:ring-2',
                )}
              >
                <span className='line-clamp-1 text-sm'>{note.title}</span>
                <span className='text-base-content/60 text-xs'>
                  {new Date(note.updatedAt).toLocaleString()}
                </span>
              </button>
              <button
                type='button'
                aria-label={_('Delete')}
                onClick={() => onDeleteNote(note)}
                className='flex h-11 w-11 shrink-0 items-center justify-center'
              >
                <RiDeleteBinLine className='text-error h-4 w-4' />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
};

export default QuickNotesPanel;
