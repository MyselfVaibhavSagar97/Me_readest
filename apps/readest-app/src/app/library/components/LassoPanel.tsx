import clsx from 'clsx';
import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import {
  SELECTABLE_KINDS,
  type LassoShape,
  type SelectableKind,
} from '@/services/handwriting/selection';
import { withKind, type LassoSettings } from '@/services/notes/penSettings';
import { SwitchRow, ToolPanel } from './ToolPanelParts';

const SHAPES: { shape: LassoShape; label: string; hint: string }[] = [
  { shape: 'free', label: 'Free lasso', hint: 'Draw a loop freehand round what you want' },
  { shape: 'rect', label: 'Rectangular lasso', hint: 'Drag a box instead of drawing a loop' },
  {
    shape: 'accurate',
    label: 'Accurate lasso',
    hint: 'Takes only what is wholly inside the loop',
  },
];

/** What each kind of ink is called on its switch. */
const KIND_LABELS: Record<SelectableKind, string> = {
  handwriting: 'Handwriting',
  highlighter: 'Highlighter',
};

/**
 * The three shapes, drawn: a freehand loop, a dragged box, and a loop with a
 * pointer on it for the one that only takes what is wholly inside.
 */
const ShapeIcon: React.FC<{ shape: LassoShape; className?: string }> = ({ shape, className }) => (
  <svg viewBox='0 0 36 28' className={className} aria-hidden='true'>
    {/* The ink the loop is drawn around. */}
    <rect x='12' y='11' width='12' height='6' rx='1.5' fill='currentColor' opacity='0.35' />
    {shape === 'rect' ? (
      <rect
        x='7'
        y='6'
        width='22'
        height='16'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.4'
        strokeDasharray='3 2'
      />
    ) : (
      <path
        d='M9 14 C9 7, 27 7, 27 14 C27 21, 9 21, 9 14 Z'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.4'
        strokeDasharray='3 2'
      />
    )}
    {shape === 'accurate' && (
      <path d='M23 16 L30 21 L26.5 21.5 L25.5 25 Z' fill='currentColor' />
    )}
  </svg>
);

interface LassoPanelProps {
  lasso: LassoSettings;
  onChange: (patch: Partial<LassoSettings>) => void;
}

/**
 * The lasso's settings, dropped down from the lasso in the toolbar: how the
 * loop is drawn, and what it is allowed to pick up.
 *
 * The Selectable list holds a switch for every kind of thing the app can put
 * on a page. There are two today; as text boxes, pictures, shapes and the
 * rest arrive, each adds its own switch here. Nothing in this list is ever a
 * control that does nothing.
 */
const LassoPanel: React.FC<LassoPanelProps> = ({ lasso, onChange }) => {
  const _ = useTranslation();

  return (
    <ToolPanel title={_('Lasso')}>
      <div className='flex items-start justify-between gap-1'>
        {SHAPES.map(({ shape, label, hint }) => {
          const active = lasso.shape === shape;
          return (
            <button
              key={shape}
              type='button'
              aria-label={_(label)}
              aria-pressed={active}
              title={_(hint)}
              onClick={() => onChange({ shape })}
              className={clsx(
                'flex w-[31%] flex-col items-center gap-1 rounded-lg p-2',
                'transition-colors duration-150',
                active ? 'bg-base-300 eink:border' : 'not-eink:hover:bg-base-200',
              )}
            >
              <ShapeIcon
                shape={shape}
                className={clsx('h-7 w-10', active ? 'text-base-content' : 'text-base-content/55')}
              />
              <span className='text-center text-[11px] leading-tight'>{_(label)}</span>
            </button>
          );
        })}
      </div>

      <div className='flex flex-col gap-2'>
        <span className='text-base-content/55 border-base-200 border-b pb-1 text-xs'>
          {_('Selectable')}
        </span>
        {SELECTABLE_KINDS.map((kind) => (
          <SwitchRow
            key={kind}
            label={_(KIND_LABELS[kind])}
            checked={lasso.kinds.includes(kind)}
            onChange={(on) => onChange({ kinds: withKind(lasso.kinds, kind, on) })}
          />
        ))}
      </div>
    </ToolPanel>
  );
};

export default LassoPanel;
