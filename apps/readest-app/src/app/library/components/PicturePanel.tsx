import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { ToolPanel } from './ToolPanelParts';

/**
 * A framed picture — hills and a sun — drawn rather than borrowed, as the
 * other tool glyphs here are. Sized in `em` so the toolbar, which renders an
 * icon with no props of its own, gets one the size of the icons beside it.
 */
export const PictureIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' className={className} aria-hidden='true'>
    <rect
      x='3'
      y='5'
      width='18'
      height='14'
      rx='2'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
    />
    <circle cx='8.5' cy='9.5' r='1.6' fill='currentColor' />
    <path
      d='M4.5 17.5 L9.5 12.5 L13 16 L16 13.5 L19.5 17'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

/** A camera body with a lens, drawn like the other tool glyphs here. */
export const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' className={className} aria-hidden='true'>
    <path
      d='M4 7.5 L8 7.5 L9.5 5 L14.5 5 L16 7.5 L20 7.5 A1.5 1.5 0 0 1 21.5 9 L21.5 18 A1.5 1.5 0 0 1 20 19.5 L4 19.5 A1.5 1.5 0 0 1 2.5 18 L2.5 9 A1.5 1.5 0 0 1 4 7.5 Z'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinejoin='round'
    />
    <circle cx='12' cy='13.2' r='3.6' fill='none' stroke='currentColor' strokeWidth='1.6' />
  </svg>
);

interface PicturePanelProps {
  onInsertFromAlbum: () => void;
  onTakePhoto: () => void;
  /** False where there is no camera to open, as on the desktop app. */
  canTakePhoto: boolean;
  /** True while the picker is open or a picture is being copied in. */
  inserting: boolean;
  /** How many pictures the page already holds. */
  count: number;
}

/**
 * The picture tool's panel: where a picture comes from, and what can be done
 * with the ones already on the page.
 *
 * "Take photo" appears only where there is a camera to open. The photograph
 * is written into the gallery as well as into the note, so it is where it
 * would be expected to be afterwards.
 */
const PicturePanel: React.FC<PicturePanelProps> = ({
  onInsertFromAlbum,
  onTakePhoto,
  canTakePhoto,
  inserting,
  count,
}) => {
  const _ = useTranslation();

  return (
    <ToolPanel title={_('Picture')}>
      <button
        type='button'
        onClick={onInsertFromAlbum}
        disabled={inserting}
        className='eink-bordered border-base-300 btn btn-sm h-auto justify-start gap-3 rounded-lg border bg-transparent px-3 py-2.5'
      >
        <PictureIcon className='h-5 w-5 shrink-0' />
        <span className='flex min-w-0 flex-col items-start'>
          <span className='text-sm font-normal'>
            {inserting ? _('Opening…') : _('Insert from album')}
          </span>
          <span className='text-base-content/55 text-xs font-normal'>
            {_('Choose a picture from your gallery')}
          </span>
        </span>
      </button>

      {canTakePhoto && (
        <button
          type='button'
          onClick={onTakePhoto}
          disabled={inserting}
          className='eink-bordered border-base-300 btn btn-sm h-auto justify-start gap-3 rounded-lg border bg-transparent px-3 py-2.5'
        >
          <CameraIcon className='h-5 w-5 shrink-0' />
          <span className='flex min-w-0 flex-col items-start'>
            <span className='text-sm font-normal'>{_('Take photo')}</span>
            <span className='text-base-content/55 text-xs font-normal'>
              {_('Opens the camera; the photo is saved to your gallery too')}
            </span>
          </span>
        </button>
      )}

      <p className='text-base-content/55 text-xs leading-relaxed'>
        {count > 0
          ? _('Tap a picture to move it, drag its corner to resize, or delete it.')
          : _('Pictures sit under your writing, so you can write and highlight on top of them.')}
      </p>
    </ToolPanel>
  );
};

export default PicturePanel;
