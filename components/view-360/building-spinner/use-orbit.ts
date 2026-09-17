'use client';

import * as React from 'react';
import { dragSteps, nearestKeyAngle, nextStop, ringDelta, wrap } from './orbit';

/** A mouse needs a deliberate push before the building moves; a finger is allowed to be twitchier. */
const DRAG_THRESHOLD_MOUSE_PX = 50;
const DRAG_THRESHOLD_TOUCH_PX = 8;
/**
 * Frames a second while travelling between stops. Capped at a 60Hz screen's own
 * rate: the old 15ms interval asked for ~67, and the frames the display could
 * not present were dropped unevenly, which is what read as judder.
 */
const STEP_FPS = 60;
/** Stops queued while an animation is already running; beyond this, presses are dropped. */
const STOP_QUEUE_MAX = 10;

interface DragState {
  startX: number;
  startFrame: number;
  moved: boolean;
  pointerId: number;
  threshold: number;
}

interface UseOrbitOptions {
  frameCount: number;
  /** Sorted ascending — the stops the arrows and arrow keys jump between. */
  keyAngles: number[];
  openingFrame: number;
  /** Off for a hidden cross-fade layer or the still fallback: neither may take drags or keys. */
  enabled: boolean;
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
export function useOrbit({ frameCount, keyAngles, openingFrame, enabled, onTurnStart }: UseOrbitOptions) {
  const [frameIndex, setFrameIndex] = React.useState(openingFrame);
  const [isTurning, setIsTurning] = React.useState(false);
  const frameRef = React.useRef(frameIndex);
  frameRef.current = frameIndex;
  const onTurnStartRef = React.useRef(onTurnStart);
  onTurnStartRef.current = onTurnStart;

  const show = React.useCallback((next: number) => {
    if (next === frameRef.current) return;
    frameRef.current = next;
    setFrameIndex(next);
  }, []);

  // ---- stops ----------------------------------------------------------------

  const queueRef = React.useRef<number[]>([]);
  const animationRef = React.useRef<number | null>(null);
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
      setIsTurning(false);
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
    const startedAt = performance.now();
    let stepped = 0;
    setIsTurning(true);
    onTurnStartRef.current();
    const tick = (now: number) => {
      // Where the clock says the turn should be, not one frame per tick: the
      // journey then takes the same time on a 120Hz screen as on a 60Hz one.
      // Never more than a frame at a time, so a late tick holds the turn where
      // it is rather than jumping a gap across the facade.
      const due = Math.floor(((now - startedAt) / 1000) * STEP_FPS);
      stepped = Math.min(total, Math.max(stepped, Math.min(due, stepped + 1)));
      show(wrap(from + direction * stepped, frameCount));
      if (stepped >= total) {
        animationRef.current = null;
        runQueue();
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [frameCount, show]);

  /** Turns to the next stop the given way round; queued behind a turn already under way. */
  const turn = React.useCallback(
    (direction: 1 | -1) => {
      if (queueRef.current.length >= STOP_QUEUE_MAX) return;
      const stop = nextStop(keyAngles, intendedRef.current, direction, frameCount);
      if (stop === null) return;
      intendedRef.current = stop;
      queueRef.current.push(stop);
      runQueue();
    },
    [keyAngles, frameCount, runQueue],
  );

  React.useEffect(() => () => stopAnimation(), [stopAnimation]);

  // ---- drag and keys --------------------------------------------------------

  const dragRef = React.useRef<DragState | null>(null);
  /** Whether the press that just ended travelled — a marker's click reads this to ignore a drag. */
  const draggedRef = React.useRef(false);

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
    };
    draggedRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(deltaX) < drag.threshold) return;
      // Now it is a drag: it takes over from any turn in progress, from wherever that turn reached.
      stopAnimation();
      queueRef.current = [];
      drag.startFrame = frameRef.current;
      drag.moved = true;
      draggedRef.current = true;
      event.currentTarget.setPointerCapture(drag.pointerId);
      setIsTurning(true);
      onTurnStartRef.current();
    }
    const next = wrap(drag.startFrame + dragSteps(deltaX, frameCount), frameCount);
    intendedRef.current = next;
    show(next);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return; // A press that never became a drag leaves an arrow turn running — and its markers hidden.

    // Settle a free drag onto the nearest key angle: a spinner-markup zone
    // only ever exists on one of those frames (see
    // docs/decisions/0006-spinner-markup.md), so a drag left anywhere else
    // would strand the guest somewhere no zone could ever show.
    const target = nearestKeyAngle(keyAngles, frameRef.current, frameCount);
    if (target === null || target === frameRef.current) {
      setIsTurning(false);
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
