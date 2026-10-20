import { useCallback, useEffect, useRef, useState } from 'react';

import { HandwritingEditor } from '@/services/handwriting/editor';
import { HandwritingService } from '@/services/handwriting/handwritingService';
import { renderStrokes } from '@/services/handwriting/renderer';
import {
  nearestPageIndex,
  notePageKey,
  pageCountOf,
  pagesFromNote,
  strokesForNote,
} from '@/services/notes/notePages';
import {
  DEFAULT_HANDWRITING_COLOR,
  DEFAULT_HANDWRITING_WIDTH,
  DEFAULT_MARKER_COLOR,
  DEFAULT_MARKER_WIDTH,
  type InkStroke,
  type InkTool,
} from '@/services/handwriting/model';
import type { PageRect } from '@/services/handwriting/coords';
import type { QuickNote } from '@/types/notes';

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

const rectOf = (el: Element): PageRect => {
  const box = el.getBoundingClientRect();
  return { left: box.left, top: box.top, width: box.width, height: box.height };
};

/**
 * Drawing for one standalone note, across its pages.
 *
 * The pages scroll as one surface, so input is taken from that whole surface
 * and each finished stroke is routed to the page it was drawn over — the same
 * arrangement the reader uses for a scrolled book. Committed ink is painted by
 * each page onto its own canvas; only the stroke still under the pen goes on
 * an overlay, so a page repaints when its ink changes rather than on every
 * pointer frame.
 */
