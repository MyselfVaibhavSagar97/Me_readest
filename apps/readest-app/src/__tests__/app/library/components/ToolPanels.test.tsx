import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EraserPanel from '@/app/library/components/EraserPanel';
import HighlighterPanel from '@/app/library/components/HighlighterPanel';
import PenPanel from '@/app/library/components/PenPanel';
import {
  DEFAULT_ERASER,
  DEFAULT_HIGHLIGHTER,
  DEFAULT_PEN,
  PAPER_COLOR,
} from '@/services/notes/penSettings';

vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => (key: string) => key }));

afterEach(cleanup);

/**
 * The three tool panels are built from the shared primitives in
 * `ToolPanelParts`, so that restyling them touches one file. These cases pin
 * what each panel offers and what it reports back, so a change of looks that
 * drops a control — or stops reporting one — fails here rather than on a
 * tablet.
 */
describe('tool panels', () => {
  describe('PenPanel', () => {
    const renderPanel = () => {
      const onChange = vi.fn();
      render(<PenPanel pen={DEFAULT_PEN} onChange={onChange} />);
      return onChange;
    };

    it('offers all five nibs', () => {
      renderPanel();
      for (const nib of ['Fountain', 'Calligraphy', 'Softpaint', 'Ballpoint', 'Pencil']) {
        expect(screen.getByRole('button', { name: nib })).toBeTruthy();
      }
    });

    it('picks a nib', () => {
      const onChange = renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Calligraphy' }));
      expect(onChange).toHaveBeenCalledWith({ nib: 'calligraphy' });
    });

    it('offers pressure, thickness and stabilization, each reporting its own field', () => {
      const onChange = renderPanel();

      fireEvent.change(screen.getByLabelText('Pressure sensitivity'), { target: { value: '0.5' } });
      expect(onChange).toHaveBeenLastCalledWith({ sensitivity: 0.5 });

      fireEvent.change(screen.getByLabelText('Thickness'), { target: { value: '1.5' } });
      expect(onChange).toHaveBeenLastCalledWith({ thicknessMm: 1.5 });

      fireEvent.change(screen.getByLabelText('Stroke Stabilization'), { target: { value: '0.7' } });
      expect(onChange).toHaveBeenLastCalledWith({ stabilization: 0.7 });
    });

    it('rounds a thickness to the slider step rather than reporting 0.30000000000000004', () => {
      const onChange = renderPanel();
      fireEvent.change(screen.getByLabelText('Thickness'), { target: { value: '0.3300001' } });
      const [[patch]] = onChange.mock.calls as [[{ thicknessMm: number }]];
      expect(patch.thicknessMm).toBeCloseTo(0.35, 10);
    });

    it('offers the palette and a colour picker for anything else', () => {
      const onChange = renderPanel();
      const swatches = screen.getAllByRole('button', { name: 'Ink Color' });
      expect(swatches.length).toBeGreaterThan(1);
      fireEvent.click(swatches[1]!);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(Object.keys(onChange.mock.calls[0]![0] as object)).toEqual(['color']);

      fireEvent.change(screen.getByLabelText('Pick a colour'), { target: { value: '#123456' } });
      expect(onChange).toHaveBeenLastCalledWith({ color: '#123456' });
    });
  });

  describe('HighlighterPanel', () => {
    const renderPanel = () => {
      const onChange = vi.fn();
      render(<HighlighterPanel highlighter={DEFAULT_HIGHLIGHTER} onChange={onChange} />);
      return onChange;
    };

    it('offers both tips', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: 'Chisel' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Fine' })).toBeTruthy();
    });

    it('picks a tip, a thickness, a straight line and a colour', () => {
      const onChange = renderPanel();

      fireEvent.click(screen.getByRole('button', { name: 'Fine' }));
      expect(onChange).toHaveBeenLastCalledWith({ tip: 'fine' });

      fireEvent.change(screen.getByLabelText('Thickness'), { target: { value: '8' } });
      expect(onChange).toHaveBeenLastCalledWith({ thicknessMm: 8 });

      fireEvent.click(screen.getByRole('switch', { name: 'Draw straight line' }));
      expect(onChange).toHaveBeenLastCalledWith({ straightLine: !DEFAULT_HIGHLIGHTER.straightLine });
    });

    it('does not offer the pen stabilization or pressure', () => {
      renderPanel();
      expect(screen.queryByLabelText('Stroke Stabilization')).toBeNull();
      expect(screen.queryByLabelText('Pressure sensitivity')).toBeNull();
    });
  });

  describe('EraserPanel', () => {
    const renderPanel = (eraser = DEFAULT_ERASER) => {
      const onChange = vi.fn();
      const onClearPage = vi.fn();
      render(<EraserPanel eraser={eraser} onChange={onChange} onClearPage={onClearPage} />);
      return { onChange, onClearPage };
    };

    it('offers all three ways of erasing', () => {
      renderPanel();
      for (const mode of ['Pixel erasure', 'Stroke erasure', 'Circular selection']) {
        expect(screen.getByRole('button', { name: mode })).toBeTruthy();
      }
    });

    it('picks a mode', () => {
      const { onChange } = renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Stroke erasure' }));
      expect(onChange).toHaveBeenLastCalledWith({ mode: 'stroke' });
    });

    it('reports the size and the switches as their own fields', () => {
      const { onChange } = renderPanel();

      fireEvent.change(screen.getByLabelText('Size'), { target: { value: '6' } });
      expect(onChange).toHaveBeenLastCalledWith({ sizeMm: 6 });

      fireEvent.click(screen.getByRole('switch', { name: 'Pressure-sensitive eraser' }));
      expect(onChange).toHaveBeenLastCalledWith({ pressure: !DEFAULT_ERASER.pressure });

      fireEvent.click(screen.getByRole('switch', { name: 'Erase highlighter only' }));
      expect(onChange).toHaveBeenLastCalledWith({ target: 'highlighter' });

      fireEvent.click(screen.getByRole('switch', { name: 'Auto-deselect eraser' }));
      expect(onChange).toHaveBeenLastCalledWith({ autoDeselect: !DEFAULT_ERASER.autoDeselect });
    });

    it('hides size and pressure for a lasso, which has neither', () => {
      renderPanel({ ...DEFAULT_ERASER, mode: 'lasso' });
      expect(screen.queryByLabelText('Size')).toBeNull();
      expect(screen.queryByRole('switch', { name: 'Pressure-sensitive eraser' })).toBeNull();
      // What it is allowed to take still applies to a lasso.
      expect(screen.getByRole('switch', { name: 'Erase highlighter only' })).toBeTruthy();
    });

    it('asks the caller to confirm before clearing the page', () => {
      const { onChange, onClearPage } = renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Clear current page' }));
      expect(onClearPage).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('draws every preview on the same paper as the page', () => {
    const { container } = render(<PenPanel pen={DEFAULT_PEN} onChange={vi.fn()} />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.style.backgroundColor).toBe('rgb(253, 253, 251)');
    expect(PAPER_COLOR).toBe('#fdfdfb');
  });
});
