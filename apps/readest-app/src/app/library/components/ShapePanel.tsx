import clsx from 'clsx';
import React, { useMemo, useState } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { SHAPE_GROUPS, isClosed, shapePoints, type ShapeKind } from '@/services/handwriting/shapes';
import {
  MAX_SHAPE_MM,
  MIN_SHAPE_MM,
  PEN_COLORS,
  SHAPE_STEP_MM,
  roundShapeMm,
  type ShapeSettings,
} from '@/services/notes/penSettings';
import { ColorRail, SliderRow, SwitchRow, ToolPanel } from './ToolPanelParts';

/** What each shape is called, for the label a long press shows. */
const SHAPE_LABELS: Record<ShapeKind, string> = {
  line: 'Line',
  wave: 'Wavy line',
  curve: 'Curve',
  arrow: 'Arrow',
  'double-arrow': 'Double arrow',
  angle: 'Angle',
  'right-angle': 'Right angle',
  axes: 'Axes',
  brace: 'Brace',
  triangle: 'Triangle',
  'triangle-isoceles': 'Isoceles triangle',
  'triangle-right': 'Right triangle',
  square: 'Square',
  rectangle: 'Rectangle',
  'rounded-rectangle': 'Rounded rectangle',
  parallelogram: 'Parallelogram',
  trapezoid: 'Trapezoid',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  octagon: 'Octagon',
  circle: 'Circle',
  ellipse: 'Ellipse',
  stadium: 'Stadium',
  star: 'Star',
};

/** Six to a row, as the reference app lays them out. */
const PER_PAGE = 12;

/**
 * Each shape's own geometry, drawn small. No icon is kept for a shape: the
 * button shows the thing itself, built by the same function that draws it on
 * the page, so a button can never show one shape and draw another.
 */
const ShapeIcon: React.FC<{ kind: ShapeKind; className?: string }> = ({ kind, className }) => {
  const d = useMemo(() => {
    // Drawn in a square box, so the icon is the shape's own proportions
    // rather than the page's.
    const points = shapePoints(kind, [0.12, 0.12], [0.88, 0.88], 1);
    return points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * 36).toFixed(2)} ${(y * 36).toFixed(2)}`)
      .join(' ');
  }, [kind]);

  return (
    <svg viewBox='0 0 36 36' className={className} aria-hidden='true'>
      <path
        d={d}
        fill='none'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
};

interface ShapePanelProps {
  shape: ShapeSettings;
  onChange: (patch: Partial<ShapeSettings>) => void;
}

/**
 * The shape tool's panel: which shape a drag draws, how thick its outline is,
 * in what colour, and whether a closed one is filled.
 *
 * The shapes are paged rather than scrolled, so the thickness and colour
 * below them stay where they are as the pages turn.
 */
const ShapePanel: React.FC<ShapePanelProps> = ({ shape, onChange }) => {
  const _ = useTranslation();
  const kinds = useMemo(() => SHAPE_GROUPS.flatMap((group) => group.kinds), []);
  const pages = useMemo(() => {
    const out: ShapeKind[][] = [];
    for (let i = 0; i < kinds.length; i += PER_PAGE) out.push(kinds.slice(i, i + PER_PAGE));
    return out;
  }, [kinds]);
  const [page, setPage] = useState(() =>
    Math.max(0, Math.floor(kinds.indexOf(shape.kind) / PER_PAGE)),
  );
  const showing = pages[Math.min(page, pages.length - 1)] ?? [];

  return (
    <ToolPanel title={_('Shape')}>
      <div className='grid grid-cols-6 gap-1'>
        {showing.map((kind) => {
          const active = shape.kind === kind;
          const label = SHAPE_LABELS[kind];
          return (
            <button
              key={kind}
              type='button'
              aria-label={_(label)}
              aria-pressed={active}
              title={_(label)}
              onClick={() => onChange({ kind })}
              className={clsx(
                'flex aspect-square items-center justify-center rounded-lg p-1',
                'transition-colors duration-150',
                active ? 'bg-base-300 eink:border' : 'not-eink:hover:bg-base-200',
              )}
            >
              <ShapeIcon
                kind={kind}
                className={clsx(
                  'h-full w-full',
                  active ? 'text-base-content' : 'text-base-content/55',
                )}
              />
            </button>
          );
        })}
      </div>

      {pages.length > 1 && (
        <div className='flex items-center justify-center gap-2'>
          {pages.map((_unused, index) => (
            <button
              key={index}
              type='button'
              aria-label={`${_('Page')} ${index + 1}`}
              aria-pressed={index === page}
              onClick={() => setPage(index)}
              className={clsx(
                'h-1.5 rounded-full transition-all duration-150',
                index === page ? 'bg-base-content w-5' : 'bg-base-content/25 w-1.5',
              )}
            />
          ))}
        </div>
      )}

      <SliderRow
        label={_('Stroke thickness')}
        display={`${shape.thicknessMm.toFixed(2)}mm`}
        min={MIN_SHAPE_MM}
        max={MAX_SHAPE_MM}
        step={SHAPE_STEP_MM}
        value={shape.thicknessMm}
        onChange={(mm) => onChange({ thicknessMm: roundShapeMm(mm) })}
      />

      <ColorRail
        label={_('Stroke colour')}
        colors={PEN_COLORS}
        value={shape.color}
        onChange={(color) => onChange({ color })}
      />

      <SwitchRow
        boxed
        label={_('Shape fill')}
        hint={isClosed(shape.kind) ? undefined : _('The shape chosen does not close')}
        checked={shape.fill}
        onChange={(fill) => onChange({ fill })}
      />
    </ToolPanel>
  );
};

export default ShapePanel;
