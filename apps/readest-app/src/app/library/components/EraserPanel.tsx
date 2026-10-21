import clsx from 'clsx';
import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import type { EraseMode } from '@/services/handwriting/editor';
import {
  ERASER_STEP_MM,
  MAX_ERASER_MM,
  MIN_ERASER_MM,
  PAGE_WIDTH_MM,
  roundEraserMm,
  type EraserSettings,
} from '@/services/notes/penSettings';
import {
  PAPER,
  PREVIEW_PAGE_FRACTION,
  SliderRow,
  SwitchRow,
  ToolPanel,
} from './ToolPanelParts';

const MODES: { mode: EraseMode; label: string; hint: string }[] = [
  { mode: 'area', label: 'Pixel erasure', hint: 'Rubs out only what it passes over' },
  { mode: 'stroke', label: 'Stroke erasure', hint: 'Removes any line it touches' },
  { mode: 'lasso', label: 'Circular selection', hint: 'Draw a loop; everything inside goes' },
];

/** The three modes, drawn: ink part-rubbed, ink taken whole, ink lassoed. */
const ModeIcon: React.FC<{ mode: EraseMode; className?: string }> = ({ mode, className }) => (
  <svg viewBox='0 0 36 24' className={className} aria-hidden='true'>
    <defs>
      <pattern id={`hatch-${mode}`} width='4' height='4' patternUnits='userSpaceOnUse'>
        <path d='M0 4 L4 0' stroke='currentColor' strokeWidth='1' opacity='0.6' />
      </pattern>
    </defs>
    {/* The ink: partly left behind, or gone entirely. */}
    {mode !== 'stroke' && (
      <rect x='3' y='8' width='10' height='8' rx='1.5' fill='currentColor' opacity='0.45' />
    )}
    {mode === 'lasso' ? (
      <rect
        x='14'
        y='5'
        width='18'
        height='14'
        rx='7'
        fill={`url(#hatch-${mode})`}
        stroke='currentColor'
        strokeWidth='1.2'
        strokeDasharray='3 2'
      />
    ) : (
      <circle
        cx='22'
        cy='12'
        r='7'
        fill={`url(#hatch-${mode})`}
        stroke='currentColor'
        strokeWidth='1.2'
      />
    )}
  </svg>
);

interface EraserPanelProps {
  eraser: EraserSettings;
  onChange: (patch: Partial<EraserSettings>) => void;
  /** Rubs out everything on the page; the caller confirms first. */
  onClearPage: () => void;
}

/**
 * The eraser's settings, dropped down from the eraser in the toolbar: how it
 * erases, how wide it is, what it is allowed to take, and whether it puts
 * the previous tool back afterwards. The circle above the slider is the
 * eraser at its true size against the page, so the number means something.
 */
const EraserPanel: React.FC<EraserPanelProps> = ({ eraser, onChange, onClearPage }) => {
  const _ = useTranslation();
  // The preview strip stands for a fraction of the page across, so the circle
  // shown is the eraser as it will actually meet the paper.
  const previewSize = (eraser.sizeMm / (PAGE_WIDTH_MM / PREVIEW_PAGE_FRACTION)) * 100;

  return (
    <ToolPanel title={_('Eraser')}>
      <div className='flex items-start justify-between gap-1'>
        {MODES.map(({ mode, label, hint }) => {
          const active = eraser.mode === mode;
          return (
            <button
              key={mode}
              type='button'
              aria-label={_(label)}
              aria-pressed={active}
              title={_(hint)}
              onClick={() => onChange({ mode })}
              className={clsx(
                'flex w-[31%] flex-col items-center gap-1 rounded-lg p-2',
                'transition-colors duration-150',
                active ? 'bg-base-300 eink:border' : 'not-eink:hover:bg-base-200',
              )}
            >
              <ModeIcon
                mode={mode}
                className={clsx('h-7 w-10', active ? 'text-base-content' : 'text-base-content/55')}
              />
              <span className='text-center text-[11px] leading-tight'>{_(label)}</span>
            </button>
          );
        })}
      </div>

      {eraser.mode !== 'lasso' && (
        <>
          {/* Not a StrokePreview: what matters here is the eraser's footprint
              against the paper, not ink. Same paper, same strip, no canvas. */}
          <div
            className='eink-bordered border-base-300/50 flex h-14 items-center justify-center rounded-lg border'
            style={{ backgroundColor: PAPER }}
          >
            <span
              aria-hidden='true'
              className='rounded-full border border-neutral-400 bg-neutral-200'
              style={{
                width: `${previewSize}%`,
                paddingBottom: `${previewSize}%`,
                maxWidth: '80%',
                maxHeight: '80%',
              }}
            />
          </div>

          <SliderRow
            label={_('Size')}
            display={`${eraser.sizeMm.toFixed(2)}mm`}
            min={MIN_ERASER_MM}
            max={MAX_ERASER_MM}
            step={ERASER_STEP_MM}
            value={eraser.sizeMm}
            onChange={(mm) => onChange({ sizeMm: roundEraserMm(mm) })}
          />

          <SwitchRow
            boxed
            label={_('Pressure-sensitive eraser')}
            checked={eraser.pressure}
            onChange={(pressure) => onChange({ pressure })}
          />
        </>
      )}

      <SwitchRow
        label={_('Erase highlighter only')}
        hint={_('Leaves pen ink alone')}
        checked={eraser.target === 'highlighter'}
        onChange={(only) => onChange({ target: only ? 'highlighter' : 'all' })}
      />

      <SwitchRow
        label={_('Auto-deselect eraser')}
        hint={_('Goes back to the previous tool after one rub')}
        checked={eraser.autoDeselect}
        onChange={(autoDeselect) => onChange({ autoDeselect })}
      />

      <button
        type='button'
        onClick={onClearPage}
        className='eink-bordered border-error/60 text-error btn btn-sm rounded-lg border bg-transparent'
      >
        {_('Clear current page')}
      </button>
    </ToolPanel>
  );
};

export default EraserPanel;
