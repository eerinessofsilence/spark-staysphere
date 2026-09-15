'use client';

import * as React from 'react';
import type { Size } from '@/components/site/cover-fit';
import { coverRect } from '@/components/site/cover-fit';
import type { SpinnerFrame } from '@/lib/domain/schemas';
import { loadOrder } from './orbit';

const PRELOAD_BATCH_DESKTOP = 12;
const PRELOAD_BATCH_MOBILE = 8;
const BACKGROUND_BATCH_DELAY_MS = 120;
const FRAME_LOAD_RETRY_DELAY_MS = 1000;

/**
 * Fetches an orbit's frames nearest-first — the opening frame and a batch
 * either side at once, then the rest of the ring in the background — so
 * arriving costs one frame, not the whole sequence, and a later spin never
 * waits on the network. A frame that fails is retried once; the opening frame
 * failing twice sets `hasError`, and the spinner falls back to its still photo.
 */
export function useFrameSequence(frames: SpinnerFrame[], frameCount: number, openingFrame: number) {
  const imagesRef = React.useRef<(HTMLImageElement | null)[]>([]);
  const readyRef = React.useRef<Set<number>>(new Set());
  // Bumped per decoded frame, so a frame the guest is waiting on is drawn the moment it lands.
  const [readyCount, setReadyCount] = React.useState(0);
  const [hasError, setHasError] = React.useState(false);
  const openingRef = React.useRef(openingFrame);

  const loadFrame = React.useCallback(
    (index: number, retried = false) => {
      if (imagesRef.current[index]) return;
      const frame = frames[index];
      if (!frame) return;
      const image = new Image();
      imagesRef.current[index] = image;
      image.decoding = 'async';
      image.onload = () => {
        readyRef.current.add(index);
        setReadyCount((count) => count + 1);
      };
      image.onerror = () => {
        imagesRef.current[index] = null;
        if (!retried) {
          window.setTimeout(() => loadFrame(index, true), FRAME_LOAD_RETRY_DELAY_MS);
        } else if (index === openingRef.current) {
          setHasError(true);
        }
      };
      image.src = frame.imageUrl;
    },
    [frames],
  );

  React.useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    // A batch is that many frames on each side of the centre.
    const perSide = touch ? PRELOAD_BATCH_MOBILE : PRELOAD_BATCH_DESKTOP;
    const order = loadOrder(openingRef.current, frameCount);
    const firstBatch = 1 + perSide * 2;
    order.slice(0, firstBatch).forEach((index) => loadFrame(index));

    let next = firstBatch;
    const timer = window.setInterval(() => {
      order.slice(next, next + perSide * 2).forEach((index) => loadFrame(index));
      next += perSide * 2;
      if (next >= order.length) window.clearInterval(timer);
    }, BACKGROUND_BATCH_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [loadFrame, frameCount]);

  /** The decoded image for `index`, or `null` while it is still on its way. */
  const readyImage = React.useCallback(
    (index: number): HTMLImageElement | null => (readyRef.current.has(index) ? (imagesRef.current[index] ?? null) : null),
    // `readyCount` is what makes a newly decoded frame come back non-null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readyCount],
  );

  return { readyImage, hasError };
}

/**
 * Draws one frame onto the stage's canvas, cover-cropped like a photograph.
 * One canvas rather than an `<img>` per frame: a 160-frame orbit would
 * otherwise leave 160 full-size images in the DOM after one full turn.
 *
 * The backing store is resized only when the stage is — resizing clears the
 * canvas, and a frame that hasn't decoded yet should leave the last one
 * showing rather than flash the stage empty mid-drag.
 */
export function useCanvasFrame(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  image: HTMLImageElement | null,
  stage: Size,
  frame: Size,
) {
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || stage.width === 0 || stage.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(stage.width * dpr);
    const height = Math.round(stage.height * dpr);
    const context = canvas.getContext('2d');
    if (!context) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!image) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const rect = coverRect(frame, stage);
    context.clearRect(0, 0, stage.width, stage.height);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }, [canvasRef, image, stage.width, stage.height, frame.width, frame.height]);
}
