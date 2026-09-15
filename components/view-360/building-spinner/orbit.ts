import type { Point } from '@/components/site/cover-fit';
import type { SpinnerHotspot } from '@/lib/domain/schemas';

/**
 * The building spinner's arithmetic, kept free of React and the DOM so every
 * rule about where the orbit is — which frame, which stop, where a hotspot
 * sits — is a plain function with a unit test (`orbit.test.ts`).
 *
 * Frames form a ring: index `frameCount` is frame 0 again, and every distance
 * is measured the short way round.
 */

/** Roughly a full turn per 700px of drag, whatever the frame count. */
export const DRAG_PX_PER_TURN = 700;

export function wrap(index: number, count: number): number {
  return ((index % count) + count) % count;
}

/** Shortest signed distance from `from` to `to` around a ring of `count`. */
export function ringDelta(from: number, to: number, count: number): number {
  const forward = wrap(to - from, count);
  return forward <= count - forward ? forward : forward - count;
}

/** Frames a horizontal drag of `deltaX` pixels turns the building by; positive turns right. */
export function dragSteps(deltaX: number, frameCount: number): number {
  return Math.round((deltaX / DRAG_PX_PER_TURN) * frameCount);
}

/**
 * The next key-angle stop the given way round from `from`, never `from`
 * itself; `null` when there is nowhere else to go.
 */
export function nextStop(keyAngles: number[], from: number, direction: 1 | -1, frameCount: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const angle of keyAngles) {
    const distance = direction === 1 ? wrap(angle - from, frameCount) : wrap(from - angle, frameCount);
    if (distance === 0) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = angle;
    }
  }
  return best;
}

/**
 * A hotspot's keyframes, prepared once. Sorting and filtering them per frame —
 * for every hotspot, twice, on every step of a drag — was throwing away a few
 * hundred objects a frame and showed up as a stutter as soon as the facade had
 * a marker for each of its storeys. Keyframes never change, so this is done
 * when the spinner mounts and only the interpolation is left per frame.
 */
export interface HotspotTrack {
  /** Frame the arc opens on, and how many frames it runs for. */
  first: number;
  total: number;
  positions: Array<Point & { pos: number }>;
}

/**
 * The arc runs forward (wrapping) from a hotspot's first keyframe to its last —
 * authored in that sweep order, not necessarily ascending frame numbers.
 */
export function buildTrack(hotspot: SpinnerHotspot, frameCount: number): HotspotTrack {
  const first = hotspot.keyframes[0]!.frameIndex;
  const last = hotspot.keyframes[hotspot.keyframes.length - 1]!.frameIndex;
  const positions = hotspot.keyframes
    .map((keyframe) => ({ pos: wrap(keyframe.frameIndex - first, frameCount), x: keyframe.x, y: keyframe.y }))
    .sort((a, b) => a.pos - b.pos);
  return { first, total: wrap(last - first, frameCount), positions };
}

/** Where a hotspot sits at `frameIndex`, as fractions of the frame, or `null` outside its visible arc. */
export function hotspotPosition(track: HotspotTrack, frameIndex: number, frameCount: number): Point | null {
  const pos = wrap(frameIndex - track.first, frameCount);
  if (pos > track.total) return null;

  const entries = track.positions;
  let lower = entries[0]!;
  let upper = entries[entries.length - 1]!;
  for (let i = 0; i < entries.length - 1; i += 1) {
    if (pos >= entries[i]!.pos && pos <= entries[i + 1]!.pos) {
      lower = entries[i]!;
      upper = entries[i + 1]!;
      break;
    }
  }
  const span = upper.pos - lower.pos;
  const t = span === 0 ? 0 : (pos - lower.pos) / span;
  return { x: lower.x + (upper.x - lower.x) * t, y: lower.y + (upper.y - lower.y) * t };
}

/** A frame roughly in the middle of a hotspot's visible arc — for a deep link with no explicit frame. */
export function midArcFrame(hotspot: SpinnerHotspot, frameCount: number): number {
  const first = hotspot.keyframes[0]!.frameIndex;
  const last = hotspot.keyframes[hotspot.keyframes.length - 1]!.frameIndex;
  return wrap(first + Math.round(wrap(last - first, frameCount) / 2), frameCount);
}

/**
 * The frame the orbit opens on: an explicit `?frame=N`; else mid-arc of the
 * `?unit=` hotspot; else the first key angle — frame 0 isn't necessarily a
 * face of the building, so it lands on the stop the property listed first.
 */
export function openingFrame(input: {
  frameCount: number;
  /** Sorted ascending. */
  keyAngles: number[];
  hotspots: SpinnerHotspot[];
  initialFrame?: number;
  focusHotspotId?: string | null;
}): number {
  if (typeof input.initialFrame === 'number') return wrap(input.initialFrame, input.frameCount);
  const focused = input.focusHotspotId
    ? input.hotspots.find((hotspot) => hotspot.id === input.focusHotspotId)
    : undefined;
  if (focused) return midArcFrame(focused, input.frameCount);
  return input.keyAngles[0] ?? 0;
}

/** Where a hotspot sits front-on, for the still-photo fallback: its frame-0 keyframe, else its first. */
export function frontOnPoint(hotspot: SpinnerHotspot): Point {
  return hotspot.keyframes.find((keyframe) => keyframe.frameIndex === 0) ?? hotspot.keyframes[0]!;
}

/**
 * Every frame once, nearest `center` first — `center`, then one either side,
 * then two, and so on — the order the sequence is fetched in, so whichever
 * way the guest turns first the frames are already there.
 */
export function loadOrder(center: number, frameCount: number): number[] {
  const order = [wrap(center, frameCount)];
  const seen = new Set(order);
  for (let offset = 1; seen.size < frameCount; offset += 1) {
    for (const index of [wrap(center + offset, frameCount), wrap(center - offset, frameCount)]) {
      if (!seen.has(index)) {
        seen.add(index);
        order.push(index);
      }
    }
  }
  return order;
}
