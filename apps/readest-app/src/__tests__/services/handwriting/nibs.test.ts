import { describe, it, expect } from 'vitest';

import {
  DEFAULT_NIB,
  INK_NIBS,
  directionScale,
  nibAlpha,
  nibRadius,
  nibVaries,
  pressureScale,
} from '@/services/handwriting/nibs';

describe('nibs', () => {
  describe('pressure response', () => {
    it('reproduces the engine\'s original curve for the default pen', () => {
      // Before nibs existed the renderer used 0.5 + pressure, so a fountain
      // nib at full sensitivity must still draw exactly that. Ink already in
      // a book depends on it.
      for (const pressure of [0, 0.25, 0.5, 0.75, 1]) {
        expect(pressureScale('fountain', pressure, 1)).toBeCloseTo(0.5 + pressure, 10);
      }
    });

    it('draws one even width when sensitivity is off', () => {
      for (const pressure of [0, 0.5, 1]) {
        expect(pressureScale('fountain', pressure, 0)).toBe(1);
      }
    });

    it('pivots around an ordinary press, so the nominal width never moves', () => {
      // Turning the slider must not make every stroke thicker or thinner,
      // only change how much it varies.
      for (const sensitivity of [0, 0.3, 0.7, 1]) {
        expect(pressureScale('softpaint', 0.5, sensitivity)).toBe(1);
      }
    });

    it('ignores pressure for a ballpoint, which does not swell', () => {
      expect(pressureScale('ballpoint', 0, 1)).toBe(1);
      expect(pressureScale('ballpoint', 1, 1)).toBe(1);
    });

    it('swells more for a brush than a pencil at the same press', () => {
      const firm = 1;
      expect(pressureScale('softpaint', firm, 1)).toBeGreaterThan(
        pressureScale('fountain', firm, 1),
      );
      expect(pressureScale('fountain', firm, 1)).toBeGreaterThan(
        pressureScale('pencil', firm, 1),
      );
    });

    it('never thins a stroke away to nothing', () => {
      for (const nib of INK_NIBS) {
        expect(pressureScale(nib, 0, 1)).toBeGreaterThan(0);
      }
    });

    it('treats a missing reading as an ordinary press', () => {
      expect(pressureScale('fountain', undefined, 1)).toBe(1);
    });
  });

  describe('direction', () => {
    it('leaves round nibs the same in every direction', () => {
      for (const nib of INK_NIBS) {
        if (nib === 'calligraphy') continue;
        for (const angle of [0, Math.PI / 4, Math.PI / 2, 1.9]) {
          expect(directionScale(nib, angle)).toBe(1);
        }
      }
    });

    it('draws a calligraphy nib broad across its edge and fine along it', () => {
      // The nib is held at -45°, so a stroke along that line is its thinnest
      // and one square across it is its broadest.
      const along = directionScale('calligraphy', -Math.PI / 4);
      const across = directionScale('calligraphy', Math.PI / 4);
      expect(along).toBeLessThan(0.2);
      expect(across).toBeCloseTo(1, 10);
      expect(across).toBeGreaterThan(along);
    });
  });

  it('combines width, pressure and direction into a half-width', () => {
    // base 10 at an ordinary press is a radius of 5, whatever the nib.
    expect(nibRadius('fountain', 10, 0.5, 0, 1)).toBeCloseTo(5, 10);
    expect(nibRadius('ballpoint', 10, 1, 0, 1)).toBeCloseTo(5, 10);
    expect(nibRadius('calligraphy', 10, 0.5, -Math.PI / 4, 1)).toBeLessThan(1);
  });

  describe('nibVaries', () => {
    it('takes the cheap even-width path when nothing can change the width', () => {
      expect(nibVaries('fountain', 1, false)).toBe(false);
      expect(nibVaries('fountain', 0, true)).toBe(false);
      expect(nibVaries('ballpoint', 1, true)).toBe(false);
    });

    it('always varies for a flat nib, which changes with direction alone', () => {
      expect(nibVaries('calligraphy', 0, false)).toBe(true);
    });

    it('varies when a pressure-reading pen has sensitivity to spend', () => {
      expect(nibVaries('fountain', 1, true)).toBe(true);
      expect(nibVaries('pencil', 0.5, true)).toBe(true);
    });
  });

  it('lays graphite and wet brush down lighter than a pen', () => {
    expect(nibAlpha('fountain')).toBe(1);
    expect(nibAlpha('ballpoint')).toBe(1);
    expect(nibAlpha('pencil')).toBeLessThan(1);
    expect(nibAlpha('softpaint')).toBeLessThan(1);
  });

  it('offers five nibs, the default among them', () => {
    expect(INK_NIBS).toHaveLength(5);
    expect(INK_NIBS).toContain(DEFAULT_NIB);
  });
});
