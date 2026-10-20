import React, { useEffect, useRef } from 'react';

import { renderStrokes } from '@/services/handwriting/renderer';
import type { InkStroke } from '@/services/handwriting/model';

/**
 * The page is paper, not a themed surface: stored ink keeps the colour it was
 * drawn with, so a dark page would hide black ink in dark mode and on e-ink.
 */
const PAPER = '#fdfdfb';

interface NotePageProps {
  index: number;
  strokes: readonly InkStroke[];
  width: number;
  height: number;
  /** Registers the page so a stroke can be placed against where it is now. */
  pageRef: (el: HTMLElement | null) => void;
  /** Bumped whenever committed ink changes, which is when a page repaints. */
  revision: number;
}

/**
 * One page of a note: a sheet of paper with its own ink painted on it. The
 * canvas takes no pointer events — input belongs to the scrolling surface
 * these pages sit in, which routes each stroke to the page it landed on.
 */
const NotePage: React.FC<NotePageProps> = ({
  index,
  strokes,
  width,
  height,
  pageRef,
  revision,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const pxWidth = Math.max(1, Math.round(width * dpr));
    const pxHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
      canvas.width = pxWidth;
      canvas.height = pxHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokes(ctx, strokes, { left: 0, top: 0, width, height });
  }, [strokes, width, height, revision]);

  return (
    <div
      ref={pageRef}
      data-page={index}
      aria-label={`Page ${index + 1}`}
      className='eink-bordered border-base-300/60 relative shrink-0 border not-eink:shadow-sm'
      style={{ width, height, backgroundColor: PAPER }}
    >
      <canvas ref={canvasRef} className='pointer-events-none absolute inset-0' />
    </div>
  );
};

export default NotePage;
