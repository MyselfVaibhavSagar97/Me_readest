/**
 * A one-page PDF around a photograph of the note.
 *
 * Written by hand rather than with a PDF library, because what is needed is
 * the smallest possible file: a single page holding a single JPEG, scaled to
 * fill it. A library for that would be a megabyte of dependency for about
 * eighty lines of well-specified format.
 *
 * The page is the note's own page, in points, so a note printed from the PDF
 * comes out at the size it was written.
 */

/** A4 in PDF points (1/72 inch), the shape a note page already is. */
export const A4_WIDTH_PT = 595.276;
export const A4_HEIGHT_PT = 841.89;

const LATIN1 = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

export interface JpegInfo {
  width: number;
  height: number;
  /** 1 for greyscale, 3 for colour, 4 for CMYK. */
  components: number;
}

/**
 * The size and colour of a JPEG, read out of the file itself.
 *
 * PDF has to be told both, and being told something the image disagrees with
 * is how a page comes out stretched or wrongly coloured. Reading them here
 * means the caller cannot get them wrong.
 *
 * A JPEG is a run of markers: 0xFF, a kind, then a two-byte length. The one
 * that carries the dimensions is a start-of-frame — any of C0..CF except the
 * four that mean something else.
 */
export const readJpeg = (bytes: Uint8Array): JpegInfo | null => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const kind = bytes[at + 1]!;
    // Start of frame, baseline through progressive, but not DHT (c4),
    // DAC (cc) or the restart markers (d0..d7).
    if (kind >= 0xc0 && kind <= 0xcf && kind !== 0xc4 && kind !== 0xc8 && kind !== 0xcc) {
      return {
        height: (bytes[at + 5]! << 8) | bytes[at + 6]!,
        width: (bytes[at + 7]! << 8) | bytes[at + 8]!,
        components: bytes[at + 9]!,
      };
    }
    if (kind === 0xd8 || (kind >= 0xd0 && kind <= 0xd9)) {
      at += 2;
      continue;
    }
    const length = (bytes[at + 2]! << 8) | bytes[at + 3]!;
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
};

const COLOR_SPACES: Record<number, string> = {
  1: '/DeviceGray',
  3: '/DeviceRGB',
  4: '/DeviceCMYK',
};

/**
 * The PDF, as bytes.
 *
 * A PDF is a list of numbered objects followed by a table saying where each
 * one starts, counted in bytes from the beginning of the file. Those offsets
 * are what makes this worth testing rather than eyeballing: a file whose
 * table is one byte out still looks like a PDF and will not open.
 */
export const buildNotePdf = (
  jpeg: Uint8Array,
  widthPt = A4_WIDTH_PT,
  heightPt = A4_HEIGHT_PT,
): Uint8Array => {
  const info = readJpeg(jpeg);
  if (!info) throw new Error('Not a JPEG this can embed');
  const width = Number(widthPt.toFixed(3));
  const height = Number(heightPt.toFixed(3));
  // Draw the image over the whole page: scale it to the page, then paint it.
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;

  const objects: Uint8Array[] = [
    LATIN1('<< /Type /Catalog /Pages 2 0 R >>'),
    LATIN1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    LATIN1(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    ),
    // The image itself, stored exactly as the JPEG already is.
    concat([
      LATIN1(
        `<< /Type /XObject /Subtype /Image /Width ${info.width} ` +
          `/Height ${info.height} /ColorSpace ${COLOR_SPACES[info.components] ?? '/DeviceRGB'} ` +
          `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      LATIN1('\nendstream'),
    ]),
    LATIN1(`<< /Length ${content.length} >>\nstream\n${content}endstream`),
  ];

  const parts: Uint8Array[] = [LATIN1('%PDF-1.4\n')];
  let offset = parts[0]!.length;
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(offset);
    const head = LATIN1(`${index + 1} 0 obj\n`);
    const tail = LATIN1('\nendobj\n');
    parts.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });

  const xrefAt = offset;
  // Entries are fixed at 20 bytes each; anything else and the table cannot
  // be indexed into.
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) {
    xref += `${at.toString().padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  parts.push(LATIN1(xref));

  return concat(parts);
};

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
