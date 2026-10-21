import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotePreview from '@/app/library/components/NotePreview';
import type { NoteImage } from '@/types/notes';

const h = vi.hoisted(() => ({
  /** One per call, counted: a picture should be resolved once, not repeatedly. */
  asked: [] as string[],
}));

// Deliberately unstable, as a context provider that does not memoize would
// be: a fresh service object on every render. Nothing here may depend on its
// identity, or an effect re-runs on its own state update and never settles.
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({
    appService: {
      noteImageURL: async (file: string) => {
        h.asked.push(file);
        return `blob:${file}`;
      },
    },
  }),
}));

const image = (file: string): NoteImage => ({
  id: file,
  file,
  left: 0.1,
  top: 0.1,
  width: 0.5,
  height: 0.3,
});

let revoked: string[] = [];

beforeEach(() => {
  h.asked = [];
  revoked = [];
  // jsdom has no object-URL store; the component only needs it to exist.
  URL.revokeObjectURL = ((url: string) => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;
});

afterEach(cleanup);

describe('NotePreview', () => {
  it('draws a note with no pictures without asking for any', async () => {
    const { container } = render(<NotePreview ink={[]} />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(h.asked).toEqual([]);
  });

  it('settles instead of resolving the same picture over and over', async () => {
    render(<NotePreview ink={[]} images={[image('a.png')]} />);
    await waitFor(() => expect(h.asked.length).toBeGreaterThan(0));
    // A moment for any runaway effect to show itself.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(h.asked).toEqual(['a.png']);
  });

  it('holds on to a picture while it is on screen', async () => {
    render(<NotePreview ink={[]} images={[image('a.png')]} />);
    await waitFor(() => expect(h.asked.length).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Letting go here would empty the picture the card is showing.
    expect(revoked).toEqual([]);
  });

  it('lets go of its pictures once the card is gone', async () => {
    const { unmount } = render(<NotePreview ink={[]} images={[image('a.png')]} />);
    await waitFor(() => expect(h.asked.length).toBe(1));
    unmount();
    await waitFor(() => expect(revoked).toEqual(['blob:a.png']));
  });
});
