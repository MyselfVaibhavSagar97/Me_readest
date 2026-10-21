import clsx from 'clsx';
import React, { useEffect, useRef, type ReactNode } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { renderStrokes } from '@/services/handwriting/renderer';
import type { InkStroke } from '@/services/handwriting/model';
import { PAPER_COLOR } from '@/services/notes/penSettings';

/**
 * The pieces every tool panel is built from: the dropdown itself, a slider
 * row, a switch row, a colour rail and a sample strip.
 *
 * They live together on purpose. The pen, highlighter and eraser panels all
 * want the same chassis, and when the look of these changes — which is a
 * question of taste, not behaviour — it should change in one file rather
 * than in three panels that have drifted apart. Nothing here decides what a
 * tool does; that belongs to the engine and the settings modules.
 */

/** Paper, so ink in a preview reads at the colour it will be on the page. */
export const PAPER = PAPER_COLOR;

interface ToolPanelProps {
  title: string;
  children: ReactNode;
}

/** The dropdown body: a fixed, comfortable width with a title above it. */
export const ToolPanel: React.FC<ToolPanelProps> = ({ title, children }) => (
  <div className='flex w-72 max-w-[85vw] flex-col gap-4'>
    <p className='text-center text-sm font-medium'>{title}</p>
    {children}
  </div>
);

interface SliderRowProps {
  label: string;
  /** The value as the panel shows it, e.g. "0.50mm" or "70%". */
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

/** A labelled slider with its current value shown beside the label. */
export const SliderRow: React.FC<SliderRowProps> = ({
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}) => (
  <div className='flex flex-col gap-1'>
    <div className='flex items-baseline justify-between'>
      <span className='text-sm'>{label}</span>
      <span className='text-base-content/60 text-xs tabular-nums'>{display}</span>
    </div>
    <input
      type='range'
      className='range range-xs'
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </div>
);

interface SwitchRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Sets the row apart, for a switch that deserves more weight. */
  boxed?: boolean;
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  label,
  hint,
  checked,
  onChange,
  boxed,
}) => (
  <label
    className={clsx(
      'flex cursor-pointer items-center justify-between gap-3',
      boxed && 'eink-bordered border-base-200 rounded-lg border px-3 py-2',
    )}
  >
    <span className='flex min-w-0 flex-col'>
      <span className='text-sm'>{label}</span>
      {hint && <span className='text-base-content/55 text-xs'>{hint}</span>}
    </span>
    <input
      type='checkbox'
      role='switch'
      aria-label={label}
      // A checkbox announces itself as checked; a switch has to say so.
      aria-checked={checked}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className='toggle toggle-sm shrink-0'
    />
  </label>
);

interface ColorRailProps {
  label: string;
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
}

/**
 * The colour swatches. The first is also the way to any other colour: it
 * carries a colour input, so a palette of five never becomes a ceiling.
 */
export const ColorRail: React.FC<ColorRailProps> = ({ label, colors, value, onChange }) => {
  const _ = useTranslation();
  const custom = !colors.includes(value);

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-sm'>{label}</span>
      <div className='eink-bordered border-base-200 flex items-center justify-between rounded-full border px-2 py-1.5'>
        {colors.map((hex, index) => {
          const first = index === 0;
          const selected = first ? custom || value === hex : value === hex;
          const ring = selected ? 'ring-primary ring-2 ring-offset-1' : undefined;
          return first ? (
            <label
              key={hex}
              title={_('Pick a colour')}
              className={clsx(
                'relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg',
                ring,
              )}
              style={{ backgroundColor: custom ? value : hex }}
            >
              <input
                type='color'
                aria-label={_('Pick a colour')}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className='absolute inset-0 cursor-pointer opacity-0'
              />
              <span className='text-[9px] leading-none opacity-70'>▾</span>
            </label>
          ) : (
            <button
              key={hex}
              type='button'
              aria-label={_('Ink Color')}
              aria-pressed={selected}
              onClick={() => onChange(hex)}
              className={clsx('h-7 w-7 rounded-lg p-0', ring)}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>
    </div>
  );
};

interface StrokePreviewProps {
  /**
   * Drawn through the real renderer, so the sample is the truth. Memoize it
   * on the settings it is built from: the canvas redraws whenever this array
   * changes identity, and a fresh literal would redraw on every render.
   */
  strokes: InkStroke[];
  className?: string;
}

/**
 * A strip of paper with sample ink on it, redrawn whenever the strokes
 * change. It goes through `renderStrokes`, the same path the page uses, so a
 * preview can never quietly disagree with what the pen actually does.
 */
export const StrokePreview: React.FC<StrokePreviewProps> = ({ strokes, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokes(ctx, strokes, { left: 0, top: 0, width: box.width, height: box.height });
  }, [strokes]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className={clsx('eink-bordered border-base-300/50 w-full rounded-lg border', className)}
      style={{ backgroundColor: PAPER }}
    />
  );
};

/**
 * How much of a page a preview strip stands for. Stroke widths are stored as
 * a fraction of the page, so a sample is scaled up to stay honest against a
 * strip this size rather than a whole sheet.
 */
export const PREVIEW_PAGE_FRACTION = 3;
