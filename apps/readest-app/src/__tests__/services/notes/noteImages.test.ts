import { describe, expect, it } from 'vitest';

import { QUICK_NOTE_ASPECT, type NoteImage } from '@/types/notes';
import {
  IMAGE_EXTENSIONS,
  MIN_IMAGE_SIZE,
  boundsOfImage,
  extensionOf,
  heightFor,
  imagesOf,
  moveImage,
  nextImageId,
  placeImage,
  scaleImage,
} from '@/services/notes/noteImages';

const image = (over: Partial<NoteImage> = {}): NoteImage => ({
  id: 'i1',
  file: 'i1.png',
  left: 0.2,
  top: 0.2,
  width: 0.4,
  height: 0.3,
  ...over,
});

/**
 * A picture's box is in page fractions, and the page is taller than it is
 * wide, so the numbers are not the shape. This is what the box actually
 * renders as: on a page `W` wide and `W / QUICK_NOTE_ASPECT` tall.
 */
const renderedAspect = (box: { width: number; height: number }, W = 1000) =>
  (box.width * W) / (box.height * (W / QUICK_NOTE_ASPECT));

describe('placeImage', () => {
  it('shows a landscape photograph at its own shape, not the page shape', () => {
    expect(renderedAspect(placeImage(1000, 500))).toBeCloseTo(2, 10);
  });

  it('keeps a square photograph square', () => {
    expect(renderedAspect(placeImage(800, 800))).toBeCloseTo(1, 10);
  });

  it('keeps a portrait photograph portrait', () => {
    expect(renderedAspect(placeImage(600, 1800))).toBeCloseTo(1 / 3, 10);
  });

  it('lands a new picture in the middle of the page', () => {
    const box = placeImage(1000, 500);
    expect(box.left + box.width / 2).toBeCloseTo(0.5, 10);
    expect(box.top + box.height / 2).toBeCloseTo(0.5, 10);
  });

  it('fits a very tall photograph rather than running it off the page', () => {
    const box = placeImage(100, 4000);
    expect(box.height).toBeLessThanOrEqual(1);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(renderedAspect(box)).toBeCloseTo(100 / 4000, 10);
  });

  it('places a picture whose size could not be read instead of dropping it', () => {
    const box = placeImage(0, 0);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  it('is the height heightFor gives, so the two cannot drift apart', () => {
    const box = placeImage(1000, 500);
    expect(box.height).toBeCloseTo(heightFor(box.width, 1000, 500), 12);
  });
});

describe('moveImage', () => {
  it('moves the picture by the drag', () => {
    const moved = moveImage(image(), 0.1, -0.1);
    expect(moved.left).toBeCloseTo(0.3, 10);
    expect(moved.top).toBeCloseTo(0.1, 10);
  });

  it('stops at the edge rather than letting a picture off the page', () => {
    expect(moveImage(image(), 5, 5).left).toBeCloseTo(0.6, 10);
    expect(moveImage(image(), -5, -5).left).toBeCloseTo(0, 10);
  });

  it('clamps each axis on its own, so sliding along an edge still works', () => {
    const slid = moveImage(image({ left: 0, top: 0.2 }), -1, 0.1);
    expect(slid.left).toBeCloseTo(0, 10);
    expect(slid.top).toBeCloseTo(0.3, 10);
  });
});

describe('scaleImage', () => {
  it('scales both sides together, so a photograph is never stretched', () => {
    const from = image();
    const bigger = scaleImage(from, from, 1.5);
    expect(bigger.width / bigger.height).toBeCloseTo(from.width / from.height, 10);
  });

  it('holds the top-left corner still, the one not being dragged', () => {
    const from = image();
    const bigger = scaleImage(from, from, 1.5);
    expect(bigger.left).toBeCloseTo(from.left, 10);
    expect(bigger.top).toBeCloseTo(from.top, 10);
  });

  it('stops growing at the edge of the page', () => {
    const from = image({ left: 0.5, top: 0.5, width: 0.4, height: 0.4 });
    const huge = scaleImage(from, from, 99);
    expect(from.left + huge.width).toBeLessThanOrEqual(1 + 1e-9);
    expect(from.top + huge.height).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('stops shrinking before a picture becomes too small to find', () => {
    const from = image();
    const tiny = scaleImage(from, from, 0);
    expect(Math.max(tiny.width, tiny.height)).toBeGreaterThanOrEqual(MIN_IMAGE_SIZE - 1e-9);
  });
});

describe('boundsOfImage', () => {
  it('is the box the selection overlay draws', () => {
    const b = boundsOfImage(image());
    expect(b.left).toBeCloseTo(0.2, 10);
    expect(b.top).toBeCloseTo(0.2, 10);
    expect(b.right - b.left).toBeCloseTo(0.4, 10);
    expect(b.bottom - b.top).toBeCloseTo(0.3, 10);
  });
});

describe('extensionOf', () => {
  it('keeps the picture format, whatever case it was written in', () => {
    expect(extensionOf('/storage/emulated/0/DCIM/IMG_0042.JPG')).toBe('jpg');
    expect(extensionOf('C:\\Users\\me\\pic.webp')).toBe('webp');
    expect(extensionOf('/tmp/photo.heic')).toBe('heic');
  });

  it('falls back rather than inventing a format it was not given', () => {
    expect(extensionOf('/tmp/noextension')).toBe('png');
    expect(extensionOf('/tmp/archive.zip')).toBe('png');
    expect(extensionOf('')).toBe('png');
  });

  it('only ever returns a format the picker offers', () => {
    for (const path of ['a.JPG', 'b.gif', 'c.unknown', '']) {
      expect(IMAGE_EXTENSIONS).toContain(extensionOf(path));
    }
  });
});

describe('nextImageId', () => {
  it('gives every picture its own id, however fast they are added', () => {
    const ids = Array.from({ length: 200 }, () => nextImageId());
    expect(new Set(ids).size).toBe(200);
  });
});

describe('imagesOf', () => {
  it('reads a note written before pictures as a note with none', () => {
    expect(imagesOf(undefined)).toEqual([]);
  });
});
