import { useCallback, useState } from 'react';

import { useEnv } from '@/context/EnvContext';
import { eventDispatcher } from '@/utils/event';
import { useTranslation } from '@/hooks/useTranslation';
import type { InkStroke } from '@/services/handwriting/model';
import type { NoteImage } from '@/types/notes';
import {
  exportBox,
  exportFilename,
  paintNote,
  type DecodedImage,
} from '@/services/notes/noteExport';
import { buildNotePdf } from '@/services/notes/notePdf';

export type ExportAs = 'pdf' | 'picture';

/** A picture, decoded from the URL the editor is already showing it at. */
const decode = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });

const blobBytes = async (blob: Blob): Promise<Uint8Array> =>
  new Uint8Array(await blob.arrayBuffer());

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Exporting the note being edited as a file: a picture, or a PDF of one page.
 *
 * Both are the same drawing at the same size — the PDF is that picture
 * wrapped in a page — so the two can never disagree about what the note
 * looks like. The file goes out through the app's own save-or-share path,
 * which is the one that already knows how each platform wants to be asked.
 */
export const useQuickNoteExport = (
  title: string,
  strokes: () => InkStroke[],
  images: NoteImage[],
  urls: Record<string, string>,
  pageCount = 1,
) => {
  const { appService } = useEnv();
  const _ = useTranslation();
  const [exporting, setExporting] = useState<ExportAs | null>(null);

  const exportAs = useCallback(
    async (as: ExportAs) => {
      if (!appService || exporting) return;
      setExporting(as);
      try {
        const box = exportBox();
        const canvas = document.createElement('canvas');
        canvas.width = box.width;
        canvas.height = box.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas to draw on');

        // Decoded once, then sorted onto the page each belongs to.
        const decoded: DecodedImage[] = [];
        for (const image of images) {
          const url = urls[image.file];
          if (!url) continue;
          const el = await decode(url);
          if (el) decoded.push({ image, el });
        }
        const all = strokes();
        const pages = Math.max(1, pageCount);
        /** Draws one page onto the shared canvas and takes a picture of it. */
        const shoot = async (index: number, type: string, quality?: number) => {
          // Paper included: an exported file carries its own page.
          paintNote(
            ctx,
            all.filter((stroke) => (stroke.page ?? 0) === index),
            decoded.filter(({ image }) => (image.page ?? 0) === index),
            box,
            { paper: true },
          );
          const blob = await toBlob(canvas, type, quality);
          if (!blob) throw new Error('Could not make a picture of the note');
          return blobBytes(blob);
        };

        if (as === 'picture') {
          // A picture is one page: the one being looked at would be a guess,
          // so it is the first, and a note of several pages exports as a PDF.
          await appService.saveFile(
            exportFilename(title, 'png'),
            (await shoot(0, 'image/png')).buffer as ArrayBuffer,
            { mimeType: 'image/png', share: true },
          );
        } else {
          // JPEG, because that is what a PDF can carry as-is: anything else
          // would have to be re-encoded into the file by hand.
          const shots: Uint8Array[] = [];
          for (let index = 0; index < pages; index += 1) {
            shots.push(await shoot(index, 'image/jpeg', 0.92));
          }
          const pdf = buildNotePdf(shots);
          await appService.saveFile(
            exportFilename(title, 'pdf'),
            pdf.buffer as ArrayBuffer,
            { mimeType: 'application/pdf', share: true },
          );
        }
      } catch (error) {
        eventDispatcher.dispatch('toast', {
          type: 'error',
          timeout: 3000,
          message: _('Could not export this note'),
        });
        console.error('note export failed:', error);
      } finally {
        setExporting(null);
      }
    },
    [_, appService, exporting, images, pageCount, strokes, title, urls],
  );

  return { exportAs, exporting };
};
