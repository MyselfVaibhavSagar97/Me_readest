import clsx from 'clsx';
import React, { useEffect, useRef } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { renderStrokes } from '@/services/handwriting/renderer';
import { INK_NIBS, type InkNib } from '@/services/handwriting/nibs';
import type { InkPoint } from '@/services/handwriting/model';
import {
  MAX_THICKNESS_MM,
  MIN_THICKNESS_MM,
  PEN_COLORS,
  THICKNESS_STEP_MM,
  mmToFraction,
  roundThicknessMm,
  type PenSettings,
} from '@/services/notes/penSettings';

const NIB_LABELS: Record<InkNib, string> = {
  fountain: 'Fountain',
  calligraphy: 'Calligraphy',
  softpaint: 'Softpaint',
  ballpoint: 'Ballpoint',
  pencil: 'Pencil',
};

/**
 * The nibs, drawn rather than borrowed from an icon set: no icon pack has a
 * softpaint brush beside a calligraphy nib, and five shapes that read as one
 * family matter more here than five that merely exist.
 */
const NibIcon: React.FC<{ nib: InkNib; className?: string }> = ({ nib, className }) => {
  const shapes: Record<InkNib, React.ReactNode> = {
    fountain: (
      <>
        <path d='M12 2.5 L16 12 L12 21.5 L8 12 Z' fill='currentColor' />
        <path d='M12 9.5 L12 19' stroke='white' strokeWidth='1' opacity='0.55' />
        <circle cx='12' cy='11' r='1.1' fill='white' opacity='0.75' />
      </>
    ),
    calligraphy: (
      <>
        <path d='M9 3 L15 3 L14 13 L10 13 Z' fill='currentColor' />
        <path d='M10 13 L14 13 L15.5 20 L8.5 20 Z' fill='currentColor' opacity='0.75' />
        <path d='M8.5 20 L15.5 20' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
      </>
    ),
    softpaint: (
      <>
        <rect x='9.5' y='2.5' width='5' height='9' rx='1' fill='currentColor' />
        <path d='M9.5 11.5 Q12 22 14.5 11.5 Z' fill='currentColor' opacity='0.55' />
        <path d='M10.8 12 Q12 19 13.2 12 Z' fill='currentColor' />
      </>
    ),
    ballpoint: (
      <>
        <path d='M9.5 2.5 L14.5 2.5 L14.5 13 L12 16 L9.5 13 Z' fill='currentColor' />
        <path d='M11 16 L13 16 L12.6 20 L11.4 20 Z' fill='currentColor' opacity='0.7' />
        <circle cx='12' cy='20.6' r='1.3' fill='currentColor' />
      </>
    ),
    pencil: (
      <>
        <rect x='9.5' y='2.5' width='5' height='11' rx='0.6' fill='currentColor' />
        <path d='M9.5 13.5 L14.5 13.5 L12 21 Z' fill='currentColor' opacity='0.45' />
        <path d='M10.9 17.7 L13.1 17.7 L12 21 Z' fill='currentColor' />
      </>
    ),
  };
  return (
    <svg viewBox='0 0 24 24' className={className} aria-hidden='true'>
      {shapes[nib]}
    </svg>
  );
};

/**
 * A sample stroke for the preview: a squiggle that presses lightly at the
 * ends and firmly in the middle, so pressure and direction both show.
 */
const PREVIEW_POINTS: InkPoint[] = Array.from({ length: 72 }, (_unused, i): InkPoint => {
  const t = i / 71;
  return [
    0.08 + t * 0.84,
    0.5 + Math.sin(t * Math.PI * 2) * 0.3,
    0.18 + 0.78 * Math.sin(t * Math.PI),
  ];
});

/**
 * How much of a page the preview stands for. Widths are stored as a fraction
 * of the page, so the sample is scaled up to keep its thickness honest
 * against a strip this size rather than a whole sheet.
 */
const PREVIEW_PAGE_FRACTION = 3;

