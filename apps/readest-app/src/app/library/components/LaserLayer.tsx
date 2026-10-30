import React, { useEffect, useRef, type MutableRefObject } from 'react';

import {
  trailAlive,
  trailDot,
  trailSegments,
  trimTrail,
  type LaserPoint,
} from '@/services/handwriting/laser';
import { mmToFraction, type LaserSettings } from '@/services/notes/penSettings';

/**
 * The trail, shared between the hand and the drawing.
 *
 * `wake` is how the pointer tells the drawing to start again: the loop stops
 * itself once everything has faded, so there is nothing running while the
 * laser is simply resting in the hand.
 */
export interface LaserTrail {
  points: LaserPoint[];
  wake: (() => void) | null;
}

interface LaserLayerProps {
  trail: MutableRefObject<LaserTrail>;
  settings: LaserSettings;
  width: number;
  height: number;
}

/**
 * The laser's own canvas, above the ink and below nothing.
 *
 * It is separate from the page's canvas on purpose. A fading trail has to be
 * redrawn sixty times a second, and sharing a canvas with the ink would mean
 * redrawing every stroke on the page just as often. Here the ink is painted
 * once and this layer is cleared and redrawn over it.
 *
 * It never takes a pointer event: the ink engine underneath owns those, and
 * it is the one reporting where the hand is.
 */
const LaserLayer: React.FC<LaserLayerProps> = ({ trail, settings, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Read inside the loop rather than depended on, so changing the colour
  // mid-trail does not restart the drawing.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    let running = false;

    const draw = () => {
      const { mode, color, thicknessMm, seconds } = settingsRef.current;
      const duration = seconds * 1000;
      const now = Date.now();
      const held = trail.current;
      held.points = trimTrail(held.points, now, duration);

      ctx.clearRect(0, 0, width, height);
      const thickness = Math.max(1, mmToFraction(thicknessMm) * width);
      const page = (p: [number, number]): [number, number] => [p[0] * width, p[1] * height];

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // The glow: light spilling around the beam, not an outline of it.
      ctx.shadowColor = color;
      ctx.shadowBlur = thickness * 3;

      if (mode === 'dot') {
        const dot = trailDot(held.points, now, duration);
        if (dot) {
          const [x, y] = page(dot.at);
          const radius = thickness * 1.6;
          ctx.globalAlpha = dot.alpha;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          // A hot white centre, which is what makes it read as a light
          // rather than a coloured spot.
          ctx.globalAlpha = dot.alpha * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, radius * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const segments = trailSegments(held.points, now, duration);
        // The coloured beam first, then a thinner white core along it.
        for (const pass of [
          { width: thickness, style: color, scale: 1 },
          { width: thickness * 0.4, style: '#ffffff', scale: 0.85 },
        ]) {
          ctx.lineWidth = pass.width;
          ctx.strokeStyle = pass.style;
          for (const segment of segments) {
            ctx.globalAlpha = segment.alpha * pass.scale;
            const [fx, fy] = page(segment.from);
            const [tx, ty] = page(segment.to);
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      if (trailAlive(held.points, Date.now(), duration)) {
        frame = requestAnimationFrame(draw);
      } else {
        // Nothing left to show: clear once more and stop, so an idle laser
        // costs nothing.
        ctx.clearRect(0, 0, width, height);
        running = false;
      }
    };

    const wake = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(draw);
    };

    trail.current.wake = wake;
    // Something may already be waiting, if the tool was picked up mid-fade.
    if (trail.current.points.length > 0) wake();

    return () => {
      cancelAnimationFrame(frame);
      running = false;
      if (trail.current.wake === wake) trail.current.wake = null;
    };
  }, [trail, width, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className='pointer-events-none absolute inset-0'
      style={{ width, height }}
    />
  );
};

export default LaserLayer;
