import clsx from 'clsx';
import React, { useState } from 'react';
import { MdAdd, MdChevronRight, MdClose } from 'react-icons/md';
import { RiDeleteBinLine, RiEditLine, RiFolderOpenLine } from 'react-icons/ri';

import Dialog from '@/components/Dialog';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import {
  ROOT,
  allFolders,
  breadcrumbs,
  childFolders,
  countIn,
  nameOf,
  notesIn,
  sanitizeName,
  sortNotes,
  type NoteSort,
} from '@/services/notes/noteTree';
import type { QuickNote, QuickNotesData } from '@/types/notes';
import NotePreview from './NotePreview';

const SORTS: { sort: NoteSort; label: string }[] = [
  { sort: 'updated', label: 'Last edited' },
  { sort: 'created', label: 'Newest' },
  { sort: 'title', label: 'Name' },
];

/** A small, muted action on a card. */
const CardAction: React.FC<{
  label: string;
  Icon: React.ElementType;
  danger?: boolean;
  onClick: () => void;
}> = ({ label, Icon, danger, onClick }) => (
  <button
    type='button'
    aria-label={label}
    title={label}
    onClick={(event) => {
      // The card itself opens the note; an action must not do both.
      event.stopPropagation();
      onClick();
    }}
    className={clsx(
      'flex h-8 w-8 items-center justify-center rounded-md',
      'not-eink:hover:bg-base-200 transition-colors duration-150',
      danger ? 'text-error' : 'text-base-content/60',
    )}
  >
    <Icon className='h-4 w-4' />
  </button>
);

interface NotesHomeProps {
  data: QuickNotesData;
  folder: string;
  onOpenFolder: (folder: string) => void;
  onOpenNote: (note: QuickNote) => void;
  onNewNote: () => void;
  onAddFolder: (name: string) => void;
  onRenameFolder: (path: string, name: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameNote: (id: string, title: string) => void;
  onMoveNote: (id: string, folder: string) => void;
  onDeleteNote: (id: string) => void;
  onClose: () => void;
}

type Prompt =
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; path: string }
  | { kind: 'rename-note'; id: string }
  | { kind: 'delete-folder'; path: string }
  | { kind: 'move-note'; id: string };

/**
 * The notes screen: the folders and notes at one level, each note shown as
 * its own ink. Everything here works on the stored shape through noteTree,
 * so this component only decides what is on screen, never what it means.
 */
