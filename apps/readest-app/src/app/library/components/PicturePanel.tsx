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

interface PicturePanelProps {
  onInsertFromAlbum: () => void;
  /** True while the picker is open or a picture is being copied in. */
  inserting: boolean;
  /** How many pictures the page already holds. */
  count: number;
}

/**
 * The picture tool's panel: where a picture comes from, and what can be done
 * with the ones already on the page.
 *
 * There is no "Take photo" here. The app has no camera of its own, and a
 * button that opened nothing would be worse than its absence; on a tablet
 * the gallery already holds anything the camera has just taken.
 */
const PicturePanel: React.FC<PicturePanelProps> = ({ onInsertFromAlbum, inserting, count }) => {
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

      <p className='text-base-content/55 text-xs leading-relaxed'>
        {count > 0
          ? _('Tap a picture to move it, drag its corner to resize, or delete it.')
          : _('Pictures sit under your writing, so you can write and highlight on top of them.')}
      </p>
    </ToolPanel>
  );
};

export default PicturePanel;
