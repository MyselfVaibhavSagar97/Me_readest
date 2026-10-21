import React, { useCallback, useRef } from 'react';
import { RiDeleteBin7Line } from 'react-icons/ri';

import { useTranslation } from '@/hooks/useTranslation';
import type { Bounds } from '@/services/handwriting/selection';

/** Two offset sheets: the copy glyph, drawn rather than borrowed. */
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 24 24' className={className} aria-hidden='true'>
    <rect
      x='4'
      y='4'
      width='12'
      height='14'
      rx='2'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
    />
    <path
      d='M8 20 L18 20 A2 2 0 0 0 20 18 L20 8'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
    />
  </svg>
);

/** The smallest a box may be before the resize maths has nothing to divide by. */
const DEGENERATE = 1e-6;

export interface NoteSelectionProps {
  /** Where the picked-up ink sits, in page fractions. */
  bounds: Bounds;
  /** The page on screen, so fractions can be turned into pixels and back. */
  page: { width: number; height: number };
  /** Takes hold for a drag; returns the box it started in. */
  onBegin: () => Bounds | null;
  onMove: (dx: number, dy: number) => void;
  onScale: (factor: number) => void;
  onEnd: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

/**
 * The box round what the lasso picked up: drag it to move the ink, drag its
 * corner to resize, or use the buttons above it to copy or delete.
 *
 * It sits over the page as its own element rather than being drawn into the
 * canvas, so dragging it is ordinary pointer handling and the ink engine
 * never sees these events — it would otherwise read a drag on the selection
 * as a new lasso being drawn.
 */
const NoteSelection: React.FC<NoteSelectionProps> = ({
  bounds,
  page,
  onBegin,
  onMove,
  onScale,
  onEnd,
  onDelete,
  onDuplicate,
}) => {
  const _ = useTranslation();
  const drag = useRef<{ x: number; y: number; from: Bounds; scaling: boolean } | null>(null);

  const start = useCallback(
    (event: React.PointerEvent, scaling: boolean) => {
      const from = onBegin();
      if (!from) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, from, scaling };
    },
    [onBegin],
  );

  const move = useCallback(
    (event: React.PointerEvent) => {
      const held = drag.current;
      if (!held) return;
      event.preventDefault();
      // Pixels on screen to fractions of the page, each axis against its own
      // side — which is how the ink underneath is stored.
      const dx = (event.clientX - held.x) / page.width;
      const dy = (event.clientY - held.y) / page.height;
      if (!held.scaling) {
        onMove(dx, dy);
        return;
      }
      // The handle is the bottom-right corner; the top-left stays put. How
      // far the corner has travelled from it, against how far it started.
      const spanX = held.from.right - held.from.left;
      const spanY = held.from.bottom - held.from.top;
      const ratios: number[] = [];
      if (spanX > DEGENERATE) ratios.push((spanX + dx) / spanX);
      if (spanY > DEGENERATE) ratios.push((spanY + dy) / spanY);
      if (ratios.length === 0) return;
      onScale(ratios.reduce((sum, r) => sum + r, 0) / ratios.length);
    },
    [onMove, onScale, page.height, page.width],
  );

  const finish = useCallback(
    (event: React.PointerEvent) => {
      if (!drag.current) return;
      drag.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      onEnd();
    },
    [onEnd],
  );

  const box = {
    left: `${bounds.left * 100}%`,
    top: `${bounds.top * 100}%`,
    width: `${(bounds.right - bounds.left) * 100}%`,
    height: `${(bounds.bottom - bounds.top) * 100}%`,
  };
  // The buttons sit above the box, unless it is too near the top for them
  // to fit, in which case they go underneath it.
  const above = bounds.top > 0.12;

  return (
    <>
      <div
        role='group'
        aria-label={_('Selection')}
        onPointerDown={(event) => start(event, false)}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className='border-primary absolute cursor-move border-2 border-dashed'
        style={{ ...box, touchAction: 'none' }}
      >
        {/* The resize handle, hanging off the corner so the ink stays visible. */}
        <button
          type='button'
          aria-label={_('Resize selection')}
          onPointerDown={(event) => start(event, true)}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          className='border-primary bg-base-100 absolute -end-2 -bottom-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 p-0'
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Above the box, or below it when the box is against the top edge. */}
      <div
        className='absolute flex gap-1'
        style={{
          left: box.left,
          top: above ? box.top : `${bounds.bottom * 100}%`,
          transform: above ? 'translateY(calc(-100% - 8px))' : 'translateY(8px)',
        }}
      >
        <button
          type='button'
          aria-label={_('Duplicate')}
          title={_('Duplicate')}
          onClick={onDuplicate}
          className='eink-bordered bg-base-100 border-base-300 not-eink:shadow-sm flex h-8 w-8 items-center justify-center rounded-lg border p-0'
        >
          <CopyIcon className='h-4 w-4' />
        </button>
        <button
          type='button'
          aria-label={_('Delete')}
          title={_('Delete')}
          onClick={onDelete}
          className='eink-bordered bg-base-100 border-base-300 text-error not-eink:shadow-sm flex h-8 w-8 items-center justify-center rounded-lg border p-0'
        >
          <RiDeleteBin7Line className='h-4 w-4' />
        </button>
      </div>
    </>
  );
};

export default NoteSelection;
