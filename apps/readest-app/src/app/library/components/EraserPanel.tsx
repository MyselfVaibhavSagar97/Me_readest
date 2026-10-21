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
  { mode: 'area', label: 'Erase ink', hint: 'Rubs out only what it passes over' },
  { mode: 'stroke', label: 'Erase whole stroke', hint: 'Removes any line it touches' },
];

interface EraserPanelProps {
  eraser: EraserSettings;
  onChange: (patch: Partial<EraserSettings>) => void;
}

/**
 * The eraser's settings, dropped down from the eraser in the toolbar: how
 * wide it is, and whether it rubs ink out where it passes or lifts a whole
 * line at a touch. The circle above the slider is the eraser at its true
 * size against the page, so the number means something.
 */
const EraserPanel: React.FC<EraserPanelProps> = ({ eraser, onChange }) => {
  const _ = useTranslation();
  // The preview strip stands for a third of the page across, so the circle
  // shown is the eraser as it will actually meet the paper.
  const previewSize = (eraser.sizeMm / (210 / 3)) * 100;

  return (
    <div className='flex w-64 max-w-[85vw] flex-col gap-4'>
      <p className='text-center text-sm font-medium'>{_('Eraser')}</p>

      <div
        className='eink-bordered border-base-300/50 flex h-16 items-center justify-center rounded-lg border'
        style={{ backgroundColor: '#fdfdfb' }}
      >
        <span
          aria-hidden='true'
          className='rounded-full border border-neutral-400 bg-neutral-200'
          style={{
            width: `${previewSize}%`,
            paddingBottom: `${previewSize}%`,
            maxWidth: '85%',
            maxHeight: '85%',
          }}
        />
      </div>

      <div className='flex flex-col gap-1'>
        <div className='flex items-baseline justify-between'>
          <span className='text-sm'>{_('Size')}</span>
          <span className='text-base-content/60 text-xs tabular-nums'>
            {eraser.sizeMm.toFixed(1)}mm
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

      <div className='flex flex-col gap-1.5'>
        {MODES.map(({ mode, label, hint }) => {
          const active = eraser.mode === mode;
          return (
            <button
              key={mode}
              type='button'
              aria-pressed={active}
              onClick={() => onChange({ mode })}
              className={clsx(
                'eink-bordered flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-start',
                'transition-colors duration-150',
                active
                  ? 'border-base-300 bg-base-200'
                  : 'border-base-200 not-eink:hover:bg-base-200/60',
              )}
            >
              <span className='text-sm'>{_(label)}</span>
              <span className='text-base-content/60 text-xs'>{_(hint)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EraserPanel;
