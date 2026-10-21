import { useCallback, useEffect, useRef, useState } from 'react';

import { HandwritingEditor } from '@/services/handwriting/editor';
import { HandwritingService } from '@/services/handwriting/handwritingService';
import { renderStrokes } from '@/services/handwriting/renderer';
import { type InkStroke, type InkTool } from '@/services/handwriting/model';
import {
  boundsOf,
  clampMove,
  duplicateStrokes,
  maxScale,
  moveStrokes,
  scaleStrokes,
  strokesByIds,
  type Bounds,
} from '@/services/handwriting/selection';
import {
  DEFAULT_ERASER,
  DEFAULT_HIGHLIGHTER,
  DEFAULT_LASSO,
  DEFAULT_PEN,
  DEFAULT_SHAPE,
  eraserRadiusFraction,
  mmToFraction,
  type EraserSettings,
  type HighlighterSettings,
  type LassoSettings,
  type PenSettings,
  type ShapeSettings,
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
  const [highlighter, setHighlighter] = useState<HighlighterSettings>(DEFAULT_HIGHLIGHTER);
  const [lasso, setLasso] = useState<LassoSettings>(DEFAULT_LASSO);
  const [shape, setShape] = useState<ShapeSettings>(DEFAULT_SHAPE);
  const [erasing, setErasing] = useState(false);
  const [lassoing, setLassoing] = useState(false);
  const [shaping, setShaping] = useState(false);
  /** The ids the lasso caught; empty when nothing is picked up. */
  const [selection, setSelection] = useState<string[]>([]);
  const [penOnly, setPenOnlyState] = useState(false);
  const [revision, setRevision] = useState(0);

  const marker = tool === 'marker';
  const color = marker ? highlighter.color : pen.color;
  // Both are set in millimetres on an A4 page; the engine works in fractions
  // of the page, which is what survives a change of screen.
  const width = mmToFraction(marker ? highlighter.thicknessMm : pen.thicknessMm);

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
    // Repaint on every committed change, not only the ones the service made
    // itself: moving or deleting a selection goes to the editor directly, and
    // the canvas has to follow it.
    const unsubscribe = editor.subscribe(() => {
      setRevision((n) => n + 1);
      paint();
    });
    return () => {
      unsubscribe();
    };
  }, [editor, paint]);

  // The latest tool settings, readable when the service is built. The canvas
  // and the measured page arrive in either order, so construction cannot rely
  // on an effect having run first.
  const engineOptions = {
    tool,
    color,
    widthFraction: width,
    penOnly,
    nib: marker ? highlighter.tip : pen.nib,
    sensitivity: pen.sensitivity,
    stabilization: pen.stabilization,
    // Only the highlighter offers it, so the pen is never straightened.
    straightLine: marker && highlighter.straightLine,
    eraseRadiusFraction: eraserRadiusFraction(eraser.sizeMm),
    eraseMode: eraser.mode,
    eraseTarget: eraser.target,
    eraserPressure: eraser.pressure,
    lassoShape: lasso.shape,
    lassoKinds: lasso.kinds,
    shapeKind: shape.kind,
    shapeColor: shape.color,
    shapeWidth: mmToFraction(shape.thicknessMm),
    shapeFill: shape.fill,
  };
  const optionsRef = useRef(engineOptions);
  optionsRef.current = engineOptions;
  const erasingRef = useRef(erasing);
  erasingRef.current = erasing;
  const autoDeselectRef = useRef(eraser.autoDeselect);
  autoDeselectRef.current = eraser.autoDeselect;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  /**
   * What a selection drag started from: the ink as it was when the hand went
   * down, so every frame transforms the original rather than compounding on
   * the frame before it, and one gesture id so the whole drag undoes at once.
   */
  const dragRef = useRef<{ strokes: InkStroke[]; bounds: Bounds; gesture: string } | null>(null);
  /** Counts drags, so two in the same millisecond cannot share an undo step. */
  const dragCount = useRef(0);

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
    service.onSelect(setSelection);
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
      nib: marker ? highlighter.tip : pen.nib,
      sensitivity: pen.sensitivity,
      stabilization: pen.stabilization,
      straightLine: marker && highlighter.straightLine,
      eraseRadiusFraction: eraserRadiusFraction(eraser.sizeMm),
      eraseMode: eraser.mode,
      eraseTarget: eraser.target,
      eraserPressure: eraser.pressure,
      lassoShape: lasso.shape,
      lassoKinds: lasso.kinds,
      shapeKind: shape.kind,
      shapeColor: shape.color,
      shapeWidth: mmToFraction(shape.thicknessMm),
      shapeFill: shape.fill,
    });
  }, [
    tool,
    marker,
    color,
    width,
    penOnly,
    pen.nib,
    pen.sensitivity,
    pen.stabilization,
    highlighter.tip,
    highlighter.straightLine,
    eraser.sizeMm,
    eraser.mode,
    eraser.target,
    eraser.pressure,
    lasso.shape,
    lasso.kinds,
    shape.kind,
    shape.color,
    shape.thicknessMm,
    shape.fill,
  ]);

  useEffect(() => {
    serviceRef.current?.setEraseMode(erasing);
  }, [erasing]);

  useEffect(() => {
    serviceRef.current?.setShapeMode(shaping);
  }, [shaping]);

  useEffect(() => {
    serviceRef.current?.setLassoMode(lassoing);
    // Putting the lasso down lets go of what it was holding: a selection box
    // left floating over the page while the pen is back in hand is a trap.
    if (!lassoing) setSelection([]);
  }, [lassoing]);

  const selectTool = useCallback((next: InkTool) => {
    setErasing(false);
    setLassoing(false);
    setShaping(false);
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

  /** Changes one or more of the highlighter's settings, leaving the rest. */
  const updateHighlighter = useCallback(
    (patch: Partial<HighlighterSettings>) =>
      setHighlighter((current) => ({ ...current, ...patch })),
    [],
  );

  /** Changes one or more of the lasso's settings, leaving the rest alone. */
  const updateLasso = useCallback(
    (patch: Partial<LassoSettings>) => setLasso((current) => ({ ...current, ...patch })),
    [],
  );

  /** Changes one or more of the shape tool's settings, leaving the rest alone. */
  const updateShape = useCallback(
    (patch: Partial<ShapeSettings>) => setShape((current) => ({ ...current, ...patch })),
    [],
  );

  // One tool is in the hand at a time: picking up the eraser puts the lasso
  // down, and the other way round.
  const chooseEraser = useCallback((on: boolean) => {
    setErasing(on);
    if (on) {
      setLassoing(false);
      setShaping(false);
    }
  }, []);

  const chooseLasso = useCallback((on: boolean) => {
    setLassoing(on);
    if (on) {
      setErasing(false);
      setShaping(false);
    }
  }, []);

  const chooseShape = useCallback((on: boolean) => {
    setShaping(on);
    if (on) {
      setErasing(false);
      setLassoing(false);
    }
  }, []);

  /** The box round the picked-up ink, or null when nothing is picked up. */
  const selectionBounds = selection.length
    ? boundsOf(strokesByIds(editor.strokes(PAGE), selection))
    : null;

  /**
   * Takes hold of the selection for a drag or a resize, returning the box it
   * started in. Null when there is nothing to take hold of.
   */
  const beginSelectionDrag = useCallback((): Bounds | null => {
    const picked = strokesByIds(editor.strokes(PAGE), selectionRef.current);
    const bounds = boundsOf(picked);
    if (!bounds) return null;
    dragCount.current += 1;
    dragRef.current = { strokes: picked, bounds, gesture: `sel-${dragCount.current}` };
    return bounds;
  }, [editor]);

  /** Moves the held selection to `dx`, `dy` from where the drag began. */
  const moveSelectionTo = useCallback(
    (dx: number, dy: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const [cx, cy] = clampMove(drag.bounds, dx, dy);
      editor.replaceStrokes(PAGE, moveStrokes(drag.strokes, cx, cy), drag.gesture);
    },
    [editor],
  );

  /**
   * Resizes the held selection to `factor` of the size it began at, about
   * its top-left corner — the corner left in place while the opposite one is
   * dragged — and never past the edge of the page.
   */
  const scaleSelectionTo = useCallback(
    (factor: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const origin: [number, number] = [drag.bounds.left, drag.bounds.top];
      const capped = Math.min(factor, maxScale(drag.bounds, origin));
      editor.replaceStrokes(PAGE, scaleStrokes(drag.strokes, origin, capped), drag.gesture);
    },
    [editor],
  );

  /** Lets go. The next drag takes its own hold, and its own undo step. */
  const endSelectionDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const deleteSelection = useCallback(() => {
    editor.removeStrokes(PAGE, selectionRef.current);
    setSelection([]);
  }, [editor]);

  /** Copies the selection; the copy is what stays picked up. */
  const duplicateSelection = useCallback(() => {
    const picked = strokesByIds(editor.strokes(PAGE), selectionRef.current);
    if (picked.length === 0) return;
    const copies = duplicateStrokes(picked);
    editor.addStrokes(PAGE, copies);
    setSelection(copies.map((stroke) => stroke.id));
  }, [editor]);

  const clearSelection = useCallback(() => setSelection([]), []);

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
    pen,
    updatePen,
    highlighter,
    updateHighlighter,
    eraser,
    updateEraser,
    lasso,
    updateLasso,
    shape,
    updateShape,
    shaping,
    setShaping: chooseShape,
    clearPage,
    erasing,
    setErasing: chooseEraser,
    lassoing,
    setLassoing: chooseLasso,
    selection,
    selectionBounds,
    beginSelectionDrag,
    moveSelectionTo,
    scaleSelectionTo,
    endSelectionDrag,
    deleteSelection,
    duplicateSelection,
    clearSelection,
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
