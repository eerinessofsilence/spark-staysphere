'use client';

import * as React from 'react';
import { dragSteps, nearestKeyAngle, nextStop, ringDelta, wrap } from './orbit';

/** A mouse needs a deliberate push before the building moves; a finger is allowed to be twitchier. */
const DRAG_THRESHOLD_MOUSE_PX = 50;
const DRAG_THRESHOLD_TOUCH_PX = 8;
/** Peak frame rate between stops; easing spends longer on the first and last frames. */
const STEP_FPS = 60;
const TURN_RAMP_MS = 120;
/** Stops queued while an animation is already running; beyond this, presses are dropped. */
const STOP_QUEUE_MAX = 10;

interface DragState {
  startX: number;
  startFrame: number;
  moved: boolean;
  pointerId: number;
  threshold: number;
  latestX: number;
  targetFrame: number;
}

interface UseOrbitOptions {
  frameCount: number;
  /** Sorted ascending — the stops the arrows and arrow keys jump between. */
  keyAngles: number[];
  openingFrame: number;
  /** Off for a hidden cross-fade layer or the still fallback: neither may take drags or keys. */
  enabled: boolean;
  /** Requests a missing frame and returns true only once it is decoded. */
  isFrameReady: (index: number) => boolean;
  /** Paints synchronously in the current animation frame; false if the stage is not ready. */
  drawFrame: (index: number) => boolean;
  /** Called as a turn begins — a drag crossing its threshold, or a stop animation starting. */
  onTurnStart: () => void;
}

/**
 * Which frame the orbit is on, and every way a guest turns it: dragging, the
 * arrow buttons and the arrow keys.
 *
 * The arrows jump to the next `keyAngles` stop and animate the frames in
 * between — stepping 160 frames one at a time is unusable. A press during an
 * animation queues the next stop instead of being dropped, and steps on from
 * where the queued presses will finish, not from the frame on screen. Only a
 * real drag interrupts a turn; a click anywhere on the stage leaves it to
 * finish on its stop.
 *
 * Pointer capture is taken only once a drag crosses its threshold: capturing
 * on press retargets the following `click` to the stage, so a tap on a marker
 * would never reach the marker (see docs/TROUBLESHOOTING.md).
 */
