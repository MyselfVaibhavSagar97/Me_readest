import { useCallback, useEffect, useRef, useState } from 'react';

import { HandwritingEditor } from '@/services/handwriting/editor';
import { HandwritingService } from '@/services/handwriting/handwritingService';
import { renderStrokes } from '@/services/handwriting/renderer';
import {
  DEFAULT_MARKER_COLOR,
  DEFAULT_MARKER_WIDTH,
  type InkStroke,
  type InkTool,
} from '@/services/handwriting/model';
import {
  DEFAULT_ERASER,
  DEFAULT_PEN,
  eraserRadiusFraction,
  fractionToMm,
  mmToFraction,
  roundThicknessMm,
  type EraserSettings,
  type PenSettings,
} from '@/services/notes/penSettings';
import type { PageRect } from '@/services/handwriting/coords';
import type { QuickNote } from '@/types/notes';

/**
 * A quick note is one blank page, so the editor only ever has this one page
 * key — there is no book, section or spine position behind it.
 */
const PAGE = 'note';

const PEN_ONLY_KEY = 'quickNotePenOnly';

const readPenOnly = () => {
  try {
    return window.localStorage.getItem(PEN_ONLY_KEY) === '1';
  } catch {
    // Private mode and blocked site data both throw here.
    return false;
  }
};

const writePenOnly = (penOnly: boolean) => {
  try {
    window.localStorage.setItem(PEN_ONLY_KEY, penOnly ? '1' : '0');
  } catch {
    // Nothing to do: the toggle simply won't be remembered.
  }
};

/**
 * Drawing for one standalone note. Wraps the same ink engine the reader uses
 * (HandwritingService over HandwritingEditor), with no anchoring or paging:
 * strokes are normalized to the note's page and nothing else.
 *
 * The canvas is painted imperatively from the service's render callback, so a
 * stroke in progress never re-renders React; only committed changes (a
 * finished stroke, an erase, undo, redo) bump `revision` for the toolbar.
 */
