import { useCallback, useEffect, useRef, useState } from 'react';

import { useEnv } from '@/context/EnvContext';
import type { NoteImage, QuickNote } from '@/types/notes';
import {
  IMAGE_EXTENSIONS,
  imagesOf,
  moveImage,
  nextImageId,
  placeImage,
  scaleImage,
} from '@/services/notes/noteImages';

/** How big a picture is on screen, so it can be placed without stretching. */
const measure = (url: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    // A picture that will not decode still gets placed, as a square: better a
    // box the person can see and delete than a note that silently drops it.
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.src = url;
  });

/**
 * The pictures on the note being edited: choosing them, where they sit, and
 * the URLs the page shows them at.
 *
 * Kept apart from `useQuickNoteInk` because a picture is not ink — it does
 * not go through the handwriting engine, it is a file on disk, and the two
 * have nothing to say to each other beyond sharing a page.
 */
export const useQuickNoteImages = (note: QuickNote) => {
  const { appService } = useEnv();
  const [images, setImages] = useState<NoteImage[]>(() => imagesOf(note.images));
  /** The picture being handled, if any. */
  const [selected, setSelected] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /** What a drag started from, so each frame resizes the original box. */
  const dragRef = useRef<{ id: string; from: NoteImage } | null>(null);

  // Blob URLs for whatever the note holds, made once per picture and let go
  // of when the editor closes — they would otherwise hold the bytes of every
  // picture ever opened for as long as the app runs.
  useEffect(() => {
    if (!appService) return;
    let active = true;
    const made: string[] = [];
    void (async () => {
      for (const image of images) {
        if (urls[image.file]) continue;
        try {
          const url = await appService.noteImageURL(image.file);
          if (!active) {
            URL.revokeObjectURL(url);
            return;
          }
          made.push(url);
          setUrls((current) => ({ ...current, [image.file]: url }));
        } catch {
          // A picture whose file has gone shows as an empty box rather than
          // taking the note down with it.
        }
      }
    })();
    return () => {
      active = false;
      for (const url of made) URL.revokeObjectURL(url);
    };
    // `urls` is written here, not read as a trigger: adding it would re-run
    // this effect for every picture it resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService, images]);

  /**
   * Opens the gallery and puts the chosen picture on the page. The file is
   * copied in first, so the note does not depend on a photograph the person
   * may later move or delete.
   */
  const insertFromAlbum = useCallback(async () => {
    if (!appService || busy) return;
    setBusy(true);
    try {
      const chosen = await appService.selectFiles('Images', IMAGE_EXTENSIONS);
      const source = chosen[0];
      if (!source) return;
      const id = nextImageId();
      const file = await appService.saveNoteImage(source, id);
      const url = await appService.noteImageURL(file);
      const natural = await measure(url);
      const box = placeImage(natural.width, natural.height);
      setUrls((current) => ({ ...current, [file]: url }));
      setImages((current) => [...current, { id, file, ...box }]);
      setSelected(id);
    } finally {
      setBusy(false);
    }
  }, [appService, busy]);

  const beginImageDrag = useCallback(() => {
    const image = images.find((candidate) => candidate.id === selected);
    if (!image) return null;
    dragRef.current = { id: image.id, from: image };
    return {
      left: image.left,
      top: image.top,
      right: image.left + image.width,
      bottom: image.top + image.height,
    };
  }, [images, selected]);

  const moveImageTo = useCallback((dx: number, dy: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    setImages((current) =>
      current.map((image) => (image.id === drag.id ? moveImage(drag.from, dx, dy) : image)),
    );
  }, []);

  const scaleImageTo = useCallback((factor: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    setImages((current) =>
      current.map((image) => (image.id === drag.id ? scaleImage(drag.from, drag.from, factor) : image)),
    );
  }, []);

  const endImageDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  /**
   * Takes the picture off the page. The file is swept up later, when the
   * notes are next read, rather than deleted here — a save that does not
   * finish must not leave a note pointing at a picture that has already gone.
   */
  const deleteSelectedImage = useCallback(() => {
    setImages((current) => current.filter((image) => image.id !== selected));
    setSelected(null);
  }, [selected]);

  const picked = images.find((image) => image.id === selected) ?? null;

  return {
    images,
    urls,
    selected,
    /** The box round the picture being handled, for the selection overlay. */
    selectedBounds: picked
      ? {
          left: picked.left,
          top: picked.top,
          right: picked.left + picked.width,
          bottom: picked.top + picked.height,
        }
      : null,
    select: setSelected,
    insertFromAlbum,
    inserting: busy,
    beginImageDrag,
    moveImageTo,
    scaleImageTo,
    endImageDrag,
    deleteSelectedImage,
  };
};