const PenPreview: React.FC<{ pen: PenSettings }> = ({ pen }) => {
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
          id: 'pen-preview',
          color: pen.color,
          width: mmToFraction(pen.thicknessMm) * PREVIEW_PAGE_FRACTION,
          nib: pen.nib,
          sensitivity: pen.sensitivity,
          points: PREVIEW_POINTS,
        },
      ],
      { left: 0, top: 0, width: box.width, height: box.height },
    );
  }, [pen]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className='eink-bordered border-base-300/50 h-16 w-full rounded-lg border'
      style={{ backgroundColor: '#fdfdfb' }}
    />
  );
};

interface SliderRowProps {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (value: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}) => (
  <div className='flex flex-col gap-1'>
    <div className='flex items-baseline justify-between'>
      <span className='text-sm'>{label}</span>
      <span className='text-base-content/60 text-xs tabular-nums'>{value}</span>
    </div>
    <input
      type='range'
      className='range range-xs'
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={current}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </div>
);

interface PenPanelProps {
  pen: PenSettings;
  onChange: (patch: Partial<PenSettings>) => void;
}

/**
 * The pen's settings, dropped down from the pen in the toolbar: which nib,
 * how hard it answers to pressure, how thick, how much the stroke is
 * smoothed, and in what colour — with a sample above them that redraws as
 * each one changes.
 */
const PenPanel: React.FC<PenPanelProps> = ({ pen, onChange }) => {
  const _ = useTranslation();
  const custom = !PEN_COLORS.includes(pen.color as (typeof PEN_COLORS)[number]);

  return (
    <div className='flex w-72 max-w-[85vw] flex-col gap-4'>
      <p className='text-center text-sm font-medium'>{_(`${NIB_LABELS[pen.nib]} pen`)}</p>

      <div className='flex items-end justify-between gap-1'>
        {INK_NIBS.map((nib) => {
          const active = pen.nib === nib;
          return (
            <button
              key={nib}
              type='button'
              aria-label={_(NIB_LABELS[nib])}
              aria-pressed={active}
              title={_(NIB_LABELS[nib])}
              onClick={() => onChange({ nib })}
              className={clsx(
                'flex h-12 w-10 items-center justify-center rounded-lg transition-colors duration-150',
                active ? 'bg-base-300 eink:border' : 'not-eink:hover:bg-base-200',
              )}
            >
              <NibIcon
                nib={nib}
                className={clsx('h-9 w-9', active ? 'text-base-content' : 'text-base-content/55')}
              />
            </button>
          );
        })}
      </div>

      <PenPreview pen={pen} />

      <SliderRow
        label={_('Pressure sensitivity')}
        value={`${Math.round(pen.sensitivity * 100)}%`}
        min={0}
        max={1}
        step={0.05}
        current={pen.sensitivity}
        onChange={(sensitivity) => onChange({ sensitivity })}
      />

      <SliderRow
        label={_('Thickness')}
        value={`${pen.thicknessMm.toFixed(2)}mm`}
        min={MIN_THICKNESS_MM}
        max={MAX_THICKNESS_MM}
        step={THICKNESS_STEP_MM}
        current={pen.thicknessMm}
        onChange={(mm) => onChange({ thicknessMm: roundThicknessMm(mm) })}
      />

      <SliderRow
        label={_('Stroke Stabilization')}
        value={`${Math.round(pen.stabilization * 100)}%`}
        min={0}
        max={1}
        step={0.05}
        current={pen.stabilization}
        onChange={(stabilization) => onChange({ stabilization })}
      />

      <div className='flex flex-col gap-1.5'>
        <span className='text-sm'>{_('Colour')}</span>
        <div className='eink-bordered border-base-200 flex items-center justify-between rounded-full border px-2 py-1.5'>
          {PEN_COLORS.map((hex, index) => {
            const selected = index === 0 ? custom || pen.color === hex : pen.color === hex;
            return index === 0 ? (
              // The first swatch is also the way to any other colour.
              <label
                key={hex}
                title={_('Pick a colour')}
                className={clsx(
                  'relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg',
                  selected && 'ring-primary ring-2 ring-offset-1',
                )}
                style={{ backgroundColor: custom ? pen.color : hex }}
              >
                <input
                  type='color'
                  aria-label={_('Pick a colour')}
                  value={pen.color}
                  onChange={(event) => onChange({ color: event.target.value })}
                  className='absolute inset-0 cursor-pointer opacity-0'
                />
                <span className='text-[9px] leading-none text-white opacity-80'>▾</span>
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

export default PenPanel;