export const useQuickNoteInk = (note: QuickNote) => {
  const [editor] = useState(
    () => new HandwritingEditor({ [PAGE]: { strokes: note.ink, updatedAt: note.updatedAt } }),
  );
  const serviceRef = useRef<HandwritingService | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rectRef = useRef<PageRect | null>(null);

  const [tool, setTool] = useState<InkTool>('pen');
  const [pen, setPen] = useState<PenSettings>(DEFAULT_PEN);
  const [eraser, setEraser] = useState<EraserSettings>(DEFAULT_ERASER);
  const [markerColor, setMarkerColor] = useState(DEFAULT_MARKER_COLOR);
  const [markerWidth, setMarkerWidth] = useState<number>(DEFAULT_MARKER_WIDTH);
  const [erasing, setErasing] = useState(false);
  const [penOnly, setPenOnlyState] = useState(false);
  const [revision, setRevision] = useState(0);

  const marker = tool === 'marker';
  const color = marker ? markerColor : pen.color;
  // The pen is set in millimetres on an A4 page; the engine works in
  // fractions of the page, which is what survives a change of screen.
  const width = marker ? markerWidth : mmToFraction(pen.thicknessMm);

  // The remembered stylus-only choice, read on the client only: localStorage
  // does not exist while the page is prerendered.
  useEffect(() => setPenOnlyState(readPenOnly()), []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const rect = rectRef.current;
    const service = serviceRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !rect || !service) return;
    const dpr = window.devicePixelRatio || 1;
    const pxWidth = Math.max(1, Math.round(rect.width * dpr));
    const pxHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
      canvas.width = pxWidth;
      canvas.height = pxHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The canvas *is* the page, so ink draws from its own origin.
    renderStrokes(ctx, service.strokesForRender(), {
      left: 0,
      top: 0,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  useEffect(() => {
    const unsubscribe = editor.subscribe(() => setRevision((n) => n + 1));
    return () => {
      unsubscribe();
    };
  }, [editor]);

  // The latest tool settings, readable when the service is built. The canvas
  // and the measured page arrive in either order, so construction cannot rely
  // on an effect having run first.
  const engineOptions = {
    tool,
    color,
    widthFraction: width,
    penOnly,
    nib: pen.nib,
    sensitivity: pen.sensitivity,
    stabilization: pen.stabilization,
    eraseRadiusFraction: eraserRadiusFraction(eraser.sizeMm),
    eraseMode: eraser.mode,
    eraseTarget: eraser.target,
    eraserPressure: eraser.pressure,
  };
  const optionsRef = useRef(engineOptions);
  optionsRef.current = engineOptions;
  const erasingRef = useRef(erasing);
  erasingRef.current = erasing;
  const autoDeselectRef = useRef(eraser.autoDeselect);
  autoDeselectRef.current = eraser.autoDeselect;

  /** Builds the drawing session once both the canvas and the page are known. */
  const ensureAttached = useCallback(() => {
    const el = canvasRef.current;
    const rect = rectRef.current;
    if (!el || !rect || serviceRef.current) return;
    const service = new HandwritingService(editor, PAGE, rect);
    service.onNeedsRender(paint);
    // setOptions (rather than constructor options) also derives the eraser
    // radius from the pen width, so the eraser always matches the tool.
    service.setOptions(optionsRef.current);
    service.setEraseMode(erasingRef.current);
    service.onEraseEnd(() => {
      if (autoDeselectRef.current) setErasing(false);
    });
    serviceRef.current = service;
    void service.attach(el).then(paint);
  }, [editor, paint]);

  /**
   * The page's bounds in viewport coordinates: the pointer backend maps
   * clientX/clientY through them, so they must be where the page actually is
   * on screen, not where it sits inside its container.
   */
  const setPageRect = useCallback(
    (rect: PageRect) => {
      rectRef.current = rect;
      if (serviceRef.current) {
        serviceRef.current.updateRect(rect);
        paint();
      } else {
        ensureAttached();
      }
    },
    [ensureAttached, paint],
  );

  /** Canvas callback ref: the ink engine attaches here and leaves on unmount. */
  const attachCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvasRef.current = el;
      if (!el) {
        void serviceRef.current?.detach();
        serviceRef.current = null;
        return;
      }
      ensureAttached();
    },
    [ensureAttached],
  );

  useEffect(() => {
    serviceRef.current?.setOptions({
      tool,
      color,
      widthFraction: width,
      penOnly,
      nib: pen.nib,
      sensitivity: pen.sensitivity,
      stabilization: pen.stabilization,
      eraseRadiusFraction: eraserRadiusFraction(eraser.sizeMm),
      eraseMode: eraser.mode,
      eraseTarget: eraser.target,
      eraserPressure: eraser.pressure,
    });
  }, [
    tool,
    color,
    width,
    penOnly,
    pen.nib,
    pen.sensitivity,
    pen.stabilization,
    eraser.sizeMm,
    eraser.mode,
    eraser.target,
    eraser.pressure,
  ]);

  useEffect(() => {
    serviceRef.current?.setEraseMode(erasing);
  }, [erasing]);

  const selectTool = useCallback((next: InkTool) => {
    setErasing(false);
    setTool(next);
  }, []);

  /** Changes one or more of the eraser's settings, leaving the rest alone. */
  const updateEraser = useCallback(
    (patch: Partial<EraserSettings>) => setEraser((current) => ({ ...current, ...patch })),
    [],
  );

  /** Changes one or more of the pen's settings, leaving the rest alone. */
  const updatePen = useCallback(
    (patch: Partial<PenSettings>) => setPen((current) => ({ ...current, ...patch })),
    [],
  );

  const selectColor = useCallback(
    (next: string) => (marker ? setMarkerColor(next) : updatePen({ color: next })),
    [marker, updatePen],
  );

  const selectWidth = useCallback(
    (next: number) =>
      marker
        ? setMarkerWidth(next)
        : updatePen({ thicknessMm: roundThicknessMm(fractionToMm(next)) }),
    [marker, updatePen],
  );

  /** Rubs out everything on the page the editor is showing. */
  const clearPage = useCallback(() => serviceRef.current?.clear(), []);

  const setPenOnly = useCallback((next: boolean) => {
    setPenOnlyState(next);
    writePenOnly(next);
  }, []);

  /** The note's ink as it should be stored. */
  const strokes = useCallback((): InkStroke[] => [...editor.strokes(PAGE)], [editor]);

  return {
    attachCanvas,
    setPageRect,
    tool,
    selectTool,
    color,
    width,
    selectColor,
    selectWidth,
    pen,
    updatePen,
    eraser,
    updateEraser,
    clearPage,
    erasing,
    setErasing,
    penOnly,
    setPenOnly,
    undo: useCallback(() => serviceRef.current?.undo(), []),
    redo: useCallback(() => serviceRef.current?.redo(), []),
    strokes,
    /** Bumped on every committed change, so the toolbar can follow the ink. */
    revision,
    hasInk: editor.strokes(PAGE).length > 0,
  };
};