export function useOrbit({ frameCount, keyAngles, openingFrame, enabled, isFrameReady, drawFrame, onTurnStart }: UseOrbitOptions) {
  // React tracks the settled frame for zones and deep links, not every canvas repaint.
  const [frameIndex, setFrameIndex] = React.useState(openingFrame);
  const [isTurning, setIsTurning] = React.useState(false);
  const frameRef = React.useRef(frameIndex);
  const onTurnStartRef = React.useRef(onTurnStart);
  onTurnStartRef.current = onTurnStart;
  const isFrameReadyRef = React.useRef(isFrameReady);
  isFrameReadyRef.current = isFrameReady;
  const drawFrameRef = React.useRef(drawFrame);
  drawFrameRef.current = drawFrame;

  const show = React.useCallback((next: number) => {
    if (!isFrameReadyRef.current(frameRef.current) || !isFrameReadyRef.current(next)) return false;
    if (!drawFrameRef.current(next)) return false;
    frameRef.current = next;
    return true;
  }, []);

  const settle = React.useCallback(() => {
    setFrameIndex(frameRef.current);
    setIsTurning(false);
  }, []);

  // ---- stops ----------------------------------------------------------------

  const queueRef = React.useRef<number[]>([]);
  const animationRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  /** Where the presses so far will finish. */
  const intendedRef = React.useRef(frameIndex);

  const stopAnimation = React.useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const runQueue = React.useCallback(() => {
    if (animationRef.current !== null) return;
    const target = queueRef.current.shift();
    if (target === undefined) {
      settle();
      return;
    }
    const delta = ringDelta(frameRef.current, target, frameCount);
    if (delta === 0) {
      runQueue();
      return;
    }
    const direction = delta > 0 ? 1 : -1;
    const total = Math.abs(delta);
    const from = frameRef.current;
    const speed = STEP_FPS / 1000;
    const ramp = Math.min(TURN_RAMP_MS, total / speed);
    const duration = total / speed + ramp;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const path = reducedMotion
      ? [from, target]
      : Array.from({ length: total + 1 }, (_, step) => wrap(from + direction * step, frameCount));
    path.forEach((index) => isFrameReadyRef.current(index));
    let buffered = false;
    let previousTick = performance.now();
    let elapsed = 0;
    let stepped = 0;
    setIsTurning(true);
    onTurnStartRef.current();
    const tick = (now: number) => {
      const deltaMs = Math.min(now - previousTick, 64);
      previousTick = now;
      // Decode the whole requested arc before moving, so loading cannot interrupt its middle.
      if (!buffered) {
        buffered = path.every((index) => isFrameReadyRef.current(index));
        if (!buffered) {
          animationRef.current = requestAnimationFrame(tick);
          return;
        }
      }
      const nextElapsed = Math.min(duration, elapsed + deltaMs);
      const remaining = duration - nextElapsed;
      const distance = nextElapsed < ramp
        ? speed * nextElapsed * nextElapsed / (2 * ramp)
        : remaining < ramp
          ? total - speed * remaining * remaining / (2 * ramp)
          : speed * (nextElapsed - ramp / 2);
      // Sample the clock directly: late paints must not leave an accumulating frame backlog.
      const nextStep = reducedMotion || nextElapsed >= duration ? total : Math.floor(distance);
      if (show(wrap(from + direction * nextStep, frameCount))) {
        elapsed = nextElapsed;
        stepped = nextStep;
      }
      if (stepped >= total) {
        animationRef.current = null;
        runQueue();
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [frameCount, show, settle]);

  /** Turns to the next stop the given way round; queued behind a turn already under way. */
  const turn = React.useCallback(
    (direction: 1 | -1) => {
      if (!enabled || dragRef.current?.moved) return;
      if (queueRef.current.length >= STOP_QUEUE_MAX) return;
      const stop = nextStop(keyAngles, intendedRef.current, direction, frameCount);
      if (stop === null) return;
      intendedRef.current = stop;
      queueRef.current.push(stop);
      runQueue();
    },
    [enabled, keyAngles, frameCount, runQueue],
  );

  React.useEffect(() => () => stopAnimation(), [stopAnimation]);

  // ---- drag and keys --------------------------------------------------------

  /** Whether the press that just ended travelled — a marker's click reads this to ignore a drag. */
  const draggedRef = React.useRef(false);

  React.useEffect(() => {
    if (enabled) return;
    stopAnimation();
    queueRef.current = [];
    dragRef.current = null;
    intendedRef.current = frameRef.current;
    settle();
  }, [enabled, stopAnimation, settle]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!enabled) return;
    // Only a candidate until it travels. A press that turns out to be a click —
    // a near miss on the turn controls, a tap on the stage — must not cut short
    // a turn the arrows started, or the orbit is left between two stops.
    dragRef.current = {
      startX: event.clientX,
      startFrame: frameRef.current,
      moved: false,
      pointerId: event.pointerId,
      threshold: event.pointerType === 'mouse' ? DRAG_THRESHOLD_MOUSE_PX : DRAG_THRESHOLD_TOUCH_PX,
      latestX: event.clientX,
      targetFrame: frameRef.current,
    };
    draggedRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!enabled || !drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    drag.latestX = event.clientX;
    if (!drag.moved) {
      if (Math.abs(deltaX) < drag.threshold) return;
      // Now it is a drag: it takes over from any turn in progress, from wherever that turn reached.
      stopAnimation();
      queueRef.current = [];
      drag.startX = event.clientX;
      drag.startFrame = frameRef.current;
      drag.targetFrame = frameRef.current;
      intendedRef.current = frameRef.current;
      drag.moved = true;
      draggedRef.current = true;
      event.currentTarget.setPointerCapture(drag.pointerId);
      setIsTurning(true);
      onTurnStartRef.current();
      return;
    }
    drag.targetFrame = wrap(drag.startFrame + dragSteps(deltaX, frameCount), frameCount);
    if (animationRef.current !== null) return;
    animationRef.current = requestAnimationFrame(() => {
      animationRef.current = null;
      if (show(drag.targetFrame)) {
        intendedRef.current = frameRef.current;
      } else {
        // Discard movement made while loading rather than replaying it as a sudden leap.
        drag.startX = drag.latestX;
        drag.startFrame = frameRef.current;
        drag.targetFrame = frameRef.current;
      }
    });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return; // A press that never became a drag leaves an arrow turn running — and its markers hidden.
    stopAnimation();
    show(drag.targetFrame);

    // Settle a free drag onto the nearest key angle: a spinner-markup zone
    // only ever exists on one of those frames (see
    // the PMS editor), so a drag left anywhere else
    // would strand the guest somewhere no zone could ever show.
    const target = nearestKeyAngle(keyAngles, frameRef.current, frameCount);
    if (target === null || target === frameRef.current) {
      intendedRef.current = frameRef.current;
      settle();
      return;
    }
    intendedRef.current = target;
    queueRef.current.push(target);
    runQueue();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!enabled) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      turn(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      turn(1);
    }
  };

  const wasDrag = React.useCallback(() => draggedRef.current, []);

  return {
    frameIndex,
    /** True while the building is moving; markers step aside so they never smear across the turn. */
    isTurning,
    turn,
    wasDrag,
    stageHandlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown },
  };
}