export const useQuickNoteInk = (note: QuickNote) => {
  const [editor] = useState(() => new HandwritingEditor(pagesFromNote(note)));
  const [pageCount, setPageCount] = useState(() => pageCountOf(note));
  const serviceRef = useRef<HandwritingService | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const surfaceRectRef = useRef<PageRect | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** The page elements, so a stroke can be placed against where they are now. */
  const pageEls = useRef<(HTMLElement | null)[]>([]);

  const [tool, setTool] = useState<InkTool>('pen');
  const [penColor, setPenColor] = useState(DEFAULT_HANDWRITING_COLOR);
  const [penWidth, setPenWidth] = useState<number>(DEFAULT_HANDWRITING_WIDTH);
  const [markerColor, setMarkerColor] = useState(DEFAULT_MARKER_COLOR);
  const [markerWidth, setMarkerWidth] = useState<number>(DEFAULT_MARKER_WIDTH);
  const [erasing, setErasing] = useState(false);
  const [penOnly, setPenOnlyState] = useState(false);
  const [revision, setRevision] = useState(0);

  const marker = tool === 'marker';
  const color = marker ? markerColor : penColor;
  const width = marker ? markerWidth : penWidth;

  // The remembered stylus-only choice, read on the client only: localStorage
  // does not exist while the page is prerendered.
  useEffect(() => setPenOnlyState(readPenOnly()), []);

  /** Repaints the in-progress stroke; committed ink belongs to the pages. */
  const paintLive = useCallback(() => {
    const canvas = liveCanvasRef.current;
    const rect = surfaceRectRef.current;
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
    // Live points are normalized to the input surface, which is what this
    // canvas covers, so they draw from its own origin.
    renderStrokes(ctx, serviceRef.current!.liveStrokes(), {
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

  const optionsRef = useRef({ tool, color, widthFraction: width, penOnly });
  optionsRef.current = { tool, color, widthFraction: width, penOnly };
  const erasingRef = useRef(erasing);
  erasingRef.current = erasing;

  /** Sends a stroke to the page it was drawn over, re-normalized to it. */
  const route = useCallback((windowPoints: readonly (readonly number[])[]) => {
    if (!windowPoints.length) return null;
    const xs = windowPoints.map((p) => p[0]!);
    const ys = windowPoints.map((p) => p[1]!);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    // Measured fresh on every stroke, so scrolling and zooming need no
    // bookkeeping: where the pages are now is where the ink lands.
    const rects = pageEls.current.map((el) => (el ? rectOf(el) : null));
    const index = nearestPageIndex(rects, cx, cy);
    const rect = index === null ? null : rects[index];
    if (index === null || !rect) return null;
    return { page: notePageKey(index), rect, anchoring: null };
  }, []);

  const ensureAttached = useCallback(() => {
    const el = surfaceRef.current;
    const rect = surfaceRectRef.current;
    if (!el || !rect || serviceRef.current) return;
    const service = new HandwritingService(editor, notePageKey(0), rect);
    service.onNeedsRender(paintLive);
    // setOptions (rather than constructor options) also derives the eraser
    // radius from the pen width, so the eraser always matches the tool.
    service.setOptions(optionsRef.current);
    service.setEraseMode(erasingRef.current);
    service.setRouter(route);
    serviceRef.current = service;
    void service.attach(el).then(paintLive);
  }, [editor, paintLive, route]);

  /**
   * The input surface's bounds in viewport coordinates: the pointer backend
   * maps clientX/clientY through them. Page positions are read from the DOM
   * as each stroke lands, so scrolling needs no bookkeeping here.
   */
  const setSurfaceRect = useCallback(
    (rect: PageRect) => {
      surfaceRectRef.current = rect;
      if (serviceRef.current) {
        serviceRef.current.updateRect(rect);
        paintLive();
      } else {
        ensureAttached();
      }
    },
    [ensureAttached, paintLive],
  );

  /** Ref callback for the scrolling element that takes pen input. */
  const attachSurface = useCallback(
    (el: HTMLElement | null) => {
      surfaceRef.current = el;
      if (!el) {
        void serviceRef.current?.detach();
        serviceRef.current = null;
        return;
      }
      ensureAttached();
    },
    [ensureAttached],
  );

  const attachLiveCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      liveCanvasRef.current = el;
      paintLive();
    },
    [paintLive],
  );

  /** Ref callback for one page, so strokes can be placed against it. */
  const registerPage = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      pageEls.current[index] = el;
    },
    [],
  );

  useEffect(() => {
    serviceRef.current?.setOptions({ tool, color, widthFraction: width, penOnly });
  }, [tool, color, width, penOnly]);

  useEffect(() => {
    serviceRef.current?.setEraseMode(erasing);
  }, [erasing]);

  const selectTool = useCallback((next: InkTool) => {
    setErasing(false);
    setTool(next);
  }, []);

  const selectColor = useCallback(
    (next: string) => (marker ? setMarkerColor(next) : setPenColor(next)),
    [marker],
  );

  const selectWidth = useCallback(
    (next: number) => (marker ? setMarkerWidth(next) : setPenWidth(next)),
    [marker],
  );

  const setPenOnly = useCallback((next: boolean) => {
    setPenOnlyState(next);
    writePenOnly(next);
  }, []);

  const addPage = useCallback(() => setPageCount((count) => count + 1), []);

  /** The committed ink on one page, for that page to paint. */
  const strokesOfPage = useCallback(
    (index: number): readonly InkStroke[] => editor.strokes(notePageKey(index)),
    [editor],
  );

  /** The note's ink as it should be stored, each stroke carrying its page. */
  const strokes = useCallback(
    () => strokesForNote((key) => editor.strokes(key), pageCount),
    [editor, pageCount],
  );

  return {
    attachSurface,
    attachLiveCanvas,
    registerPage,
    setSurfaceRect,
    pageCount,
    addPage,
    strokesOfPage,
    tool,
    selectTool,
    color,
    width,
    selectColor,
    selectWidth,
    erasing,
    setErasing,
    penOnly,
    setPenOnly,
    undo: useCallback(() => serviceRef.current?.undo(), []),
    redo: useCallback(() => serviceRef.current?.redo(), []),
    strokes,
    /** Bumped on every committed change, so the pages repaint. */
    revision,
  };
};
