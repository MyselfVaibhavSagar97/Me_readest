import clsx from 'clsx';
import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { PAPER_COLOR } from '@/services/notes/penSettings';
import type { NoteImage } from '@/types/notes';

interface NotePageProps {
  index: number;
  width: number;
  height: number;
  /** The pictures that sit on this page, already resolved to URLs. */
  images: { image: NoteImage; url: string | undefined }[];
  /** True while the picture tool is in hand, when pictures answer the finger. */
  handlingPictures: boolean;
  onPickImage: (id: string) => void;
  /** Registers this page's box and its canvas with the ink engine. */
  pageRef: (el: HTMLDivElement | null) => void;
  canvasRef: (el: HTMLCanvasElement | null) => void;
  children?: React.ReactNode;
}

/**
 * One page of a note: paper, the pictures on it, and the ink over them.
 *
 * A page draws only what it holds. The hand is not attached here — the whole
 * scrolling area takes the pointer, and points the session at whichever page
 * the pen came down on — so a page is purely something to look at.
 */
const NotePage: React.FC<NotePageProps> = ({
  index,
  width,
  height,
  images,
  handlingPictures,
  onPickImage,
  pageRef,
  canvasRef,
  children,
}) => {
  const _ = useTranslation();

  return (
    <div
      ref={pageRef}
      data-page={index}
      aria-label={`${_('Page')} ${index + 1}`}
      className='eink-bordered border-base-300/60 relative shrink-0 border'
      style={{ width, height, backgroundColor: PAPER_COLOR }}
    >
      {images.map(({ image, url }) => (
        <img
          key={image.id}
          src={url}
          alt=''
          draggable={false}
          onPointerDown={
            handlingPictures
              ? (event) => {
                  event.stopPropagation();
                  onPickImage(image.id);
                }
              : undefined
          }
          className='absolute select-none'
          style={{
            left: `${image.left * 100}%`,
            top: `${image.top * 100}%`,
            width: `${image.width * 100}%`,
            height: `${image.height * 100}%`,
            pointerEvents: handlingPictures ? 'auto' : 'none',
            touchAction: 'none',
            backgroundColor: url ? undefined : 'rgba(0,0,0,0.04)',
          }}
        />
      ))}
      <canvas
        ref={canvasRef}
        aria-label={`${_('Note Page')} ${index + 1}`}
        className={clsx('absolute inset-0 h-full w-full')}
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
};

export default NotePage;
