import type { InkPoint } from './model';

/**
 * The shapes a drag can draw, as arithmetic.
 *
 * Every shape is built inside the box between where the hand went down and
 * where it let go, and comes back as the points of a single stroke — so a
 * drawn shape is ink like any other: erasable, lassoable, undoable, and
 * stored with the note without a line of new storage.
 *
 * The one thing to be careful of is that a stroke's points are fractions of
 * the page, and the page is taller than it is wide. Equal fractions are not
 * a square. Shapes that must be regular — a square, a circle, an equilateral
 * triangle — are built in a space where the two axes mean the same thing and
 * converted on the way out, which is what `aspect` is for.
 */

export type ShapeKind =
  | 'line'
  | 'wave'
  | 'curve'
  | 'arrow'
  | 'double-arrow'
  | 'angle'
  | 'right-angle'
  | 'axes'
  | 'brace'
  | 'triangle'
  | 'triangle-isoceles'
  | 'triangle-right'
  | 'square'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'circle'
  | 'ellipse'
  | 'stadium'
  | 'star';

/** The shapes, in the order the panel shows them, by the row they belong to. */
export const SHAPE_GROUPS: { label: string; kinds: ShapeKind[] }[] = [
  {
    label: 'Lines',
    kinds: ['line', 'wave', 'curve', 'arrow', 'double-arrow', 'brace'],
  },
  {
    label: 'Angles',
    kinds: ['angle', 'right-angle', 'axes'],
  },
  {
    label: 'Triangles',
    kinds: ['triangle', 'triangle-isoceles', 'triangle-right'],
  },
  {
    label: 'Quadrilaterals',
    kinds: ['square', 'rectangle', 'rounded-rectangle', 'parallelogram', 'trapezoid', 'diamond'],
  },
  {
    label: 'Polygons',
    kinds: ['pentagon', 'hexagon', 'octagon', 'star'],
  },
  {
    label: 'Curves',
    kinds: ['circle', 'ellipse', 'stadium'],
  },
];

export const SHAPE_KINDS: ShapeKind[] = SHAPE_GROUPS.flatMap((group) => group.kinds);

/** Shapes that come back to where they started, and so can be filled. */
const CLOSED = new Set<ShapeKind>([
  'triangle',
  'triangle-isoceles',
  'triangle-right',
  'square',
  'rectangle',
  'rounded-rectangle',
  'parallelogram',
  'trapezoid',
  'diamond',
  'pentagon',
  'hexagon',
  'octagon',
  'circle',
  'ellipse',
  'stadium',
  'star',
]);

export const isClosed = (kind: ShapeKind): boolean => CLOSED.has(kind);

/**
 * Shapes that keep their proportions however the box is dragged: a square is
 * a square, a circle is a circle. An isoceles triangle is not among them —
 * it is isoceles in any box, because it is built symmetrically about the
 * middle, and forcing it regular would only make it equilateral.
 */
const REGULAR = new Set<ShapeKind>(['square', 'circle', 'pentagon', 'hexagon', 'octagon', 'star']);

/** Whether this shape holds its proportions rather than filling the drag. */
export const isRegular = (kind: ShapeKind): boolean => REGULAR.has(kind);

/** How round a curve is drawn: enough segments that no corner shows. */
const CURVE_STEPS = 64;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The drag as a box. A shape is drawn the same whichever corner it was
 * dragged from, so a box is normalized before anything is built in it.
 *
 * `aspect` is the page's width ÷ height. For a shape that must be regular,
 * the box is squared off in screen terms — equal on both axes as the eye
 * sees it, which is a smaller height fraction than width fraction. It stays
 * anchored at the corner the drag began from, which is the one the hand is
 * not moving, so the shape grows out from under the pen.
 */
export const shapeBox = (from: InkPoint, to: InkPoint, kind: ShapeKind, aspect: number): Box => {
  let width = Math.abs(to[0] - from[0]);
  let height = Math.abs(to[1] - from[1]);
  if (REGULAR.has(kind)) {
    // One side, in screen terms, used for both — the smaller, so the shape
    // sits inside the box that was dragged rather than bursting out of it
    // and off the page.
    const side = Math.min(width, height / aspect);
    width = side;
    height = side * aspect;
  }
  return {
    left: to[0] < from[0] ? from[0] - width : from[0],
    top: to[1] < from[1] ? from[1] - height : from[1],
    width,
    height,
  };
};

/** A point from a 0..1 position inside the box. */
const at = (box: Box, u: number, v: number): InkPoint => [
  box.left + u * box.width,
  box.top + v * box.height,
];

/** A regular polygon of `sides`, point upwards, inscribed in the box. */
const polygon = (box: Box, sides: number, rotation = -Math.PI / 2): InkPoint[] => {
  const points: InkPoint[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    points.push(at(box, 0.5 + Math.cos(angle) / 2, 0.5 + Math.sin(angle) / 2));
  }
  points.push(points[0]!);
  return points;
};

/** An ellipse filling the box. */
const ellipse = (box: Box): InkPoint[] => {
  const points: InkPoint[] = [];
  for (let i = 0; i <= CURVE_STEPS; i += 1) {
    const angle = (i * 2 * Math.PI) / CURVE_STEPS;
    points.push(at(box, 0.5 + Math.cos(angle) / 2, 0.5 + Math.sin(angle) / 2));
  }
  return points;
};

/** An arrow head at `tip`, opening back along the direction it came from. */
const head = (tip: InkPoint, fromX: number, fromY: number, size: number, aspect: number) => {
  // The direction is measured in screen terms, or an arrow drawn on a tall
  // page points somewhere other than where it is going.
  const dx = (tip[0] - fromX) || 1e-9;
  const dy = (tip[1] - fromY) / aspect;
  const angle = Math.atan2(dy, dx);
  const spread = 0.42;
  const barb = (turn: number): InkPoint => [
    tip[0] - size * Math.cos(angle + turn),
    tip[1] - size * Math.sin(angle + turn) * aspect,
  ];
  return [barb(spread), tip, barb(-spread)];
};

