import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import QuickNotes from '@/app/library/components/QuickNotes';
import type { InkStroke } from '@/services/handwriting/model';
import type { QuickNote } from '@/types/notes';

const h = vi.hoisted(() => ({
  saved: [] as QuickNote[][],
  stored: [] as QuickNote[],
  /** Ink the stubbed editor reports when its Save is pressed. */
  drawn: [{ id: 's1', color: '#1a1a1a', width: 0.006, points: [[0.1, 0.2]] }] as InkStroke[],
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
      saveQuickNotes: async (notes: QuickNote[]) => {
        h.saved.push(notes);
      },
    },
  }),
}));

// The editor owns a canvas and the ink engine; here it stands in for them, so
// this test covers the Add button, persistence and the notes list only.
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
      <span>{note.title}</span>
      <button type='button' onClick={() => onPersist({ ...note, ink: h.drawn })}>
        stub-save
      </button>
      <button type='button' onClick={onClose}>
        stub-close
      </button>
    </div>
  ),
}));

beforeEach(() => {
  h.saved = [];
  h.stored = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('QuickNotes', () => {
  it('offers an Add button that opens a blank note to write on', async () => {
    render(<QuickNotes />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Note' }));

    expect(screen.getByTestId('quick-note-editor')).toBeTruthy();
  });

  it('stores a note that was written on', async () => {
    render(<QuickNotes />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Note' }));
    fireEvent.click(screen.getByText('stub-save'));

    await waitFor(() => expect(h.saved).toHaveLength(1));
    expect(h.saved[0]).toHaveLength(1);
    expect(h.saved[0]![0]!.ink).toEqual(h.drawn);
  });

  it('keeps a note that was opened and closed without a mark off the list', async () => {
    render(<QuickNotes />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Note' }));
    fireEvent.click(screen.getByText('stub-close'));

    expect(h.saved).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull();
  });

  it('lists the notes already on disk and reopens the one picked', async () => {
    h.stored = [
      { id: 'n1', title: 'Shopping list', createdAt: 1, updatedAt: 2, ink: h.drawn },
      { id: 'n2', title: 'Meeting', createdAt: 3, updatedAt: 4, ink: h.drawn },
    ];
    render(<QuickNotes />);

    const notesButton = await screen.findByRole('button', { name: 'Notes' });
    fireEvent.click(notesButton);

    // Newest first.
    expect(screen.getByText('Meeting')).toBeTruthy();
    fireEvent.click(screen.getByText('Shopping list'));

    expect(screen.getByTestId('quick-note-editor')).toBeTruthy();
    expect(screen.getByText('Shopping list')).toBeTruthy();
  });

  it('removes a deleted note from what is stored', async () => {
    h.stored = [{ id: 'n1', title: 'Shopping list', createdAt: 1, updatedAt: 2, ink: h.drawn }];
    render(<QuickNotes />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(h.saved).toHaveLength(1));
    expect(h.saved[0]).toEqual([]);
  });
});