const NotesHome: React.FC<NotesHomeProps> = ({
  data,
  folder,
  onOpenFolder,
  onOpenNote,
  onNewNote,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameNote,
  onMoveNote,
  onDeleteNote,
  onClose,
}) => {
  const _ = useTranslation();
  const { safeAreaInsets } = useThemeStore();
  const [sort, setSort] = useState<NoteSort>('updated');
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState('');

  const folders = childFolders(data, folder);
  const notes = sortNotes(notesIn(data.notes, folder), sort);
  const trail = breadcrumbs(folder);
  const empty = folders.length === 0 && notes.length === 0;

  const ask = (next: Prompt, initial = '') => {
    setDraft(initial);
    setPrompt(next);
  };

  const submit = () => {
    const name = sanitizeName(draft);
    if (!prompt) return;
    if (prompt.kind === 'new-folder' && name) onAddFolder(name);
    if (prompt.kind === 'rename-folder' && name) onRenameFolder(prompt.path, name);
    if (prompt.kind === 'rename-note' && name) onRenameNote(prompt.id, name);
    setPrompt(null);
  };

  return (
    <div
      role='dialog'
      aria-label={_('Notes')}
      className='bg-base-200 text-base-content fixed inset-0 z-50 flex flex-col'
      style={{ paddingTop: `${safeAreaInsets?.top ?? 0}px` }}
    >
      <div className='flex shrink-0 items-center gap-2 px-3 py-2'>
        <h1 className='truncate text-lg font-medium'>{_('Notes')}</h1>
        <div className='ms-auto flex items-center gap-2'>
          <select
            aria-label={_('Sort by')}
            value={sort}
            onChange={(event) => setSort(event.target.value as NoteSort)}
            className='select select-sm eink-bordered border-base-200 rounded-lg border'
          >
            {SORTS.map(({ sort: value, label }) => (
              <option key={value} value={value}>
                {_(label)}
              </option>
            ))}
          </select>
          <button
            type='button'
            aria-label={_('Close')}
            onClick={onClose}
            className='not-eink:hover:bg-base-300 flex h-9 w-9 items-center justify-center rounded-lg'
          >
            <MdClose className='h-5 w-5' />
          </button>
        </div>
      </div>

      {/* Where you are, and the way back up. */}
      <div className='flex shrink-0 flex-wrap items-center gap-y-1 px-4 pb-2 text-sm'>
        <button
          type='button'
          onClick={() => onOpenFolder(ROOT)}
          className='hover:bg-base-300 text-base-content/85 rounded-sm px-2 py-1'
        >
          {_('All notes')}
        </button>
        {trail.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            <MdChevronRight className='text-base-content/40 h-4 w-4' />
            {index === trail.length - 1 ? (
              <span className='truncate rounded-sm px-2 py-1'>{crumb.name}</span>
            ) : (
              <button
                type='button'
                onClick={() => onOpenFolder(crumb.path)}
                className='hover:bg-base-300 text-base-content/85 truncate rounded-sm px-2 py-1'
              >
                {crumb.name}
              </button>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className='flex shrink-0 gap-2 px-4 pb-3'>
        <button
          type='button'
          onClick={onNewNote}
          className='btn btn-contrast btn-sm gap-1.5 rounded-lg'
        >
          <MdAdd className='h-4 w-4' />
          {_('New note')}
        </button>
        <button
          type='button'
          onClick={() => ask({ kind: 'new-folder' }, _('Folder'))}
          className='eink-bordered border-base-200 btn btn-sm gap-1.5 rounded-lg border bg-transparent'
        >
          <RiFolderOpenLine className='h-4 w-4' />
          {_('New folder')}
        </button>
      </div>

      <div className='min-h-0 grow overflow-y-auto px-4 pb-6'>
        {empty ? (
          <p className='text-base-content/60 py-16 text-center text-sm'>
            {_('Nothing here yet. Start a note and it will show up.')}
          </p>
        ) : (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
            {folders.map((path) => (
              <div
                key={path}
                className='eink-bordered bg-base-100 border-base-200 flex flex-col rounded-lg border p-3'
              >
                <button
                  type='button'
                  onClick={() => onOpenFolder(path)}
                  className='flex min-w-0 flex-1 items-center gap-2 text-start'
                >
                  <RiFolderOpenLine className='text-base-content/70 h-5 w-5 shrink-0' />
                  <span className='min-w-0'>
                    <span className='line-clamp-1 text-sm'>{nameOf(path)}</span>
                    <span className='text-base-content/55 text-xs'>
                      {countIn(data, path)} {_('notes')}
                    </span>
                  </span>
                </button>
                <div className='mt-1 flex justify-end'>
                  <CardAction
                    label={_('Rename')}
                    Icon={RiEditLine}
                    onClick={() => ask({ kind: 'rename-folder', path }, nameOf(path))}
                  />
                  <CardAction
                    label={_('Delete')}
                    Icon={RiDeleteBinLine}
                    danger
                    onClick={() => setPrompt({ kind: 'delete-folder', path })}
                  />
                </div>
              </div>
            ))}

            {notes.map((note) => (
              <div
                key={note.id}
                className='eink-bordered bg-base-100 border-base-200 flex flex-col overflow-hidden rounded-lg border'
              >
                <button
                  type='button'
                  onClick={() => onOpenNote(note)}
                  className='flex flex-col text-start'
                >
                  <NotePreview ink={note.ink} className='border-base-200 w-full border-b' />
                  <span className='line-clamp-1 px-3 pt-2 text-sm'>{note.title}</span>
                  <span className='text-base-content/55 px-3 text-xs'>
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </button>
                <div className='flex justify-end px-1 pb-1'>
                  <CardAction
                    label={_('Rename')}
                    Icon={RiEditLine}
                    onClick={() => ask({ kind: 'rename-note', id: note.id }, note.title)}
                  />
                  <CardAction
                    label={_('Move')}
                    Icon={RiFolderOpenLine}
                    onClick={() => setPrompt({ kind: 'move-note', id: note.id })}
                  />
                  <CardAction
                    label={_('Delete')}
                    Icon={RiDeleteBinLine}
                    danger
                    onClick={() => onDeleteNote(note.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {prompt && (prompt.kind === 'new-folder' || prompt.kind.startsWith('rename')) && (
        <Dialog
          isOpen
          title={prompt.kind === 'new-folder' ? _('New folder') : _('Rename')}
          boxClassName='h-auto! max-h-[80vh]! sm:max-w-sm'
          onClose={() => setPrompt(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className='flex flex-col gap-3'
          >
            <input
              autoFocus
              aria-label={_('Name')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className='input eink-bordered border-base-200 w-full rounded-lg border'
            />
            <button type='submit' className='btn btn-contrast btn-sm rounded-lg'>
              {_('Save')}
            </button>
          </form>
        </Dialog>
      )}

      {prompt?.kind === 'delete-folder' && (
        <Dialog
          isOpen
          title={_('Delete folder?')}
          boxClassName='h-auto! max-h-[80vh]! sm:max-w-sm'
          onClose={() => setPrompt(null)}
        >
          <div className='flex flex-col gap-3'>
            <p className='text-sm'>
              {_('This deletes the folder and every note inside it. It cannot be undone.')}
            </p>
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setPrompt(null)}
                className='btn btn-ghost btn-sm rounded-lg'
              >
                {_('Cancel')}
              </button>
              <button
                type='button'
                onClick={() => {
                  onDeleteFolder(prompt.path);
                  setPrompt(null);
                }}
                className='btn btn-error btn-sm rounded-lg'
              >
                {_('Delete')}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {prompt?.kind === 'move-note' && (
        <Dialog
          isOpen
          title={_('Move to')}
          boxClassName='h-auto! max-h-[80vh]! sm:max-w-sm'
          onClose={() => setPrompt(null)}
        >
          {/* Every folder, by its full path, so two folders with the same
              name in different places can be told apart. */}
          <ul className='eink-bordered bg-base-100 border-base-200 divide-base-200 divide-y rounded-lg border'>
            {[ROOT, ...allFolders(data)].map((path) => (
              <li key={path || 'root'}>
                <button
                  type='button'
                  onClick={() => {
                    onMoveNote(prompt.id, path);
                    setPrompt(null);
                  }}
                  className='not-eink:hover:bg-base-200/60 min-h-11 w-full px-4 py-2 text-start text-sm'
                >
                  {path || _('All notes')}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  );
};

export default NotesHome;
