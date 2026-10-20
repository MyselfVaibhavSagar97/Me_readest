import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MdAdd } from 'react-icons/md';
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiEraserLine,
  RiMarkPenLine,
  RiPencilLine,
  RiQuillPenLine,
  RiSave3Line,
} from 'react-icons/ri';
import type { IconType } from 'react-icons';

import { eventDispatcher } from '@/utils/event';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import type { InkTool } from '@/services/handwriting/model';
import { QUICK_NOTE_ASPECT, type QuickNote } from '@/types/notes';
import AnnotationToolButton from '@/app/reader/components/annotator/AnnotationToolButton';
import HandwritingOptions from '@/app/reader/components/handwriting/HandwritingOptions';
import { useQuickNoteInk } from '../hooks/useQuickNoteInk';
import NotePage from './NotePage';

const TOOLS: { tool: InkTool; label: string; Icon: IconType }[] = [
  { tool: 'pen', label: 'Pen', Icon: RiPencilLine },
  { tool: 'marker', label: 'Marker', Icon: RiMarkPenLine },
];

/** Gap between pages, and the padding around the stack, in CSS px. */
const PAGE_GAP = 16;
/** A page never grows past this, so it stays readable on a wide screen. */
const MAX_PAGE_WIDTH = 900;

const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

interface QuickNoteEditorProps {
  note: QuickNote;
  /** Writes the note's ink to the library's notes; does not close the editor. */
  onPersist: (note: QuickNote) => void;
  onClose: () => void;
}

/**
 * Full-screen editor for one standalone handwritten note: a stack of pages to
 * write on and a dock of drawing tools. Drawn with a stylus (pressure
 * included), a finger, or a mouse; "Stylus only" rejects the hand entirely, so
 * a tablet can be written on with the palm resting on the glass — and, because
 * touch is then not input, scrolled with that same hand.
 */
