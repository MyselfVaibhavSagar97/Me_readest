import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowUpLine,
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
import PenPanel from './PenPanel';
import EraserPanel from './EraserPanel';
import HighlighterPanel from './HighlighterPanel';
import LassoPanel from './LassoPanel';
import ShapePanel from './ShapePanel';
import LaserPanel from './LaserPanel';
import LaserLayer from './LaserLayer';
import PicturePanel, { PictureIcon } from './PicturePanel';
import NoteSelection from './NoteSelection';
import NotePage from './NotePage';
import { useNoteScroll, PULL_TO_ADD } from '../hooks/useNoteScroll';
import { useQuickNoteInk } from '../hooks/useQuickNoteInk';
import { useQuickNoteImages } from '../hooks/useQuickNoteImages';
import { useQuickNoteExport, type ExportAs } from '../hooks/useQuickNoteExport';

/**
 * The lasso: a dashed loop round ink, drawn rather than borrowed — no icon
 * set here has one. Sized in `em` like the react-icons beside it, since the
 * toolbar button renders an icon with no props of its own.
 */
const LassoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' className={className} aria-hidden='true'>
    <rect x='8' y='10' width='8' height='4' rx='1' fill='currentColor' opacity='0.4' />
    <path
      d='M5 12 C5 6.5, 19 6.5, 19 12 C19 17.5, 5 17.5, 5 12 Z'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeDasharray='3 2.5'
    />
  </svg>
);

/**
 * The shape tool: a square, a circle and a triangle overlapping, drawn rather
 * than borrowed. Sized in `em` like the icons beside it.
 */
const ShapeToolIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' className={className} aria-hidden='true'>
    <rect
      x='3.5'
      y='9.5'
      width='11'
      height='11'
      rx='1.5'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
    />
    <circle cx='16' cy='14.5' r='5.5' fill='none' stroke='currentColor' strokeWidth='1.6' />
    <path
      d='M12 2.5 L17.5 9.5 L6.5 9.5 Z'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinejoin='round'
    />
  </svg>
);

/**
 * The laser: a point of light throwing off rays. Sized in `em`, like the
 * icons beside it.
 */
const LaserToolIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' className={className} aria-hidden='true'>
    <circle cx='12' cy='12' r='3.2' fill='currentColor' />
    <g stroke='currentColor' strokeWidth='1.7' strokeLinecap='round'>
      <path d='M12 2.5 L12 5.5' />
      <path d='M12 18.5 L12 21.5' />
      <path d='M2.5 12 L5.5 12' />
      <path d='M18.5 12 L21.5 12' />
      <path d='M5.2 5.2 L7.3 7.3' />
      <path d='M16.7 16.7 L18.8 18.8' />
      <path d='M18.8 5.2 L16.7 7.3' />
      <path d='M7.3 16.7 L5.2 18.8' />
    </g>
  </svg>
);

/** Three dots: the usual "more" affordance, drawn to match the others. */
const MoreIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' className={className} aria-hidden='true'>
    <circle cx='12' cy='5' r='1.9' fill='currentColor' />
    <circle cx='12' cy='12' r='1.9' fill='currentColor' />
    <circle cx='12' cy='19' r='1.9' fill='currentColor' />
  </svg>
);

const EXPORTS: { as: ExportAs; label: string; hint: string }[] = [
  { as: 'pdf', label: 'Export as PDF', hint: 'One page, the size it was written' },
  { as: 'picture', label: 'Export as picture', hint: 'A PNG of the first page' },
];

const TOOLS: { tool: InkTool; label: string; Icon: IconType }[] = [
  { tool: 'pen', label: 'Pen', Icon: RiPencilLine },
  { tool: 'marker', label: 'Marker', Icon: RiMarkPenLine },
];

/**
 * How big a page is drawn: as large as fits the view, but never so tall that
 * a whole page cannot be seen at once — pages are scrolled through, so one
 * has to fit before the next begins.
 */