const rounded = (box: Box, radius: number, aspect: number): InkPoint[] => {
  // The corner radius is a screen distance, so it is the same curve on both
  // axes rather than an oval on the taller one.
  const rx = Math.min(radius, box.width / 2);
  const ry = Math.min(radius * aspect, box.height / 2);
  const corners: [number, number, number][] = [
    [box.left + box.width - rx, box.top + ry, -Math.PI / 2],
    [box.left + box.width - rx, box.top + box.height - ry, 0],
    [box.left + rx, box.top + box.height - ry, Math.PI / 2],
    [box.left + rx, box.top + ry, Math.PI],
  ];
  const points: InkPoint[] = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 8; i += 1) {
      const angle = start + (i * Math.PI) / 2 / 8;
      points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
    }
  }
  points.push(points[0]!);
  return points;
};

/**
 * The points of `kind`, drawn in the box between `from` and `to`.
 *
 * `aspect` is the page's width ÷ height — 1 / √2 for a note's A4 page.
 */
export const shapePoints = (
  kind: ShapeKind,
  from: InkPoint,
  to: InkPoint,
  aspect: number,
): InkPoint[] => {
  const box = shapeBox(from, to, kind, aspect);
  const p = (u: number, v: number) => at(box, u, v);
  // An arrow head sized against the shape, but never bigger than it.
  const barb = Math.min(box.width, box.height / aspect) * 0.22;

  switch (kind) {
    case 'line':
      return [from, to];

    case 'wave': {
      // Across the box and back to the middle, so it reads the same whichever
      // way the box was dragged.
      const points: InkPoint[] = [];
      for (let i = 0; i <= CURVE_STEPS; i += 1) {
        const t = i / CURVE_STEPS;
        points.push(p(t, 0.5 - Math.sin(t * Math.PI * 4) * 0.5));
      }
      return points;
    }

    case 'curve': {
      // One arc, from corner to corner, bellying down to the foot of the box.
      const points: InkPoint[] = [];
      for (let i = 0; i <= CURVE_STEPS; i += 1) {
        const t = i / CURVE_STEPS;
        points.push(p(t, Math.sin(t * Math.PI)));
      }
      return points;
    }

    case 'arrow': {
      // One line: along the shaft, out to one barb, back to the tip, out to
      // the other. A stroke is a single path, so the head is drawn by
      // retracing the tip rather than lifting the pen.
      const [barb1, tip, barb2] = head(to, from[0], from[1], barb, aspect);
      return [from, tip!, barb1!, tip!, barb2!];
    }

    case 'double-arrow': {
      const [startBarb1, start, startBarb2] = head(from, to[0], to[1], barb, aspect);
      const [endBarb1, end, endBarb2] = head(to, from[0], from[1], barb, aspect);
      return [startBarb1!, start!, startBarb2!, start!, end!, endBarb1!, end!, endBarb2!];
    }

    case 'angle':
      return [p(0, 0), p(0, 1), p(1, 1)];

    case 'right-angle':
      // The square marking the corner, then the two arms.
      return [p(0, 0), p(0, 1), p(1, 1), p(0, 1), p(0, 0.82), p(0.18, 0.82), p(0.18, 1)];

    case 'axes':
      return [p(0.5, 0), p(0.5, 1), p(0.5, 0.5), p(0, 0.5), p(1, 0.5)];

    case 'brace': {
      // A curly brace: both ends tucked to the right, curving out to a point
      // at the middle of the left-hand side.
      const points: InkPoint[] = [];
      for (let i = 0; i <= CURVE_STEPS; i += 1) {
        const t = i / CURVE_STEPS;
        const away = Math.abs(2 * t - 1);
        // Eased, so the two halves are curves rather than a plain V.
        points.push(p(away * away * (3 - 2 * away), t));
      }
      return points;
    }

    case 'triangle':
      return [p(0.15, 0), p(1, 1), p(0, 1), p(0.15, 0)];

    case 'triangle-isoceles':
      return [p(0.5, 0), p(1, 1), p(0, 1), p(0.5, 0)];

    case 'triangle-right':
      return [p(0, 0), p(0, 1), p(1, 1), p(0, 0)];

    case 'square':
    case 'rectangle':
      return [p(0, 0), p(1, 0), p(1, 1), p(0, 1), p(0, 0)];

    case 'rounded-rectangle':
      return rounded(box, Math.min(box.width, box.height / aspect) * 0.18, aspect);

    case 'parallelogram':
      return [p(0.22, 0), p(1, 0), p(0.78, 1), p(0, 1), p(0.22, 0)];

    case 'trapezoid':
      return [p(0.22, 0), p(0.78, 0), p(1, 1), p(0, 1), p(0.22, 0)];

    case 'diamond':
      return [p(0.5, 0), p(1, 0.5), p(0.5, 1), p(0, 0.5), p(0.5, 0)];

    case 'pentagon':
      return polygon(box, 5);

    case 'hexagon':
      return polygon(box, 6);

    case 'octagon':
      return polygon(box, 8);

    case 'circle':
    case 'ellipse':
      return ellipse(box);

    case 'stadium':
      return rounded(box, Math.min(box.width, box.height / aspect) * 0.5, aspect);

    case 'star': {
      const points: InkPoint[] = [];
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 0.5 : 0.21;
        points.push(p(0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r));
      }
      points.push(points[0]!);
      return points;
    }

    default:
      return [from, to];
  }
};
