import React, { useEffect, useRef } from 'react';

import { renderStrokes } from '@/services/handwriting/renderer';
import type { InkStroke } from '@/services/handwriting/model';
import { QUICK_NOTE_ASPECT } from '@/types/notes';

/** The page is paper, as it is in the editor, so ink reads at its own colour. */
const PAPER = '#fdfdfb';

interface NotePreviewProps {
  ink: InkStroke[];
  className?: string;
}

/**
 * A note shown as the note itself: its ink, drawn small on a page of the same
 * shape. Ink is stored relative to the page, so the same strokes that fill a
 * tablet fill a thumbnail — nothing has to be captured or cached when a note
 * is saved.
 */
const NotePreview: React.FC<NotePreviewProps> = ({ ink, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    renderStrokes(ctx, ink, { left: 0, top: 0, width: box.width, height: box.height });
  }, [ink]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className={className}
      style={{ aspectRatio: `${QUICK_NOTE_ASPECT}`, backgroundColor: PAPER }}
    />
  );
};

export default NotePreview;
