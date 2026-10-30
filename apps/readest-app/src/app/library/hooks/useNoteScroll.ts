import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type { PageRect } from '@/services/handwriting/coords';

/** How far past the end the page must be pulled before one is added. */
export const PULL_TO_ADD = 90;

interface UseNoteScrollOptions {
  pageCount: number;
  /** True while the hand scrolls rather than draws, so touch can pan. */
  panWithFinger: boolean;
  onPageRects: (rects: (PageRect | null)[]) => void;
  onAddPage: () => void;
}

/**
 * The scrolling note: panning it with a finger, telling the ink engine where
 * each page is, and adding a page when the stack is pulled past its end.
 *
 * The surface keeps `touch-action: none`, which is not negotiable — that CSS
 * property cannot tell a pen from a finger, and letting the browser take
 * gestures on a drawing surface means it also takes pen strokes and cancels
 * them mid-stroke. So the view does its own scrolling, from pointer events,
 * which is the one place a finger and a stylus can actually be told apart.
 */
export const useNoteScroll = ({
  pageCount,
  panWithFinger,
  onPageRects,
  onAddPage,
}: UseNoteScrollOptions) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<(HTMLDivElement | null)[]>([]);
  /** How far the stack has been pulled past its end, in pixels. */
  const [pull, setPull] = useState(0);
  const pan = useRef<{ id: number; y: number; pulled: number } | null>(null);

  /** Where each page is on screen, which is what the ink engine needs. */
  const measure = useCallback(() => {
    const rects = pagesRef.current.slice(0, pageCount).map((el): PageRect | null => {
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    });
    onPageRects(rects);
  }, [onPageRects, pageCount]);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, pageCount]);

  /** Which page a point on screen is over. */
  const pageAt = useCallback(
    (clientY: number): number => {
      let best = 0;
      let bestDistance = Infinity;
      pagesRef.current.slice(0, pageCount).forEach((el, index) => {
        if (!el) return;
        const box = el.getBoundingClientRect();
        const distance = Math.max(box.top - clientY, 0, clientY - box.bottom);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    },
    [pageCount],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!panWithFinger || event.pointerType !== 'touch') return;
      pan.current = { id: event.pointerId, y: event.clientY, pulled: 0 };
    },
    [panWithFinger],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const held = pan.current;
      const el = scrollRef.current;
      if (!held || !el || event.pointerId !== held.id) return;
      const dy = event.clientY - held.y;
      held.y = event.clientY;
      const max = el.scrollHeight - el.clientHeight;
      const next = el.scrollTop - dy;
      if (next > max) {
        // Past the end: the stack stops and the pull shows instead, which is
        // what offers the new page.
        el.scrollTop = max;
        held.pulled = Math.min(held.pulled + (next - max), PULL_TO_ADD * 2);
        setPull(held.pulled);
      } else {
        el.scrollTop = Math.max(0, next);
        if (held.pulled > 0) {
          held.pulled = Math.max(0, held.pulled + dy);
          setPull(held.pulled);
        }
      }
      measure();
    },
    [measure],
  );

  const endPan = useCallback(() => {
    const held = pan.current;
    pan.current = null;
    if (!held) return;
    if (held.pulled >= PULL_TO_ADD) onAddPage();
    setPull(0);
  }, [onAddPage]);

  /** Shows a page that has just been added rather than leaving it below. */
  const scrollToPage = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      const page = pagesRef.current[index];
      if (!el || !page) return;
      // The surface itself, not scrollIntoView, which would also move
      // whatever is behind this full-screen editor.
      el.scrollTop += page.getBoundingClientRect().top - el.getBoundingClientRect().top - 16;
      measure();
    },
    [measure],
  );

  const setPageEl = useCallback((index: number, el: HTMLDivElement | null) => {
    pagesRef.current[index] = el;
  }, []);

  return {
    scrollRef,
    setPageEl,
    pageAt,
    measure,
    scrollToPage,
    /** How far past the end the stack is being pulled, in pixels. */
    pull,
    pulling: pull > 0,
    readyToAdd: pull >= PULL_TO_ADD,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPan,
      onPointerCancel: endPan,
    },
  };
};
