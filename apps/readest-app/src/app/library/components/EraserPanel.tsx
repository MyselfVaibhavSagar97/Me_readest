import clsx from 'clsx';
import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import type { EraseMode } from '@/services/handwriting/editor';
import {
  ERASER_STEP_MM,
  MAX_ERASER_MM,
  MIN_ERASER_MM,
  roundEraserMm,
  type EraserSettings,
} from '@/services/notes/penSettings';

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

const SwitchRow: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <label className='flex cursor-pointer items-center justify-between gap-3'>
    <span className='flex min-w-0 flex-col'>
      <span className='text-sm'>{label}</span>
      {hint && <span className='text-base-content/55 text-xs'>{hint}</span>}
    </span>
    <input
      type='checkbox'
      role='switch'
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className='toggle toggle-sm shrink-0'
    />
  </label>
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
  // The preview strip stands for a third of the page across, so the circle
  // shown is the eraser as it will actually meet the paper.
  const previewSize = (eraser.sizeMm / (210 / 3)) * 100;

  return (
    <div className='flex w-72 max-w-[85vw] flex-col gap-4'>
      <p className='text-center text-sm font-medium'>{_('Eraser')}</p>

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
          <div
            className='eink-bordered border-base-300/50 flex h-14 items-center justify-center rounded-lg border'
            style={{ backgroundColor: '#fdfdfb' }}
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

          <div className='flex flex-col gap-1'>
            <div className='flex items-baseline justify-between'>
              <span className='text-sm'>{_('Size')}</span>
              <span className='text-base-content/60 text-xs tabular-nums'>
                {eraser.sizeMm.toFixed(2)}mm
              </span>
            </div>
            <input
              type='range'
              className='range range-xs'
              aria-label={_('Size')}
              min={MIN_ERASER_MM}
              max={MAX_ERASER_MM}
              step={ERASER_STEP_MM}
              value={eraser.sizeMm}
              onChange={(event) => onChange({ sizeMm: roundEraserMm(Number(event.target.value)) })}
            />
          </div>

          <div className='eink-bordered border-base-200 rounded-lg border px-3 py-2'>
            <SwitchRow
              label={_('Pressure-sensitive eraser')}
              checked={eraser.pressure}
              onChange={(pressure) => onChange({ pressure })}
            />
          </div>
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
    </div>
  );
};

export default EraserPanel;