const fitPage = (box: DOMRect) => {
  const width = Math.min(box.width - 32, (box.height - 32) * QUICK_NOTE_ASPECT);
  return { width: Math.max(1, width), height: Math.max(1, width / QUICK_NOTE_ASPECT) };
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
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Which tool has its settings dropped down, if any.
  const [openPanel, setOpenPanel] = useState<
    InkTool | 'eraser' | 'lasso' | 'shape' | 'laser' | 'picture' | null
  >(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const ink = useQuickNoteInk(note);
  const pictures = useQuickNoteImages(note, () => ink.activePageRef.current);
  const { exportAs, exporting } = useQuickNoteExport(
    note.title,
    ink.strokes,
    pictures.images,
    pictures.urls,
    ink.pageCount,
  );
  /** The three-dot menu in the corner, open or not. */
  const [menuOpen, setMenuOpen] = useState(false);

  const scroll = useNoteScroll({
    pageCount: ink.pageCount,
    // A finger scrolls whenever the engine is not listening to it, which is
    // exactly when stylus-only is on. The two can then never fight over the
    // same contact.
    panWithFinger: ink.penOnly,
    onPageRects: ink.setPageRects,
    onAddPage: ink.addPage,
  });

  // Show a page that has just been added rather than leaving it below the
  // fold, and put the session on it so writing lands there.
  const pages = ink.pageCount;
  const seenPages = useRef(pages);
  useEffect(() => {
    if (pages > seenPages.current) {
      const added = pages - 1;
      requestAnimationFrame(() => {
        scroll.scrollToPage(added);
        ink.focusPage(added);
      });
    }
    seenPages.current = pages;
  }, [pages, scroll, ink]);
  /**
   * While the picture tool is in hand the pictures sit above the ink and
   * answer to the finger; with any other tool they are background, so
   * writing over them goes to the canvas as it always has.
   */
  const handlingPictures = openPanel === 'picture' || pictures.selected !== null;
  const { strokes } = ink;

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

  // Each page's box on screen is measured by the scrolling view, which is
  // the thing that knows where they have got to.

  // Closing saves too: handwriting is too easy to lose to make Save the only
  // way out. A note scribbled by accident is removed from the notes list.
  const persist = useCallback(
    () =>
      onPersist({
        ...note,
        ink: strokes(),
        images: pictures.images,
        updatedAt: Date.now(),
      }),
    [note, onPersist, pictures.images, strokes],
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
              {openPanel === 'marker' && (
                <HighlighterPanel
                  highlighter={ink.highlighter}
                  onChange={ink.updateHighlighter}
                />
              )}
              {openPanel === 'eraser' && (
                <EraserPanel
                  eraser={ink.eraser}
                  onChange={ink.updateEraser}
                  onClearPage={() => setConfirmClear(true)}
                />
              )}
              {openPanel === 'lasso' && (
                <LassoPanel lasso={ink.lasso} onChange={ink.updateLasso} />
              )}
              {openPanel === 'shape' && (
                <ShapePanel shape={ink.shape} onChange={ink.updateShape} />
              )}
              {openPanel === 'laser' && (
                <LaserPanel laser={ink.laser} onChange={ink.updateLaser} />
              )}
              {openPanel === 'picture' && (
                <PicturePanel
                  onInsertFromAlbum={() => void pictures.insertFromAlbum()}
                  onTakePhoto={() => void pictures.insertFromCamera()}
                  canTakePhoto={pictures.canTakePhoto}
                  inserting={pictures.inserting}
                  count={pictures.images.length}
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
          <div className={clsx('rounded-md', ink.lassoing && 'bg-base-300 eink:border')}>
            <AnnotationToolButton
              showTooltip
              tooltipText={_('Lasso')}
              Icon={LassoIcon}
              onClick={() => {
                // Same as the pen and the eraser: picking it up selects it,
                // tapping it again opens its settings.
                if (ink.lassoing) {
                  setOpenPanel((open) => (open === 'lasso' ? null : 'lasso'));
                } else {
                  setOpenPanel(null);
                  ink.setLassoing(true);
                }
              }}
            />
          </div>
          <div className={clsx('rounded-md', ink.shaping && 'bg-base-300 eink:border')}>
            <AnnotationToolButton
              showTooltip
              tooltipText={_('Shape')}
              Icon={ShapeToolIcon}
              onClick={() => {
                // Same as the pen: picking it up selects it, tapping it
                // again opens the choice of shape.
                if (ink.shaping) {
                  setOpenPanel((open) => (open === 'shape' ? null : 'shape'));
                } else {
                  setOpenPanel(null);
                  ink.setShaping(true);
                }
              }}
            />
          </div>
          <div className={clsx('rounded-md', ink.lasing && 'bg-base-300 eink:border')}>
            <AnnotationToolButton
              showTooltip
              tooltipText={_('Laser pointer')}
              Icon={LaserToolIcon}
              onClick={() => {
                if (ink.lasing) {
                  setOpenPanel((open) => (open === 'laser' ? null : 'laser'));
                } else {
                  setOpenPanel(null);
                  ink.setLasing(true);
                }
              }}
            />
          </div>
          {/* A picture is placed rather than drawn, so this opens its panel
              straight away instead of taking a turn in the hand first. */}
          <div className={clsx('rounded-md', openPanel === 'picture' && 'bg-base-300 eink:border')}>
            <AnnotationToolButton
              showTooltip
              tooltipText={_('Picture')}
              Icon={PictureIcon}
              onClick={() => {
                setOpenPanel((open) => (open === 'picture' ? null : 'picture'));
                ink.setLassoing(false);
                ink.setErasing(false);
                ink.setShaping(false);
                ink.setLasing(false);
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
          <div className='relative'>
            <div className={clsx('rounded-md', menuOpen && 'bg-base-300 eink:border')}>
              <AnnotationToolButton
                showTooltip
                tooltipText={_('More')}
                Icon={MoreIcon}
                onClick={() => setMenuOpen((open) => !open)}
              />
            </div>
            {menuOpen && (
              <>
                {/* Anywhere else closes it, including the page, where a tap
                    would otherwise leave a mark behind the menu. */}
                <button
                  type='button'
                  aria-label={_('Close')}
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className='fixed inset-0 z-0 cursor-default'
                />
                <div
                  role='menu'
                  aria-label={_('More')}
                  className={clsx(
                    'eink-bordered bg-base-100 border-base-300/50 not-eink:shadow-md',
                    'absolute end-0 top-full z-10 mt-2 w-56 rounded-xl border py-1',
                  )}
                >
                  {EXPORTS.map(({ as, label, hint }) => (
                    <button
                      key={as}
                      type='button'
                      role='menuitem'
                      disabled={exporting !== null}
                      onClick={() => {
                        setMenuOpen(false);
                        void exportAs(as);
                      }}
                      className='not-eink:hover:bg-base-200 flex w-full flex-col items-start px-3 py-2 text-start'
                    >
                      <span className='text-sm'>
                        {exporting === as ? _('Exporting…') : _(label)}
                      </span>
                      <span className='text-base-content/55 text-xs'>{_(hint)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
      {/* The stack of pages. The surface keeps `touch-action: none` — that
          property cannot tell a pen from a finger, and letting the browser
          take gestures here means it takes pen strokes too and cancels them
          mid-stroke. The view scrolls itself from pointer events instead,
          where the two can actually be told apart. */}
      <div
        ref={(el) => {
          scroll.scrollRef.current = el;
          areaRef.current = el;
          ink.attachSurface(el);
        }}
        className='no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain'
        style={{ touchAction: 'none' }}
        onPointerDownCapture={(event) => {
          // Point the session at the page the hand came down on, before the
          // ink engine sees the event.
          ink.focusPage(scroll.pageAt(event.clientY));
          if (handlingPictures) pictures.select(null);
        }}
        onScroll={scroll.measure}
        {...scroll.handlers}
      >
        <div className='flex flex-col items-center gap-4 py-4'>
          {size &&
            Array.from({ length: ink.pageCount }, (_unused, index) => (
              <NotePage
                key={index}
                index={index}
                width={size.width}
                height={size.height}
                images={pictures.images
                  .filter((image) => (image.page ?? 0) === index)
                  .map((image) => ({ image, url: pictures.urls[image.file] }))}
                handlingPictures={handlingPictures}
                onPickImage={pictures.select}
                pageRef={(el) => scroll.setPageEl(index, el)}
                canvasRef={(el) => ink.attachPageCanvas(index, el)}
              >
                {index === ink.activePageRef.current && (
                  <>
                    {/* Above the ink: light falls on what is on the page. */}
                    <LaserLayer
                      trail={ink.laserTrail}
                      settings={ink.laser}
                      width={size.width}
                      height={size.height}
                    />
                    {pictures.selected && pictures.selectedBounds && (
                      <NoteSelection
                        bounds={pictures.selectedBounds}
                        page={size}
                        onBegin={pictures.beginImageDrag}
                        onMove={pictures.moveImageTo}
                        onScale={pictures.scaleImageTo}
                        onEnd={pictures.endImageDrag}
                        onDelete={pictures.deleteSelectedImage}
                      />
                    )}
                    {ink.lassoing && ink.selectionBounds && (
                      <NoteSelection
                        bounds={ink.selectionBounds}
                        page={size}
                        onBegin={ink.beginSelectionDrag}
                        onMove={ink.moveSelectionTo}
                        onScale={ink.scaleSelectionTo}
                        onEnd={ink.endSelectionDrag}
                        onDelete={ink.deleteSelection}
                        onDuplicate={ink.duplicateSelection}
                      />
                    )}
                  </>
                )}
              </NotePage>
            ))}

          {/* Pull the stack past its end to add a page. */}
          <div
            aria-hidden={!scroll.pulling}
            className='flex flex-col items-center justify-center gap-2 overflow-hidden transition-all'
            style={{ height: Math.min(scroll.pull, PULL_TO_ADD * 1.4) }}
          >
            <RiArrowUpLine
              className={clsx(
                'h-5 w-5 transition-transform duration-150',
                scroll.readyToAdd ? 'text-primary' : 'text-base-content/40',
              )}
            />
            <span className='text-base-content/55 text-xs'>
              {scroll.readyToAdd ? _('Release to add a page') : _('Pull to add the new page')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickNoteEditor;
