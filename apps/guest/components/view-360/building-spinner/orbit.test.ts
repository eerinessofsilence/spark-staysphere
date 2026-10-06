import { describe, expect, it } from 'vitest';
import type { SpinnerHotspot } from '@/lib/domain/schemas';
import {
  buildTrack,
  dragSteps,
  frontOnPoint,
  hotspotPosition,
  loadOrder,
  midArcFrame,
  nearestKeyAngle,
  nextStop,
  openingFrame,
  ringDelta,
  wrap,
} from './orbit';

const FRAMES = 160;

function hotspot(keyframes: Array<[frameIndex: number, x: number, y: number]>, id = 'sea-view'): SpinnerHotspot {
  return {
    id,
    label: 'Sea-view rooms',
    description: '',
    href: '/rooms?view=sea',
    cta: 'See sea-view rooms',
    keyframes: keyframes.map(([frameIndex, x, y]) => ({ frameIndex, x, y })),
  } as SpinnerHotspot;
}

describe('wrap and ringDelta', () => {
  it('wraps both ways round the ring', () => {
    expect(wrap(160, FRAMES)).toBe(0);
    expect(wrap(-1, FRAMES)).toBe(159);
    expect(wrap(325, FRAMES)).toBe(5);
  });

  it('measures the short way round, signed', () => {
    expect(ringDelta(10, 20, FRAMES)).toBe(10);
    expect(ringDelta(20, 10, FRAMES)).toBe(-10);
    expect(ringDelta(150, 5, FRAMES)).toBe(15);
    expect(ringDelta(5, 150, FRAMES)).toBe(-15);
  });
});

describe('dragSteps', () => {
  it('turns a full ring per 700px, in the direction dragged', () => {
    expect(dragSteps(700, FRAMES)).toBe(160);
    expect(dragSteps(-350, FRAMES)).toBe(-80);
    expect(dragSteps(2, FRAMES)).toBe(0);
  });
});

describe('nextStop', () => {
  const stops = [0, 40, 80, 120];

  it('moves to the nearest stop the given way round, never the current one', () => {
    expect(nextStop(stops, 40, 1, FRAMES)).toBe(80);
    expect(nextStop(stops, 40, -1, FRAMES)).toBe(0);
    expect(nextStop(stops, 50, -1, FRAMES)).toBe(40);
  });

  it('wraps past the last stop back to the first', () => {
    expect(nextStop(stops, 130, 1, FRAMES)).toBe(0);
    expect(nextStop(stops, 0, -1, FRAMES)).toBe(120);
  });

  it('has nowhere to go without other stops', () => {
    expect(nextStop([], 10, 1, FRAMES)).toBeNull();
    expect(nextStop([10], 10, 1, FRAMES)).toBeNull();
  });
});

describe('nearestKeyAngle', () => {
  const stops = [0, 40, 80, 120];

  it('returns the frame itself when it is already a stop', () => {
    expect(nearestKeyAngle(stops, 40, FRAMES)).toBe(40);
  });

  it('picks whichever stop is closer, either direction', () => {
    expect(nearestKeyAngle(stops, 50, FRAMES)).toBe(40);
    expect(nearestKeyAngle(stops, 65, FRAMES)).toBe(80);
  });

  it('wraps past the ends of the ring', () => {
    // 150 is 30 short of wrapping to 0, and 30 past 120 — a tie, forward wins.
    expect(nearestKeyAngle(stops, 150, FRAMES)).toBe(0);
    // 135 is 15 past 120 and 45 short of wrapping to 0 — 120 is nearer.
    expect(nearestKeyAngle(stops, 135, FRAMES)).toBe(120);
  });

  it('has nowhere to settle without any stops', () => {
    expect(nearestKeyAngle([], 10, FRAMES)).toBeNull();
  });
});

