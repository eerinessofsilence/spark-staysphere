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
 * Downloads frames nearest-first, but prepares bitmap resources only for the
 * requested arc. Background bitmap creation must not compete with an active
 * turn. A frame is retried once; a broken opening or requested frame falls
 * back to the still photo. The bitmap cache fits any shortest arc without
 * retaining the entire ring's uncompressed pixels.
 */
export function useFrameSequence(frames: SpinnerFrame[], frameCount: number, openingFrame: number) {
  const imagesRef = React.useRef<(HTMLImageElement | null)[]>([]);
  const bitmapsRef = React.useRef<(ImageBitmap | null)[]>([]);
  const requestedRef = React.useRef(new Set<number>());
  const preparingRef = React.useRef(new Set<number>());
  const generationRef = React.useRef(0);
  const retriesRef = React.useRef(new Set<number>());
  const readyRef = React.useRef<Set<number>>(new Set());
  const failedRef = React.useRef<Set<number>>(new Set());
  const listenersRef = React.useRef(new Set<(index: number) => void>());
  const [isOpeningReady, setIsOpeningReady] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const openingRef = React.useRef(openingFrame);

  const loadFrame = React.useCallback(
    (index: number, retried = false, prepare = false) => {
      if (prepare) requestedRef.current.add(index);
      if (readyRef.current.has(index)) return;
      const frame = frames[index];
      if (!frame) return;
      const existing = imagesRef.current[index];
      const image = existing ?? new Image();
      const generation = generationRef.current;
      const failed = () => {
        if (generation !== generationRef.current) return;
        image.onload = null;
        image.onerror = null;
        preparingRef.current.add(index);
        if (!retried) {
          const timer = window.setTimeout(() => {
            retriesRef.current.delete(timer);
            imagesRef.current[index] = null;
            preparingRef.current.delete(index);
            loadFrame(index, true);
          }, FRAME_LOAD_RETRY_DELAY_MS);
          retriesRef.current.add(timer);
        } else {
          failedRef.current.add(index);
          if (index === openingRef.current) setHasError(true);
        }
      };
      const prepareImage = async () => {
        if (preparingRef.current.has(index)) return;
        preparingRef.current.add(index);
        try {
          await image.decode();
          let bitmap: ImageBitmap | null = null;
          try {
            bitmap = await createImageBitmap(image);
          } catch {
            // Browsers without bitmap support can still draw the decoded image.
          }
          if (generation !== generationRef.current) {
            bitmap?.close();
            return;
          }
          bitmapsRef.current[index] = bitmap;
          preparingRef.current.delete(index);
          readyRef.current.add(index);
          while (readyRef.current.size > Math.ceil(frameCount / 2) + 1) {
            const oldest = readyRef.current.values().next().value;
            if (oldest === undefined) break;
            bitmapsRef.current[oldest]?.close();
            bitmapsRef.current[oldest] = null;
            readyRef.current.delete(oldest);
          }
          if (bitmap) {
            image.onload = null;
            image.onerror = null;
            imagesRef.current[index] = null;
            image.src = '';
          }
          if (index === openingRef.current) setIsOpeningReady(true);
          listenersRef.current.forEach((listener) => listener(index));
        } catch {
          failed();
        }
      };
      if (existing) {
        if (prepare && image.complete && image.naturalWidth > 0) void prepareImage();
        return;
      }
      imagesRef.current[index] = image;
      image.decoding = 'async';
      image.onload = () => {
        if (requestedRef.current.has(index)) void prepareImage();
      };
      image.onerror = failed;
      image.src = frame.imageUrl;
    },
    [frames, frameCount],
  );

  React.useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    // A batch is that many frames on each side of the centre.
    const perSide = touch ? PRELOAD_BATCH_MOBILE : PRELOAD_BATCH_DESKTOP;
    const order = loadOrder(openingRef.current, frameCount);
    const firstBatch = 1 + perSide * 2;
    order.slice(0, firstBatch).forEach((index) => loadFrame(index, false, index === openingRef.current));

    let next = firstBatch;
    const timer = window.setInterval(() => {
      order.slice(next, next + perSide * 2).forEach((index) => loadFrame(index));
      next += perSide * 2;
      if (next >= order.length) window.clearInterval(timer);
    }, BACKGROUND_BATCH_DELAY_MS);
    return () => {
      window.clearInterval(timer);
      generationRef.current += 1;
      retriesRef.current.forEach((retry) => window.clearTimeout(retry));
      retriesRef.current.clear();
      imagesRef.current.forEach((image) => {
        if (!image) return;
        image.onload = null;
        image.onerror = null;
      });
      bitmapsRef.current.forEach((bitmap) => bitmap?.close());
      imagesRef.current = [];
      bitmapsRef.current = [];
      readyRef.current.clear();
      failedRef.current.clear();
      requestedRef.current.clear();
      preparingRef.current.clear();
    };
  }, [loadFrame, frameCount]);

  /** The decoded image for `index`, or `null` while it is still on its way. */
  const readyImage = React.useCallback(
    (index: number): HTMLImageElement | ImageBitmap | null =>
      readyRef.current.has(index) ? (bitmapsRef.current[index] ?? imagesRef.current[index] ?? null) : null,
    [],
  );

  const subscribe = React.useCallback((listener: (index: number) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  /** Prioritise a requested frame instead of waiting for its background batch. */
  const isFrameReady = React.useCallback(
    (index: number) => {
      if (readyRef.current.has(index)) {
        readyRef.current.delete(index);
        readyRef.current.add(index);
        return true;
      }
      if (failedRef.current.has(index) || !frames[index]) {
        setHasError(true);
        return false;
      }
      loadFrame(index, false, true);
      return false;
    },
    [frames, loadFrame],
  );

  return { readyImage, isFrameReady, subscribe, isOpeningReady, hasError };
}

/**
 * Draws one frame onto the stage's canvas, cover-cropped like a photograph.
 * One canvas rather than an `<img>` per frame: a 160-frame orbit would
 * otherwise leave 160 full-size images in the DOM after one full turn.
 *
 * Painting runs directly inside the orbit's animation callback, without a
 * React render/effect between selecting a frame and presenting it. React only
 * handles resize and subscription lifetimes.
 */
export function useCanvasFrame(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  sequence: Pick<ReturnType<typeof useFrameSequence>, 'readyImage' | 'subscribe'>,
  openingFrame: number,
  stage: Size,
  frame: Size,
) {
  const currentFrameRef = React.useRef(openingFrame);
  const drawnImageRef = React.useRef<HTMLImageElement | ImageBitmap | null>(null);
  const configRef = React.useRef({ readyImage: sequence.readyImage, stage, frame });
  configRef.current = { readyImage: sequence.readyImage, stage, frame };

  const drawFrame = React.useCallback((index: number): boolean => {
    const { readyImage, stage, frame } = configRef.current;
    const image = readyImage(index);
    const canvas = canvasRef.current;
    if (!image || !canvas || stage.width === 0 || stage.height === 0) return false;
    const rect = coverRect(frame, stage);
    // Extra backing pixels beyond the capture's resolution add raster work, not detail.
    const dpr = Math.min(window.devicePixelRatio || 1, 2, frame.width / rect.width);
    const width = Math.round(stage.width * dpr);
    const height = Math.round(stage.height * dpr);
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) return false;
    if (image === drawnImageRef.current && canvas.width === width && canvas.height === height) return true;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(width / stage.width, 0, 0, height / stage.height, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    // The opaque cover image fills the stage; clearing first only adds another full-canvas pass.
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    currentFrameRef.current = index;
    drawnImageRef.current = image;
    return true;
  }, [canvasRef]);

  React.useLayoutEffect(() => {
    drawnImageRef.current = null;
    drawFrame(currentFrameRef.current);
  }, [drawFrame, stage.width, stage.height, frame.width, frame.height]);

  React.useLayoutEffect(() => sequence.subscribe((index) => {
    if (index === currentFrameRef.current) drawFrame(index);
  }), [sequence.subscribe, drawFrame]);

  return drawFrame;
}
