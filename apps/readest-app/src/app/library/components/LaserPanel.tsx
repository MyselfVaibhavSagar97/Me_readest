import clsx from 'clsx';
import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import type { LaserMode } from '@/services/handwriting/laser';
import {
  LASER_COLORS,
  LASER_STEP_MM,
  LASER_STEP_SECONDS,
  MAX_LASER_MM,
  MAX_LASER_SECONDS,
  MIN_LASER_MM,
  MIN_LASER_SECONDS,
  roundLaserMm,
  roundLaserSeconds,
  type LaserSettings,
} from '@/services/notes/penSettings';
import { ColorRail, SliderRow, ToolPanel } from './ToolPanelParts';

const MODES: { mode: LaserMode; label: string }[] = [
  { mode: 'line', label: 'Line' },
  { mode: 'dot', label: 'Dot' },
];

/**
 * The two modes, drawn as the light they are: a glowing squiggle and a
 * glowing point, each lit in the colour the laser is set to.
 */
const ModeIcon: React.FC<{ mode: LaserMode; color: string; className?: string }> = ({
  mode,
  color,
  className,
}) => (
  <svg viewBox='0 0 40 40' className={className} aria-hidden='true'>
    <defs>
      <radialGradient id={`laser-glow-${mode}`}>
        <stop offset='0%' stopColor={color} stopOpacity='0.55' />
        <stop offset='100%' stopColor={color} stopOpacity='0' />
      </radialGradient>
    </defs>
    {mode === 'dot' ? (
      <>
        <circle cx='20' cy='20' r='14' fill={`url(#laser-glow-${mode})`} />
        <circle cx='20' cy='20' r='4' fill={color} />
        <circle cx='20' cy='20' r='1.6' fill='#ffffff' />
      </>
    ) : (
      <>
        <path
          d='M8 24 C14 10, 20 30, 26 16 C29 9, 31 13, 33 17'
          fill='none'
          stroke={color}
          strokeWidth='5'
          strokeLinecap='round'
          opacity='0.35'
        />
        <path
          d='M8 24 C14 10, 20 30, 26 16 C29 9, 31 13, 33 17'
          fill='none'
          stroke={color}
          strokeWidth='2'
          strokeLinecap='round'
        />
      </>
    )}
  </svg>
);

interface LaserPanelProps {
  laser: LaserSettings;
  onChange: (patch: Partial<LaserSettings>) => void;
}

/**
 * The laser pointer's settings: a line that follows the hand or a dot that
 * sits under it, how thick, how long it lasts before it has gone, and in
 * what colour.
 *
 * Nothing the laser draws is kept, so there is no fill, no nib and no
 * eraser here — only how it looks while it is there.
 */
const LaserPanel: React.FC<LaserPanelProps> = ({ laser, onChange }) => {
  const _ = useTranslation();

  return (
    <ToolPanel title={_('Laser pointer')}>
      <div className='flex items-end justify-center gap-8'>
        {MODES.map(({ mode, label }) => {
          const active = laser.mode === mode;
          return (
            <button
              key={mode}
              type='button'
              aria-label={_(label)}
              aria-pressed={active}
              title={_(label)}
              onClick={() => onChange({ mode })}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-lg p-2 transition-colors duration-150',
                active ? 'bg-base-300 eink:border' : 'not-eink:hover:bg-base-200',
              )}
            >
              <ModeIcon mode={mode} color={laser.color} className='h-12 w-12' />
              <span className='text-[11px] leading-tight'>{_(label)}</span>
            </button>
          );
        })}
      </div>

      <SliderRow
        label={_('Thickness')}
        display={`${laser.thicknessMm.toFixed(2)}mm`}
        min={MIN_LASER_MM}
        max={MAX_LASER_MM}
        step={LASER_STEP_MM}
        value={laser.thicknessMm}
        onChange={(mm) => onChange({ thicknessMm: roundLaserMm(mm) })}
      />

      <SliderRow
        label={_('Duration')}
        display={`${laser.seconds % 1 === 0 ? laser.seconds : laser.seconds.toFixed(1)}s`}
        min={MIN_LASER_SECONDS}
        max={MAX_LASER_SECONDS}
        step={LASER_STEP_SECONDS}
        value={laser.seconds}
        onChange={(seconds) => onChange({ seconds: roundLaserSeconds(seconds) })}
      />

      <ColorRail
        label={_('Colour')}
        colors={LASER_COLORS}
        value={laser.color}
        onChange={(color) => onChange({ color })}
      />
    </ToolPanel>
  );
};

export default LaserPanel;
