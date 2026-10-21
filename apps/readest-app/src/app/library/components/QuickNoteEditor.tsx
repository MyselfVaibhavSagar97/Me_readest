import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiCloseLine,
  RiEraserLine,
  RiMarkPenLine,
  RiPencilLine,
  RiQuillPenLine,
  RiSave3Line,
} from 'react-icons/ri';
import type { IconType } from 'react-icons';

import Dialog from '@/components/Dialog';
import { eventDispatcher } from '@/utils/event';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import type { InkTool } from '@/services/handwriting/model';
import { QUICK_NOTE_ASPECT, type QuickNote } from '@/types/notes';
import AnnotationToolButton from '@/app/reader/components/annotator/AnnotationToolButton';
import HandwritingOptions from '@/app/reader/components/handwriting/HandwritingOptions';
import PenPanel from './PenPanel';
import EraserPanel from './EraserPanel';
import { useQuickNoteInk } from '../hooks/useQuickNoteInk';

/**
 * The page is paper, not a themed surface: stored ink keeps the colour it was
 * drawn with, so a dark page would hide black ink in dark mode and on e-ink.
 */
const PAPER = '#fdfdfb';

const TOOLS: { tool: InkTool; label: string; Icon: IconType }[] = [
  { tool: 'pen', label: 'Pen', Icon: RiPencilLine },
  { tool: 'marker', label: 'Marker', Icon: RiMarkPenLine },
];

/** The largest page of note aspect that fits inside `box`. */
const fitPage = (box: DOMRect) => {
  const width = Math.min(box.width, box.height * QUICK_NOTE_ASPECT);
  return { width, height: width / QUICK_NOTE_ASPECT };
};

interface QuickNoteEditorProps {
  note: QuickNote;
  /** Writes the note's ink to the library's notes; does not close the editor. */
  onPersist: (note: QuickNote) => void;
  onClose: () => void;
}

/**
 * Full-screen editor for one standalone handwritten note: a blank page, the
 * reader's ink engine, and a dock of drawing tools. Drawn with a stylus
 * (pressure included), a finger, or a mouse; "Stylus only" rejects the hand
 * entirely so a tablet can be written on with the palm resting on the glass.
 */
const QuickNoteEditor: React.FC<QuickNoteEditorProps> = ({ note, onPersist, onClose }) => {
  const _ = useTranslation();
  const { safeAreaInsets } = useThemeStore();
  const areaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Which tool has its settings dropped down, if any.
  const [openPanel, setOpenPanel] = useState<InkTool | 'eraser' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const ink = useQuickNoteInk(note);
  const { attachCanvas, setPageRect, strokes } = ink;

  // How big the page can be, from the space left above the dock. Re-measured
  // on resize and rotation; the ink follows because it is stored normalized.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const next = fitPage(el.getBoundingClientRect());
      if (next.width > 0 && next.height > 0) setSize(next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Where that page actually landed on screen. Measured from the canvas after
  // it is laid out, since the pointer backend maps clientX/clientY through it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const box = canvas.getBoundingClientRect();
    setPageRect({ left: box.left, top: box.top, width: box.width, height: box.height });
  }, [size, setPageRect]);

  const setCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvasRef.current = el;
      attachCanvas(el);
    },
    [attachCanvas],
  );

  // Closing saves too: handwriting is too easy to lose to make Save the only
  // way out. A note scribbled by accident is removed from the notes list.
  const persist = useCallback(
    () => onPersist({ ...note, ink: strokes(), updatedAt: Date.now() }),
    [note, onPersist, strokes],
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

  const choose =
    <T,>(select: (value: T) => void) =>
    (value: T) => {
      select(value);
      setOpenPanel(null);
    };

  return (
    <div
      role='dialog'
      aria-label={_('Quick Note')}
      className='bg-base-200 fixed inset-0 z-50 flex flex-col'
    >
      <div
        className={clsx(
          'eink-bordered bg-base-100 border-base-300/50 relative z-10 flex items-center',
          'box-content h-13 justify-between border-b px-3',
        )}
        style={{ paddingTop: `${safeAreaInsets?.top ?? 0}px` }}
      >
        {openPanel && (
          <>
            {/* Tapping anywhere else closes the panel, including on the page,
                where a tap would otherwise leave a dot of ink behind it. */}
            <button
              type='button'
              aria-label={_('Close')}
              tabIndex={-1}
              onClick={() => setOpenPanel(null)}
              className='fixed inset-0 z-0 cursor-default'
            />
            <div
              className={clsx(
                'eink-bordered bg-base-100 border-base-300/50 not-eink:shadow-md',
                'absolute top-full start-3 z-10 mt-2 rounded-2xl border px-3 py-3',
              )}
            >
              {openPanel === 'pen' && <PenPanel pen={ink.pen} onChange={ink.updatePen} />}
              {openPanel === 'eraser' && (
                <EraserPanel
                  eraser={ink.eraser}
                  onChange={ink.updateEraser}
                  onClearPage={() => setConfirmClear(true)}
                />
              )}
              {openPanel === 'marker' && (
                <HandwritingOptions
                  tool={ink.tool}
                  color={ink.color}
                  width={ink.width}
                  onSelectColor={choose(ink.selectColor)}
                  onSelectWidth={choose(ink.selectWidth)}
                />
              )}
            </div>
          </>
        )}
        <div className='flex items-center gap-2'>
          {TOOLS.map(({ tool, label, Icon }) => {
            const active = !ink.erasing && ink.tool === tool;
            return (
              <button
                key={tool}
                type='button'
                aria-label={_(label)}
                aria-pressed={active}
                aria-expanded={active ? openPanel === tool : undefined}
                onClick={() => {
                  if (active) {
                    setOpenPanel((open) => (open === tool ? null : tool));
                  } else {
                    setOpenPanel(null);
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
              onClick={() => {
                // Picking the eraser selects it; tapping it again opens its
                // settings, exactly as the pen behaves.
                if (ink.erasing) {
                  setOpenPanel((open) => (open === 'eraser' ? null : 'eraser'));
                } else {
                  setOpenPanel(null);
                  ink.setErasing(true);
                }
              }}
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
        <div className='flex items-center gap-2'>
          {/* Palm rejection: with this on, only a stylus draws. */}
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
      {confirmClear && (
        <Dialog
          isOpen
          title={_('Clear current page?')}
          boxClassName='h-auto! max-h-[80vh]! sm:max-w-sm'
          onClose={() => setConfirmClear(false)}
        >
          <div className='flex flex-col gap-3'>
            <p className='text-sm'>
              {_('This rubs out everything on the page. Undo will bring it back.')}
            </p>
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setConfirmClear(false)}
                className='btn btn-ghost btn-sm rounded-lg'
              >
                {_('Cancel')}
              </button>
              <button
                type='button'
                onClick={() => {
                  ink.clearPage();
                  setConfirmClear(false);
                  setOpenPanel(null);
                }}
                className='btn btn-error btn-sm rounded-lg'
              >
                {_('Clear')}
              </button>
            </div>
          </div>
        </Dialog>
      )}
      <div ref={areaRef} className='flex min-h-0 flex-1 items-center justify-center'>
        {size && (
          <canvas
            ref={setCanvas}
            aria-label={_('Note Page')}
            className='eink-bordered border-base-300/60 border'
            style={{
              width: size.width,
              height: size.height,
              backgroundColor: PAPER,
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default QuickNoteEditor;
