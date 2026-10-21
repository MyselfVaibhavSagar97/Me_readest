import clsx from 'clsx';
import React, { useEffect, useRef } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { renderStrokes } from '@/services/handwriting/renderer';
import { HIGHLIGHTER_TIPS, type InkNib } from '@/services/handwriting/nibs';
import type { InkPoint } from '@/services/handwriting/model';
import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_STEP_MM,
  MAX_HIGHLIGHTER_MM,
  MIN_HIGHLIGHTER_MM,
  mmToFraction,
  roundHighlighterMm,
  type HighlighterSettings,
} from '@/services/notes/penSettings';

const TIP_LABELS: Partial<Record<InkNib, string>> = {
  chisel: 'Chisel',
  fine: 'Fine',
};

/**
 * The two tips, drawn rather than borrowed: a broad felt chisel and a slim
 * one. The chisel is wider and cut at an angle, which is also exactly how
 * the two differ on the page.
 */
const TipIcon: React.FC<{ tip: InkNib; className?: string }> = ({ tip, className }) => (
  <svg viewBox='0 0 24 24' className={className} aria-hidden='true'>
    {tip === 'chisel' ? (
      <>
        <rect x='6.5' y='6' width='11' height='12' rx='1' fill='currentColor' opacity='0.55' />
        <path d='M6.5 6 L17.5 6 L17.5 3.5 L10 3.5 Z' fill='currentColor' />
        <rect x='6.5' y='9.5' width='11' height='2.5' fill='currentColor' />
      </>
    ) : (
      <>
        <rect x='9' y='7' width='6' height='11' rx='1' fill='currentColor' opacity='0.55' />
        <path d='M9 7 L15 7 L13.5 3.5 L10.5 3.5 Z' fill='currentColor' />
        <rect x='9' y='10' width='6' height='2' fill='currentColor' />
      </>
    )}
  </svg>
);

/** A sample sweep, bent so a chisel tip's change of width shows. */
const PREVIEW_POINTS: InkPoint[] = Array.from({ length: 48 }, (_unused, i): InkPoint => {
  const t = i / 47;
  return [0.08 + t * 0.84, 0.5 + Math.sin(t * Math.PI) * -0.22];
});

const STRAIGHT_POINTS: InkPoint[] = [
  [0.08, 0.5],
  [0.92, 0.5],
];

/** How much of a page the preview strip stands for (see PenPanel). */
const PREVIEW_PAGE_FRACTION = 3;

const HighlighterPreview: React.FC<{ highlighter: HighlighterSettings }> = ({ highlighter }) => {
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
    renderStrokes(
      ctx,
      [
        {
          id: 'highlighter-preview',
          color: highlighter.color,
          width: mmToFraction(highlighter.thicknessMm) * PREVIEW_PAGE_FRACTION,
          tool: 'marker',
          nib: highlighter.tip,
          points: highlighter.straightLine ? STRAIGHT_POINTS : PREVIEW_POINTS,
        },
      ],
      { left: 0, top: 0, width: box.width, height: box.height },
    );
  }, [highlighter]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className='eink-bordered border-base-300/50 h-16 w-full rounded-lg border'
      style={{ backgroundColor: '#fdfdfb' }}
    />
  );
};

interface HighlighterPanelProps {
  highlighter: HighlighterSettings;
  onChange: (patch: Partial<HighlighterSettings>) => void;
}

/**
 * The highlighter's settings, dropped down from the highlighter in the
 * toolbar: which tip, how wide a band, whether it rules a straight line, and
 * in what colour — with a sample above them that redraws as each changes.
 */
const HighlighterPanel: React.FC<HighlighterPanelProps> = ({ highlighter, onChange }) => {
  const _ = useTranslation();
  const custom = !HIGHLIGHTER_COLORS.includes(
    highlighter.color as (typeof HIGHLIGHTER_COLORS)[number],
  );

  return (
    <div className='flex w-72 max-w-[85vw] flex-col gap-4'>
      <p className='text-center text-sm font-medium'>{_('Highlighter')}</p>

      <div className='flex items-end justify-center gap-6'>
        {HIGHLIGHTER_TIPS.map((tip) => {
          const active = highlighter.tip === tip;
          const label = TIP_LABELS[tip] ?? tip;
          return (
            <button
              key={tip}
              type='button'
              aria-label={_(label)}
              aria-pressed={active}
              title={_(label)}
              onClick={() => onChange({ tip })}
              className={clsx(
                'flex h-14 w-14 items-center justify-center rounded-lg transition-colors duration-150',
                active ? 'bg-base-300 eink:border' : 'not-eink:hover:bg-base-200',
              )}
            >
              <TipIcon
                tip={tip}
                className={clsx(
                  tip === 'chisel' ? 'h-10 w-10' : 'h-8 w-8',
                  active ? 'text-base-content' : 'text-base-content/55',
                )}
              />
            </button>
          );
        })}
      </div>

      <HighlighterPreview highlighter={highlighter} />

      <div className='flex flex-col gap-1'>
        <div className='flex items-baseline justify-between'>
          <span className='text-sm'>{_('Thickness')}</span>
          <span className='text-base-content/60 text-xs tabular-nums'>
            {highlighter.thicknessMm.toFixed(2)}mm
          </span>
        </div>
        <input
          type='range'
          className='range range-xs'
          aria-label={_('Thickness')}
          min={MIN_HIGHLIGHTER_MM}
          max={MAX_HIGHLIGHTER_MM}
          step={HIGHLIGHTER_STEP_MM}
          value={highlighter.thicknessMm}
          onChange={(event) =>
            onChange({ thicknessMm: roundHighlighterMm(Number(event.target.value)) })
          }
        />
      </div>

      <label className='flex cursor-pointer items-center justify-between gap-2'>
        <span className='text-sm'>{_('Draw straight line')}</span>
        <input
          type='checkbox'
          role='switch'
          aria-label={_('Draw straight line')}
          checked={highlighter.straightLine}
          onChange={(event) => onChange({ straightLine: event.target.checked })}
          className='toggle toggle-sm'
        />
      </label>

      <div className='flex flex-col gap-1.5'>
        <span className='text-sm'>{_('Colour')}</span>
        <div className='eink-bordered border-base-200 flex items-center justify-between rounded-full border px-2 py-1.5'>
          {HIGHLIGHTER_COLORS.map((hex, index) => {
            const selected =
              index === 0 ? custom || highlighter.color === hex : highlighter.color === hex;
            return index === 0 ? (
              // The first swatch is also the way to any other colour.
              <label
                key={hex}
                title={_('Pick a colour')}
                className={clsx(
                  'relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg',
                  selected && 'ring-primary ring-2 ring-offset-1',
                )}
                style={{ backgroundColor: custom ? highlighter.color : hex }}
              >
                <input
                  type='color'
                  aria-label={_('Pick a colour')}
                  value={highlighter.color}
                  onChange={(event) => onChange({ color: event.target.value })}
                  className='absolute inset-0 cursor-pointer opacity-0'
                />
                <span className='text-[9px] leading-none text-black/60'>▾</span>
              </label>
            ) : (
              <button
                key={hex}
                type='button'
                aria-label={_('Ink Color')}
                aria-pressed={selected}
                onClick={() => onChange({ color: hex })}
                className={clsx(
                  'h-7 w-7 rounded-lg p-0',
                  selected && 'ring-primary ring-2 ring-offset-1',
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HighlighterPanel;
