import { describe, expect, it } from 'vitest';

import { A4_HEIGHT_PT, A4_WIDTH_PT, buildNotePdf, readJpeg } from '@/services/notes/notePdf';
import { exportBox, exportFilename } from '@/services/notes/noteExport';
import { QUICK_NOTE_ASPECT } from '@/types/notes';

/** A real 2x2 greyscale JPEG, so the markers it is read through are genuine. */
const JPEG = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
      'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAHwAAAQUBAQEB' +
      'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
      'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ' +
      'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
      'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+v//Z',
    'base64',
  ),
);

const asText = (pdf: Uint8Array) => Buffer.from(pdf).toString('latin1');

describe('readJpeg', () => {
  it('reads the size and colour out of the file rather than being told', () => {
    expect(readJpeg(JPEG)).toEqual({ width: 2, height: 2, components: 1 });
  });

  it('returns nothing for something that is not a JPEG', () => {
    expect(readJpeg(Uint8Array.from([1, 2, 3, 4]))).toBeNull();
  });
});

describe('buildNotePdf', () => {
  it('refuses to wrap something that is not a JPEG', () => {
    expect(() => buildNotePdf(Uint8Array.from([1, 2, 3, 4]))).toThrow();
  });

  it('declares the colour space the image actually uses', () => {
    expect(asText(buildNotePdf(JPEG))).toContain('/ColorSpace /DeviceGray');
  });

  it('is a PDF from its first byte to its last', () => {
    const pdf = asText(buildNotePdf(JPEG));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('is a single page the size of the paper the note was written on', () => {
    const pdf = asText(buildNotePdf(JPEG));
    expect(pdf).toContain('/Count 1');
    expect(pdf).toContain(`/MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}]`);
  });

  it('points every entry in its table exactly at the object it names', () => {
    // The part worth testing rather than reading: a table one byte out still
    // looks like a PDF and still will not open.
    const pdf = asText(buildNotePdf(JPEG));
    const startxref = Number(pdf.slice(pdf.lastIndexOf('startxref') + 9).trim().split('\n')[0]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    const rows = pdf.slice(startxref).split('\n').slice(3, 8);
    rows.forEach((row, index) => {
      const at = Number(row.slice(0, 10));
      expect(pdf.slice(at, at + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  it('carries the image through byte for byte', () => {
    const pdf = buildNotePdf(JPEG);
    expect(Buffer.from(pdf).indexOf(Buffer.from(JPEG))).toBeGreaterThan(-1);
    expect(asText(pdf)).toContain(`/Length ${JPEG.length}`);
  });

  it('draws the image over the whole page', () => {
    expect(asText(buildNotePdf(JPEG))).toContain(
      `q ${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm /Im0 Do Q`,
    );
  });
});

describe('exportBox', () => {
  it('is the note page shape, so an export is not stretched', () => {
    const box = exportBox();
    expect(box.width / box.height).toBeCloseTo(QUICK_NOTE_ASPECT, 3);
  });
});

describe('exportFilename', () => {
  it('names the file after the note', () => {
    expect(exportFilename('Maths revision', 'pdf')).toBe('Maths revision.pdf');
  });

  it('takes out characters a file name cannot hold', () => {
    expect(exportFilename('A/B:C*D?E"F<G>H|I', 'png')).toBe('A B C D E F G H I.png');
  });

  it('falls back rather than producing a file with no name', () => {
    expect(exportFilename('   ', 'pdf')).toBe('Note.pdf');
    expect(exportFilename('///', 'pdf')).toBe('Note.pdf');
  });

  it('keeps a very long title to a sane length', () => {
    expect(exportFilename('x'.repeat(200), 'pdf').length).toBeLessThanOrEqual(64);
  });
});
