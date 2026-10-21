import clsx from 'clsx';
import React, { useMemo } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
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
import {
  ColorRail,
  PREVIEW_PAGE_FRACTION,
  SliderRow,
  StrokePreview,
  ToolPanel,
} from './ToolPanelParts';

const NIB_LABELS: Partial<Record<InkNib, string>> = {
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
  const shapes: Partial<Record<InkNib, React.ReactNode>> = {
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
      {shapes[nib] ?? null}
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
  const sample = useMemo(
    () => [
      {
        id: 'pen-preview',
        color: pen.color,
        width: mmToFraction(pen.thicknessMm) * PREVIEW_PAGE_FRACTION,
        nib: pen.nib,
        sensitivity: pen.sensitivity,
        points: PREVIEW_POINTS,
      },
    ],
    [pen.color, pen.thicknessMm, pen.nib, pen.sensitivity],
  );

  return (
    <ToolPanel title={_(`${NIB_LABELS[pen.nib] ?? pen.nib} pen`)}>
      <div className='flex items-end justify-between gap-1'>
        {INK_NIBS.map((nib) => {
          const active = pen.nib === nib;
          return (
            <button
              key={nib}
              type='button'
              aria-label={_(NIB_LABELS[nib] ?? nib)}
              aria-pressed={active}
              title={_(NIB_LABELS[nib] ?? nib)}
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

      <StrokePreview className='h-16' strokes={sample} />

      <SliderRow
        label={_('Pressure sensitivity')}
        display={`${Math.round(pen.sensitivity * 100)}%`}
        min={0}
        max={1}
        step={0.05}
        value={pen.sensitivity}
        onChange={(sensitivity) => onChange({ sensitivity })}
      />

      <SliderRow
        label={_('Thickness')}
        display={`${pen.thicknessMm.toFixed(2)}mm`}
        min={MIN_THICKNESS_MM}
        max={MAX_THICKNESS_MM}
        step={THICKNESS_STEP_MM}
        value={pen.thicknessMm}
        onChange={(mm) => onChange({ thicknessMm: roundThicknessMm(mm) })}
      />

      <SliderRow
        label={_('Stroke Stabilization')}
        display={`${Math.round(pen.stabilization * 100)}%`}
        min={0}
        max={1}
        step={0.05}
        value={pen.stabilization}
        onChange={(stabilization) => onChange({ stabilization })}
      />

      <ColorRail
        label={_('Colour')}
        colors={PEN_COLORS}
        value={pen.color}
        onChange={(color) => onChange({ color })}
      />
    </ToolPanel>
  );
};

export default PenPanel;
