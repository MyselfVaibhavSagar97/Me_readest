import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import QuickNotes from '@/app/library/components/QuickNotes';
import type { InkStroke } from '@/services/handwriting/model';
import type { QuickNote, QuickNotesData } from '@/types/notes';

const h = vi.hoisted(() => ({
  saved: [] as QuickNotesData[],
  stored: { notes: [], folders: [] } as QuickNotesData,
  /** Ink the stubbed editor reports when its Save is pressed. */
  drawn: [{ id: 's1', color: '#1a1a1a', width: 0.006, points: [[0.1, 0.2]] }] as InkStroke[],
  /** How many times the screen has swept up unused picture files. */
  pruned: 0,
  /** Makes that sweep throw, as a device that refuses the directory would. */
  pruneFails: false,
}));

vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => (key: string) => key }));

// The real sheet brings OverlayScrollbars and the haptics plugin with it;
// none of that is what these cases are about.
vi.mock('@/components/Dialog', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/store/themeStore', () => ({
  useThemeStore: () => ({ safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 } }),
}));

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({
    appService: {
      loadQuickNotes: async () => h.stored,
      saveQuickNotes: async (data: QuickNotesData) => {
        h.saved.push(data);
      },
      // The picture side of the service. The notes screen sweeps up unused
      // picture files whenever it opens, so this has to be here even for
      // cases about notes that hold no pictures at all.
      pruneNoteImages: async () => {
        h.pruned += 1;
        if (h.pruneFails) throw new Error('cannot read the picture directory');
        return 0;
      },
      noteImageURL: async (file: string) => `blob:${file}`,
      saveNoteImage: async (_source: string, id: string) => `${id}.png`,
    },
  }),
}));

// The editor owns a canvas and the ink engine; here it stands in for them, so
// these cases cover the notes screen and what it stores.
vi.mock('@/app/library/components/QuickNoteEditor', () => ({
  default: ({
    note,
    onPersist,
    onClose,
  }: {
    note: QuickNote;
    onPersist: (note: QuickNote) => void;
    onClose: () => void;
  }) => (
    <div data-testid='quick-note-editor'>
      <span>editing {note.title}</span>
      <span data-testid='editing-folder'>{note.folder ?? ''}</span>
      <button type='button' onClick={() => onPersist({ ...note, ink: h.drawn })}>
        stub-save
      </button>
      <button type='button' onClick={onClose}>
        stub-close
      </button>
    </div>
  ),
}));

const note = (id: string, overrides: Partial<QuickNote> = {}): QuickNote => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  ink: h.drawn,
  ...overrides,
});

const openNotes = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Notes' }));
};

beforeEach(() => {
  h.saved = [];
  h.stored = { notes: [], folders: [] };
  h.pruned = 0;
  h.pruneFails = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('QuickNotes', () => {
  it('sweeps up unused picture files when the notes are read', async () => {
    render(<QuickNotes />);
    // That it happens, not how many times: the screen re-reads whenever the
    // service it was handed changes, and sweeping twice costs nothing.
    await waitFor(() => expect(h.pruned).toBeGreaterThanOrEqual(1));
  });

  it('still opens when sweeping up picture files fails', async () => {
    // Housekeeping is never allowed to matter. A device that will not let us
    // read the picture directory must cost the person their unused files,
    // not their notes.
    h.pruneFails = true;
    render(<QuickNotes />);
    await openNotes();

    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeTruthy();
  });

  it('offers a Notes button that opens the notes screen', async () => {
    render(<QuickNotes />);

    await openNotes();

    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeTruthy();
    expect(screen.getByText('Nothing here yet. Start a note and it will show up.')).toBeTruthy();
  });

  it('starts a blank note from the notes screen', async () => {
    render(<QuickNotes />);
    await openNotes();

    fireEvent.click(screen.getByRole('button', { name: 'New note' }));

    expect(screen.getByTestId('quick-note-editor')).toBeTruthy();
  });

  it('stores a note that was written on', async () => {
    render(<QuickNotes />);
    await openNotes();
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    fireEvent.click(screen.getByText('stub-save'));

    await waitFor(() => expect(h.saved).toHaveLength(1));
    expect(h.saved[0]!.notes).toHaveLength(1);
    expect(h.saved[0]!.notes[0]!.ink).toEqual(h.drawn);
  });

  it('keeps a note that was opened and closed without a mark off the screen', async () => {
    render(<QuickNotes />);
    await openNotes();
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    fireEvent.click(screen.getByText('stub-close'));

    expect(h.saved).toEqual([]);
  });

  it('lists the notes already on disk and reopens the one picked', async () => {
    h.stored = { notes: [note('Shopping list'), note('Meeting')], folders: [] };
    render(<QuickNotes />);
    await openNotes();

    fireEvent.click(await screen.findByText('Shopping list'));

    expect(screen.getByText('editing Shopping list')).toBeTruthy();
  });

  it('removes a deleted note from what is stored', async () => {
    h.stored = { notes: [note('Shopping list')], folders: [] };
    render(<QuickNotes />);
    await openNotes();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(h.saved).toHaveLength(1));
    expect(h.saved[0]!.notes).toEqual([]);
  });

  it('renames a note', async () => {
    h.stored = { notes: [note('Untitled')], folders: [] };
    render(<QuickNotes />);
    await openNotes();

    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Shopping' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(h.saved).toHaveLength(1));
    expect(h.saved[0]!.notes[0]!.title).toBe('Shopping');
  });

  describe('folders', () => {
    it('makes a folder and keeps it even though it is empty', async () => {
      render(<QuickNotes />);
      await openNotes();

      fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: 'Maths' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(h.saved).toHaveLength(1));
      expect(h.saved[0]!.folders).toEqual(['Maths']);
    });

    it('opens a folder and starts new notes inside it', async () => {
      h.stored = { notes: [], folders: ['Maths'] };
      render(<QuickNotes />);
      await openNotes();

      fireEvent.click(await screen.findByText('Maths'));
      fireEvent.click(screen.getByRole('button', { name: 'New note' }));

      expect(screen.getByTestId('editing-folder').textContent).toBe('Maths');
    });

    it('shows only the notes filed in the folder being looked at', async () => {
      h.stored = {
        notes: [note('Inside', { folder: 'Maths' }), note('Outside')],
        folders: ['Maths'],
      };
      render(<QuickNotes />);
      await openNotes();

      expect(await screen.findByText('Outside')).toBeTruthy();
      expect(screen.queryByText('Inside')).toBeNull();

      fireEvent.click(screen.getByText('Maths'));

      expect(screen.getByText('Inside')).toBeTruthy();
      expect(screen.queryByText('Outside')).toBeNull();
    });

    it('deletes a folder with everything in it, and steps back out of it', async () => {
      h.stored = { notes: [note('Inside', { folder: 'Maths' })], folders: ['Maths'] };
      render(<QuickNotes />);
      await openNotes();
      fireEvent.click(await screen.findByText('Maths'));

      // Back at the top level to reach the folder's own delete action.
      fireEvent.click(screen.getByRole('button', { name: 'All notes' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Deleting a folder takes its notes with it, so it asks first. The
      // card's own action and the confirmation share a name.
      const confirms = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.click(confirms[confirms.length - 1]!);

      await waitFor(() => expect(h.saved).toHaveLength(1));
      expect(h.saved[0]!.folders).toEqual([]);
      expect(h.saved[0]!.notes).toEqual([]);
    });
  });
});
