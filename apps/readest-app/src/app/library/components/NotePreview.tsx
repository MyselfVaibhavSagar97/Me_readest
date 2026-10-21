import React, { useEffect, useRef, useState } from 'react';

import { useEnv } from '@/context/EnvContext';
import { renderStrokes } from '@/services/handwriting/renderer';
import type { InkStroke } from '@/services/handwriting/model';
import { QUICK_NOTE_ASPECT, type NoteImage } from '@/types/notes';
import { PAPER_COLOR } from '@/services/notes/penSettings';

interface NotePreviewProps {
  ink: InkStroke[];
  /** Pictures on the page, drawn under the ink as they are on the note. */
  images?: NoteImage[];
  className?: string;
}

/**
 * A note shown as the note itself: its pictures and its ink, drawn small on a
 * page of the same shape. Both are stored relative to the page, so the same
 * note that fills a tablet fills a thumbnail — nothing has to be captured or
 * cached when a note is saved.
 */
const NotePreview: React.FC<NotePreviewProps> = ({ ink, images, className }) => {
  const { appService } = useEnv();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** The pictures, once decoded; the ink is drawn without waiting for them. */
  const [loaded, setLoaded] = useState<{ image: NoteImage; el: HTMLImageElement }[]>([]);

  useEffect(() => {
    const wanted = images ?? [];
    if (!appService || wanted.length === 0) {
      setLoaded([]);
      return;
    }
    let active = true;
    const urls: string[] = [];
    void (async () => {
      const decoded: { image: NoteImage; el: HTMLImageElement }[] = [];
      for (const image of wanted) {
        try {
          const url = await appService.noteImageURL(image.file);
          urls.push(url);
          const el = new Image();
          await new Promise<void>((resolve) => {
            el.onload = () => resolve();
            // A picture that will not decode is simply left out of the card.
            el.onerror = () => resolve();
            el.src = url;
          });
          if (el.naturalWidth > 0) decoded.push({ image, el });
        } catch {
          // The file has gone; the rest of the note still shows.
        }
      }
      if (active) setLoaded(decoded);
    })();
    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [appService, images]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    // Pictures first: on the note they sit under the writing, and a card that
    // layered them the other way round would not be the note.
    for (const { image, el } of loaded) {
      ctx.drawImage(
        el,
        image.left * box.width,
        image.top * box.height,
        image.width * box.width,
        image.height * box.height,
      );
    }
    renderStrokes(ctx, ink, { left: 0, top: 0, width: box.width, height: box.height });
  }, [ink, loaded]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className={className}
      style={{ aspectRatio: `${QUICK_NOTE_ASPECT}`, backgroundColor: PAPER_COLOR }}
    />
  );
};

export default NotePreview;
