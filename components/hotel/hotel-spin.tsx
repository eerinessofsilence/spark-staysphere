'use client';

import * as React from 'react';
import { CaretLeft, CaretRight, HandSwipeLeft } from '@phosphor-icons/react/dist/ssr';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * The building as an orbit a guest can turn: an aerial pass around the
 * property, stepped frame by frame under the drag. The capture is an arc
 * rather than a full circle, so the turn stops at either end instead of
 * wrapping into a cut.
 *
 * Every frame is fetched before the drag is armed — a half-loaded orbit
 * turns into blank gaps mid-gesture, which reads as breakage rather than
 * loading.
 */

interface HotelSpinProps {
  hotelName: string;
  /** Frames in orbit order. */
  frames: string[];
  className?: string;
}

export function HotelSpin({ hotelName, frames, className }: HotelSpinProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const [loaded, setLoaded] = React.useState(0);
  const [turned, setTurned] = React.useState(false);

  const ready = loaded >= frames.length;

  React.useEffect(() => {
    let live = true;
    let done = 0;
    for (const src of frames) {
      const image = new Image();
      const count = () => {
        if (!live) return;
        done += 1;
        setLoaded(done);
      };
      image.onload = count;
      image.onerror = count;
      image.src = src;
    }
    return () => {
      live = false;
    };
  }, [frames]);

  const step = React.useCallback(
    (by: number) => {
      setTurned(true);
      setIndex((current) => Math.min(frames.length - 1, Math.max(0, current + by)));
    },
    [frames.length],
  );

  const drag = React.useRef<{ x: number; from: number } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!ready) return;
    drag.current = { x: event.clientX, from: index };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const width = stageRef.current?.clientWidth ?? 1;
    // One drag across the stage covers the whole orbit.
    const perFrame = width / frames.length;
    const moved = Math.round((start.x - event.clientX) / perFrame);
    if (moved !== 0) setTurned(true);
    setIndex(Math.min(frames.length - 1, Math.max(0, start.from + moved)));
  }

  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={stageRef}
        role="group"
        aria-label={`${hotelName} from the air — drag to turn`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            step(-1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            step(1);
          }
        }}
        className={cn(
          'relative aspect-video touch-pan-y overflow-hidden rounded-[28px] border border-border bg-stone select-none',
          'outline-none focus-visible:border-accent',
          ready ? 'cursor-grab active:cursor-grabbing' : 'cursor-progress',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- frames are
            preloaded and swapped by index; the loader would refetch each one. */}
        <img
          src={frames[index]}
          alt={`${hotelName} seen from the air`}
          draggable={false}
          className="pointer-events-none size-full object-cover"
        />

        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-stone/70 backdrop-blur-sm">
            <p className="text-sm font-medium text-muted-foreground">
              {Math.round((loaded / frames.length) * 100)}%
            </p>
          </div>
        )}

        {ready && !turned && (
          <div className="glass pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium sm:bottom-6">
            <HandSwipeLeft weight="fill" className="size-5" aria-hidden="true" />
            Drag to turn the building
          </div>
        )}
      </div>

      {/* The turn as a control of its own, for a guest who would rather press
          than drag — and the only affordance a keyboard has. */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!ready || index === 0}
          aria-label="Turn left"
          className={iconButton('light')}
        >
          <CaretLeft weight="fill" className="size-5" aria-hidden="true" />
        </button>
        <span className="w-16 text-center text-sm font-semibold tabular-nums text-muted-foreground">
          {index + 1} / {frames.length}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!ready || index === frames.length - 1}
          aria-label="Turn right"
          className={iconButton('light')}
        >
          <CaretRight weight="fill" className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