describe('hotspotPosition', () => {
  it('interpolates between the keyframes that bracket the frame', () => {
    const track = buildTrack(hotspot([[10, 0.2, 0.4], [20, 0.4, 0.6]]), FRAMES);
    expect(hotspotPosition(track, 10, FRAMES)).toEqual({ x: 0.2, y: 0.4 });
    const middle = hotspotPosition(track, 15, FRAMES)!;
    expect(middle.x).toBeCloseTo(0.3, 10);
    expect(middle.y).toBeCloseTo(0.5, 10);
    expect(hotspotPosition(track, 20, FRAMES)).toEqual({ x: 0.4, y: 0.6 });
  });

  it('is hidden outside the arc it faces the camera across', () => {
    const track = buildTrack(hotspot([[10, 0.2, 0.4], [20, 0.4, 0.6]]), FRAMES);
    expect(hotspotPosition(track, 9, FRAMES)).toBeNull();
    expect(hotspotPosition(track, 21, FRAMES)).toBeNull();
  });

  it('follows an arc that wraps through frame 0, in authored sweep order', () => {
    // Authored 150 → 159 → 5: the arc crosses the seam, not 5 → 150 the long way.
    const track = buildTrack(hotspot([[150, 0.1, 0.5], [159, 0.4, 0.5], [5, 0.7, 0.5]]), FRAMES);
    expect(track.total).toBe(15);
    expect(hotspotPosition(track, 0, FRAMES)?.x).toBeCloseTo(0.4 + (0.3 * 1) / 6, 10);
    expect(hotspotPosition(track, 80, FRAMES)).toBeNull();
  });
});

describe('openingFrame', () => {
  const spots = [hotspot([[150, 0.1, 0.5], [10, 0.7, 0.5]], 'sea-view')];

  it('honours an explicit frame first, wrapped onto the ring', () => {
    expect(openingFrame({ frameCount: FRAMES, keyAngles: [40], hotspots: spots, initialFrame: 170, focusHotspotId: 'sea-view' })).toBe(10);
  });

  it("turns to the middle of a focused hotspot's arc", () => {
    expect(midArcFrame(spots[0]!, FRAMES)).toBe(0);
    expect(openingFrame({ frameCount: FRAMES, keyAngles: [40], hotspots: spots, focusHotspotId: 'sea-view' })).toBe(0);
  });

  it('otherwise lands on the first key angle, and on 0 without any', () => {
    expect(openingFrame({ frameCount: FRAMES, keyAngles: [40, 120], hotspots: spots, focusHotspotId: 'missing' })).toBe(40);
    expect(openingFrame({ frameCount: FRAMES, keyAngles: [], hotspots: spots })).toBe(0);
  });

  it("prefers the property's own startFrame over the first key angle", () => {
    expect(
      openingFrame({ frameCount: FRAMES, keyAngles: [40, 120], hotspots: spots, focusHotspotId: 'missing', startFrame: 95 }),
    ).toBe(95);
    // An explicit ?frame= still wins over startFrame.
    expect(
      openingFrame({ frameCount: FRAMES, keyAngles: [40], hotspots: spots, initialFrame: 10, startFrame: 95 }),
    ).toBe(10);
  });
});

describe('frontOnPoint', () => {
  it("prefers the hotspot's frame-0 keyframe and falls back to its first", () => {
    expect(frontOnPoint(hotspot([[150, 0.1, 0.2], [0, 0.5, 0.6]]))).toMatchObject({ x: 0.5, y: 0.6 });
    expect(frontOnPoint(hotspot([[150, 0.1, 0.2], [10, 0.5, 0.6]]))).toMatchObject({ x: 0.1, y: 0.2 });
  });
});

describe('loadOrder', () => {
  it('lists every frame exactly once, nearest the centre first', () => {
    const order = loadOrder(0, 8);
    expect(order).toEqual([0, 1, 7, 2, 6, 3, 5, 4]);
    expect(new Set(loadOrder(37, FRAMES)).size).toBe(FRAMES);
    expect(loadOrder(37, FRAMES)).toHaveLength(FRAMES);
  });
});