const QuickNoteEditor: React.FC<QuickNoteEditorProps> = ({ note, onPersist, onClose }) => {
  const _ = useTranslation();
  const { safeAreaInsets } = useThemeStore();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const ink = useQuickNoteInk(note);
  const { attachSurface, attachLiveCanvas, setSurfaceRect, registerPage, strokes } = ink;

  const pageWidth = Math.max(1, Math.min(surfaceWidth - PAGE_GAP * 2, MAX_PAGE_WIDTH) * zoom);
  const pageHeight = pageWidth / QUICK_NOTE_ASPECT;

  // The surface's own bounds, which the pointer backend maps touches through,
  // and its width, which decides how big a page can be. Pages are positioned
  // from the DOM as each stroke lands, so scrolling needs no measuring.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      setSurfaceWidth(box.width);
      setSurfaceRect({ left: box.left, top: box.top, width: box.width, height: box.height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [setSurfaceRect]);

  // Which page the reader is looking at, for the indicator and the page
  // buttons. Measured from the page nearest the middle of the surface.
  const handleScroll = useCallback(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const middle = el.getBoundingClientRect().top + el.clientHeight / 2;
    const pages = el.querySelectorAll('[data-page]');
    let nearest = 0;
    let best = Infinity;
    pages.forEach((page, index) => {
      const box = page.getBoundingClientRect();
      const distance = Math.abs(box.top + box.height / 2 - middle);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setCurrentPage(nearest);
  }, []);

  const goToPage = useCallback(
    (index: number) => {
      const el = surfaceRef.current;
      const target = el?.querySelectorAll('[data-page]')[index];
      if (!el || !target) return;
      // Scroll the surface itself rather than scrollIntoView, which would also
      // scroll whatever is behind this full-screen editor.
      el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top;
      setCurrentPage(index);
    },
    [],
  );

  const setSurface = useCallback(
    (el: HTMLDivElement | null) => {
      surfaceRef.current = el;
      attachSurface(el);
    },
    [attachSurface],
  );

  // Closing saves too: handwriting is too easy to lose to make Save the only
  // way out. A note scribbled by accident is removed from the notes list.
  const persist = useCallback(
    () => onPersist({ ...note, pages: ink.pageCount, ink: strokes(), updatedAt: Date.now() }),
    [ink.pageCount, note, onPersist, strokes],
  );

  const handleSave = useCallback(() => {
    persist();
    eventDispatcher.dispatch('toast', {
      type: 'info',
      timeout: 1500,
      message: _('Note saved'),
    });
  }, [_, persist]);

  const handleClose = useCallback(() => {
    persist();
    onClose();
  }, [onClose, persist]);

  // Show a newly added page rather than leaving it below the fold. The scroll
  // waits for the page to exist in the DOM, which is after the render that
  // adds it, not the click that asked for it.
  const pendingScroll = useRef<number | null>(null);
  const handleAddPage = useCallback(() => {
    pendingScroll.current = ink.pageCount;
    ink.addPage();
  }, [ink]);

  useEffect(() => {
    const target = pendingScroll.current;
    if (target === null) return;
    pendingScroll.current = null;
    goToPage(target);
  }, [ink.pageCount, goToPage]);

  const choose =
    <T,>(select: (value: T) => void) =>
    (value: T) => {
      select(value);
      setOptionsOpen(false);
    };

  const pages = Array.from({ length: ink.pageCount }, (_unused, index) => index);

  return (
    <div
      role='dialog'
      aria-label={_('Quick Note')}
      className='bg-base-200 fixed inset-0 z-50 flex flex-col'
      style={{ paddingTop: `${safeAreaInsets?.top ?? 0}px` }}
    >
      <div className='relative min-h-0 flex-1'>
        <div
          ref={setSurface}
          onScroll={handleScroll}
          className='h-full overflow-auto'
          style={{
            // With touch rejected as input the hand is free to scroll; while a
            // finger can draw, the browser must not steal the gesture.
            touchAction: ink.penOnly ? 'pan-x pan-y' : 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        >
          <div
            className='flex w-max min-w-full flex-col items-center'
            style={{ gap: PAGE_GAP, padding: PAGE_GAP }}
          >
            {pages.map((index) => (
              <NotePage
                key={index}
                index={index}
                strokes={ink.strokesOfPage(index)}
                width={pageWidth}
                height={pageHeight}
                pageRef={registerPage(index)}
                revision={ink.revision}
              />
            ))}
          </div>
        </div>
        {/* The stroke still under the pen, drawn over the pages it crosses. */}
        <canvas ref={attachLiveCanvas} className='pointer-events-none absolute inset-0 z-10' />
      </div>
      <div
        className={clsx(
          'eink-bordered bg-base-100 border-base-300/50 relative z-20 flex items-center',
          'no-scrollbar box-content h-13 gap-2 overflow-x-auto border-t px-3',
        )}
        style={{ paddingBottom: `${(safeAreaInsets?.bottom ?? 0) / 3}px` }}
      >
        {optionsOpen && (
          <div className='eink-bordered bg-base-100 border-base-300/50 not-eink:shadow-md absolute bottom-full start-3 mb-2 rounded-2xl border px-3 py-2'>
            <HandwritingOptions
              tool={ink.tool}
              color={ink.color}
              width={ink.width}
              onSelectColor={choose(ink.selectColor)}
              onSelectWidth={choose(ink.selectWidth)}
            />
          </div>
        )}
        <div className='flex shrink-0 items-center gap-2'>
          {TOOLS.map(({ tool, label, Icon }) => {
            const active = !ink.erasing && ink.tool === tool;
            return (
              <button
                key={tool}
                type='button'
                aria-label={_(label)}
                aria-pressed={active}
                aria-expanded={active ? optionsOpen : undefined}
                onClick={() => {
                  if (active) {
                    setOptionsOpen((open) => !open);
                  } else {
                    setOptionsOpen(false);
                    ink.selectTool(tool);
                  }
                }}
                className={clsx(
                  'relative flex h-8 min-h-8 w-8 items-center justify-center rounded-md p-0',
                  active ? 'bg-base-300 eink:border' : 'not-eink:hover:bg-base-200',
                )}
              >
                <Icon />
                {active && (
                  <span
                    className='absolute bottom-1 h-0.5 w-3.5 rounded-full'
                    style={{ backgroundColor: ink.color }}
                  />
                )}
              </button>
            );
          })}
          <div className={clsx('rounded-md', ink.erasing && 'bg-base-300 eink:border')}>
            <AnnotationToolButton
              showTooltip
              tooltipText={_('Eraser')}
              Icon={RiEraserLine}
              onClick={() => ink.setErasing(!ink.erasing)}
            />
          </div>
          <AnnotationToolButton
            showTooltip
            tooltipText={_('Undo')}
            Icon={RiArrowGoBackLine}
            onClick={ink.undo}
          />
          <AnnotationToolButton
            showTooltip
            tooltipText={_('Redo')}
            Icon={RiArrowGoForwardLine}
            onClick={ink.redo}
          />
        </div>

        <div className='bg-base-content/15 h-6 w-px shrink-0' />

        {/* Pages: move between them, and add one at the end. The chevrons are
            rotated a quarter turn because the pages stack downwards. */}
        <div className='flex shrink-0 items-center gap-1'>
          <button
            type='button'
            aria-label={_('Previous Page')}
            disabled={currentPage === 0}
            onClick={() => goToPage(currentPage - 1)}
            className={clsx(
              'flex h-8 min-h-8 w-8 items-center justify-center rounded-md p-0',
              currentPage === 0 ? 'cursor-not-allowed opacity-40' : 'not-eink:hover:bg-base-200',
            )}
          >
            <RiArrowLeftSLine className='rotate-90' />
          </button>
          <span className='text-base-content/70 shrink-0 whitespace-nowrap text-xs tabular-nums'>
            {currentPage + 1} / {ink.pageCount}
          </span>
          <button
            type='button'
            aria-label={_('Next Page')}
            disabled={currentPage >= ink.pageCount - 1}
            onClick={() => goToPage(currentPage + 1)}
            className={clsx(
              'flex h-8 min-h-8 w-8 items-center justify-center rounded-md p-0',
              currentPage >= ink.pageCount - 1
                ? 'cursor-not-allowed opacity-40'
                : 'not-eink:hover:bg-base-200',
            )}
          >
            <RiArrowRightSLine className='rotate-90' />
          </button>
          <AnnotationToolButton
            showTooltip
            tooltipText={_('Add Page')}
            Icon={MdAdd}
            onClick={handleAddPage}
          />
        </div>

        <div className='bg-base-content/15 h-6 w-px shrink-0' />

        {/* Zoom, as plain glyphs so the dock carries no icon for it. */}
        <div className='flex shrink-0 items-center gap-1'>
          <button
            type='button'
            aria-label={_('Zoom Out')}
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value / ZOOM_STEP))}
            className={clsx(
              'flex h-8 min-h-8 w-8 items-center justify-center rounded-md p-0 text-base leading-none',
              zoom <= MIN_ZOOM ? 'cursor-not-allowed opacity-40' : 'not-eink:hover:bg-base-200',
            )}
          >
            −
          </button>
          <span className='text-base-content/70 w-10 shrink-0 text-center text-xs tabular-nums'>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type='button'
            aria-label={_('Zoom In')}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value * ZOOM_STEP))}
            className={clsx(
              'flex h-8 min-h-8 w-8 items-center justify-center rounded-md p-0 text-base leading-none',
              zoom >= MAX_ZOOM ? 'cursor-not-allowed opacity-40' : 'not-eink:hover:bg-base-200',
            )}
          >
            +
          </button>
        </div>

        <div className='ms-auto flex shrink-0 items-center gap-2'>
          {/* Palm rejection: with this on, only a stylus draws — and a finger
              scrolls instead. */}
          <div className={clsx('rounded-md', ink.penOnly && 'bg-base-300 eink:border')}>
            <AnnotationToolButton
              showTooltip
              tooltipText={_('Stylus Only')}
              Icon={RiQuillPenLine}
              onClick={() => ink.setPenOnly(!ink.penOnly)}
            />
          </div>
          <AnnotationToolButton
            showTooltip
            tooltipText={_('Save')}
            Icon={RiSave3Line}
            onClick={handleSave}
          />
          <AnnotationToolButton
            showTooltip
            tooltipText={_('Close')}
            Icon={RiCloseLine}
            onClick={handleClose}
          />
        </div>
      </div>
    </div>
  );
};

export default QuickNoteEditor;
