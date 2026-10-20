import type { InkPoint } from './model';

/**
 * Smooths the points of a stroke as they arrive, so a shaky hand or a noisy
 * digitizer draws a cleaner line.
 *
 * It is a first-order filter: each point is pulled towards the one before it.
 * `strength` is the slider — at 0 the points pass through untouched, at 1 the
 * line lags well behind the pen and comes out very smooth. The lag is the
 * cost of smoothing and is why this is a setting rather than a default.
 *
 * Pressure is smoothed alongside position, so stabilizing a stroke does not
 * leave its width jittering.
 */
export class StrokeStabilizer {
  /** Pull towards the previous point; 1 passes the input straight through. */
  private alpha = 1;
  private last: InkPoint | null = null;

  constructor(strength = 0) {
    this.setStrength(strength);
  }

  /** `strength` is 0..1; anything outside is clamped. */
  setStrength(strength: number) {
    const clamped = Math.min(1, Math.max(0, strength));
    // Never reaches 0, which would freeze the line in place entirely.
    this.alpha = 1 - 0.88 * clamped;
  }

  /** Starts a new stroke; the next point is taken as given. */
  reset() {
    this.last = null;
  }

  push(point: InkPoint): InkPoint {
    if (this.alpha >= 1 || !this.last) {
      this.last = point;
      return point;
    }
    const [x, y, pressure] = point;
    const [lastX, lastY, lastPressure] = this.last;
    const smoothed: InkPoint =
      pressure === undefined || lastPressure === undefined
        ? [lastX + (x - lastX) * this.alpha, lastY + (y - lastY) * this.alpha]
        : [
            lastX + (x - lastX) * this.alpha,
            lastY + (y - lastY) * this.alpha,
            lastPressure + (pressure - lastPressure) * this.alpha,
          ];
    this.last = smoothed;
    return smoothed;
  }
}
