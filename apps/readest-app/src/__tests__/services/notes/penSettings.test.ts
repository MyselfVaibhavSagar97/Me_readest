import { describe, it, expect } from 'vitest';

import {
  DEFAULT_PEN,
  MAX_THICKNESS_MM,
  MIN_THICKNESS_MM,
  PAGE_WIDTH_MM,
  PEN_COLORS,
  fractionToMm,
  mmToFraction,
  roundThicknessMm,
} from '@/services/notes/penSettings';

describe('pen settings', () => {
  describe('thickness in millimetres', () => {
    it('measures against the width of the A4 page a note is written on', () => {
      expect(PAGE_WIDTH_MM).toBe(210);
      // A 0.5mm pen is a touch under a quarter of a percent of the page.
      expect(mmToFraction(0.5)).toBeCloseTo(0.5 / 210, 10);
      expect(mmToFraction(210)).toBe(1);
    });

    it('converts back and forth without drifting', () => {
      for (const mm of [0.1, 0.35, 0.5, 1, 2.75, 5]) {
        expect(fractionToMm(mmToFraction(mm))).toBeCloseTo(mm, 10);
      }
    });

    it('rounds to the slider step rather than showing 0.30000000000000004mm', () => {
      expect(roundThicknessMm(0.3000000000000001)).toBeCloseTo(0.3, 10);
      expect(roundThicknessMm(0.51)).toBeCloseTo(0.5, 10);
      expect(roundThicknessMm(0.53)).toBeCloseTo(0.55, 10);
    });

    it('keeps a thickness inside the range the slider offers', () => {
      expect(roundThicknessMm(-5)).toBeCloseTo(MIN_THICKNESS_MM, 10);
      expect(roundThicknessMm(500)).toBeCloseTo(MAX_THICKNESS_MM, 10);
    });
  });

  it('starts on a pen that answers to pressure', () => {
    // A stylus that draws a dead, even line feels broken on a tablet, so
    // pressure is on out of the box; smoothing is not, because it adds lag.
    expect(DEFAULT_PEN.sensitivity).toBeGreaterThan(0);
    expect(DEFAULT_PEN.stabilization).toBe(0);
    expect(DEFAULT_PEN.thicknessMm).toBeGreaterThanOrEqual(MIN_THICKNESS_MM);
    expect(DEFAULT_PEN.thicknessMm).toBeLessThanOrEqual(MAX_THICKNESS_MM);
  });

  it('offers five colours, the default among them', () => {
    expect(PEN_COLORS).toHaveLength(5);
    expect(PEN_COLORS).toContain(DEFAULT_PEN.color);
  });
});
