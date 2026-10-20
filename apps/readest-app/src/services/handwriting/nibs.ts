/**
 * The pen shapes a note can be written with. A nib is purely a description of
 * how a stroke's width and ink behave; it knows nothing about input devices,
 * canvases or React, so it can be reasoned about (and tested) on its own.
 */
export type InkNib = 'fountain' | 'calligraphy' | 'softpaint' | 'ballpoint' | 'pencil';

/** The nibs offered, in the order they are shown. */
export const INK_NIBS: readonly InkNib[] = [
  'fountain',
  'calligraphy',
  'softpaint',
  'ballpoint',
  'pencil',
] as const;

export const DEFAULT_NIB: InkNib = 'fountain';

/**
 * How strongly each nib's width answers to pressure, as a multiple of the
 * pressure reading. A ballpoint does not swell at all however hard it is
 * pressed; a soft brush swells a great deal; a pencil only darkens.
 */
const PRESSURE_GAIN: Record<InkNib, number> = {
  fountain: 1,
  calligraphy: 0.6,
  softpaint: 1.6,
  ballpoint: 0,
  pencil: 0.3,
};

/** Ink opacity per nib: graphite and wet brush sit lighter than a pen. */
const NIB_ALPHA: Record<InkNib, number> = {
  fountain: 1,
  calligraphy: 1,
  softpaint: 0.85,
  ballpoint: 1,
  pencil: 0.8,
};

/** The angle a calligraphy nib is held at — the classic 45° from horizontal. */
const CALLIGRAPHY_ANGLE = -Math.PI / 4;

/** How thin a calligraphy stroke runs when drawn along the nib's own edge. */
const CALLIGRAPHY_MIN = 0.15;

/** A stroke never thins to nothing, however light the touch or the angle. */
const MIN_SCALE = 0.15;

/**
 * How much a pressure reading scales the width.
 *
 * `sensitivity` is the slider: at 0 the width is constant whatever the
 * pressure, at 1 the nib answers at its full gain. An ordinary press (0.5)
 * always draws the nominal width, so turning sensitivity up or down pivots
 * around the same line rather than making every stroke thicker or thinner.
 */
export const pressureScale = (
  nib: InkNib,
  pressure: number | undefined,
  sensitivity: number,
): number => {
  const reading = pressure ?? 0.5;
  return Math.max(MIN_SCALE, 1 + sensitivity * PRESSURE_GAIN[nib] * (reading - 0.5));
};

/**
 * How much the direction of travel scales the width. Only a calligraphy nib
 * cares: it is a flat edge, so it draws broad across its edge and fine along
 * it. Every other nib is round and draws the same in every direction.
 */
export const directionScale = (nib: InkNib, angle: number): number => {
  if (nib !== 'calligraphy') return 1;
  const across = Math.abs(Math.sin(angle - CALLIGRAPHY_ANGLE));
  return CALLIGRAPHY_MIN + (1 - CALLIGRAPHY_MIN) * across;
};

/**
 * The half-width of a nib at one point along a stroke, in the same units as
 * `base` (the pen's nominal width in canvas pixels).
 */
export const nibRadius = (
  nib: InkNib,
  base: number,
  pressure: number | undefined,
  angle: number,
  sensitivity: number,
): number => (base * pressureScale(nib, pressure, sensitivity) * directionScale(nib, angle)) / 2;

/** How opaque this nib's ink is, before any marker translucency. */
export const nibAlpha = (nib: InkNib): number => NIB_ALPHA[nib];

/**
 * Whether a stroke's width changes along its length. A round nib on a device
 * reporting no pressure, or with sensitivity turned off, draws one even
 * width and can take the renderer's cheaper path; a calligraphy nib always
 * varies, because its width comes from the direction of travel.
 */
export const nibVaries = (nib: InkNib, sensitivity: number, hasPressure: boolean): boolean =>
  nib === 'calligraphy' || (hasPressure && sensitivity > 0 && PRESSURE_GAIN[nib] !== 0);

/** Whether this nib's edge is soft rather than crisp. */
export const nibIsSoft = (nib: InkNib): boolean => nib === 'softpaint';
