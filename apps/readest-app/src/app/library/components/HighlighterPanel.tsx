import clsx from 'clsx';
import React, { useMemo } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
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
import {
  ColorRail,
  PREVIEW_PAGE_FRACTION,
  SliderRow,
  StrokePreview,
  SwitchRow,
  ToolPanel,
} from './ToolPanelParts';

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
  const sample = useMemo(
    () => [
      {
        id: 'highlighter-preview',
        color: highlighter.color,
        width: mmToFraction(highlighter.thicknessMm) * PREVIEW_PAGE_FRACTION,
        tool: 'marker' as const,
        nib: highlighter.tip,
        points: highlighter.straightLine ? STRAIGHT_POINTS : PREVIEW_POINTS,
      },
    ],
    [highlighter.color, highlighter.thicknessMm, highlighter.tip, highlighter.straightLine],
  );

  return (
    <ToolPanel title={_('Highlighter')}>
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

      <StrokePreview className='h-16' strokes={sample} />

      <SliderRow
        label={_('Thickness')}
        display={`${highlighter.thicknessMm.toFixed(2)}mm`}
        min={MIN_HIGHLIGHTER_MM}
        max={MAX_HIGHLIGHTER_MM}
        step={HIGHLIGHTER_STEP_MM}
        value={highlighter.thicknessMm}
        onChange={(mm) => onChange({ thicknessMm: roundHighlighterMm(mm) })}
      />

      <SwitchRow
        label={_('Draw straight line')}
        checked={highlighter.straightLine}
        onChange={(straightLine) => onChange({ straightLine })}
      />

      <ColorRail
        label={_('Colour')}
        colors={HIGHLIGHTER_COLORS}
        value={highlighter.color}
        onChange={(color) => onChange({ color })}
      />
    </ToolPanel>
  );
};

export default HighlighterPanel;
