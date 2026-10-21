import {
  DEFAULT_HIGHLIGHTER_TIP,
  DEFAULT_NIB,
  type InkNib,
} from '@/services/handwriting/nibs';

/**
 * A note page is A4, so a pen's width can be quoted in millimetres rather
 * than as a fraction of the page — which is what a pen is actually sold as,
 * and what the panel shows.
 */
export const PAGE_WIDTH_MM = 210;

export const mmToFraction = (mm: number) => mm / PAGE_WIDTH_MM;
export const fractionToMm = (fraction: number) => fraction * PAGE_WIDTH_MM;

/** The thickness range the slider covers: a fine liner up to a broad marker. */
export const MIN_THICKNESS_MM = 0.1;
export const MAX_THICKNESS_MM = 5;
export const THICKNESS_STEP_MM = 0.05;

/** Rounds a thickness to the slider's step, avoiding 0.30000000000000004mm. */
export const roundThicknessMm = (mm: number) =>
  Math.round(Math.min(MAX_THICKNESS_MM, Math.max(MIN_THICKNESS_MM, mm)) / THICKNESS_STEP_MM) *
  THICKNESS_STEP_MM;

/** Everything the pen panel sets, for one pen. */
export interface PenSettings {
  nib: InkNib;
  /** Width in millimetres on the page. */
  thicknessMm: number;
  /** 0..1; how much pressure changes the width. */
  sensitivity: number;
  /** 0..1; how much the stroke is smoothed as it is drawn. */
  stabilization: number;
  color: string;
}

export const DEFAULT_PEN: PenSettings = {
  nib: DEFAULT_NIB,
  thicknessMm: 0.5,
  // Pressure on by default: it is the thing a stylus can do that a finger
  // cannot, and a pen that ignores it feels dead on a tablet.
  sensitivity: 0.7,
  stabilization: 0,
  color: '#1a1a1a',
};

/** The colours the panel offers, in swatch order; the first opens a picker. */
export const PEN_COLORS = ['#1a1a1a', '#c62828', '#1f6feb', '#00796b', '#e3a008'] as const;

/** Everything the highlighter panel sets. */
export interface HighlighterSettings {
  /** Which tip: a flat chisel, or a round fine one. */
  tip: InkNib;
  /** Band width in millimetres on the page. */
  thicknessMm: number;
  /**
   * Draw a straight line from where the pen goes down to where it lifts,
   * for underlining a line of text without a steady hand.
   */
  straightLine: boolean;
  color: string;
}

/** A highlighter runs from a thin underline to a band several lines deep. */
export const MIN_HIGHLIGHTER_MM = 1;
export const MAX_HIGHLIGHTER_MM = 20;
export const HIGHLIGHTER_STEP_MM = 0.5;

export const roundHighlighterMm = (mm: number) =>
  Math.round(
    Math.min(MAX_HIGHLIGHTER_MM, Math.max(MIN_HIGHLIGHTER_MM, mm)) / HIGHLIGHTER_STEP_MM,
  ) * HIGHLIGHTER_STEP_MM;

export const DEFAULT_HIGHLIGHTER: HighlighterSettings = {
  tip: DEFAULT_HIGHLIGHTER_TIP,
  thicknessMm: 5,
  straightLine: false,
  color: '#facc15',
};

/** Highlighter colours, in swatch order; the first opens a picker. */
export const HIGHLIGHTER_COLORS = [
  '#facc15',
  '#fb923c',
  '#4ade80',
  '#60a5fa',
  '#f472b6',
] as const;
