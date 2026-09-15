import { describe, expect, it } from 'vitest';
import { hitTest, isClick, pointInPolygon, readTranslate, type ScreenPolygon } from './sphere-geometry';

const square: ScreenPolygon = [
  [10, 10],
  [110, 10],
  [110, 110],
  [10, 110],
];

describe('readTranslate', () => {
  it("reads Pannellum's translate back into pixels, negative and fractional included", () => {
    expect(readTranslate('translate(120.5px, -40px) translateZ(9999px)')).toEqual([120.5, -40]);
  });

  it('is null for a transform with no translate', () => {
    expect(readTranslate('')).toBeNull();
    expect(readTranslate('scale(2)')).toBeNull();
  });
});

describe('pointInPolygon', () => {
  it('finds a point inside and rejects one outside', () => {
    expect(pointInPolygon(square, 60, 60)).toBe(true);
    expect(pointInPolygon(square, 5, 60)).toBe(false);
    expect(pointInPolygon(square, 60, 200)).toBe(false);
  });

  it('handles a concave outline by the even–odd rule', () => {
    // A "U": the notch between the arms is outside.
    const u: ScreenPolygon = [
      [0, 0],
      [30, 0],
      [30, 70],
      [70, 70],
      [70, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    expect(pointInPolygon(u, 50, 30)).toBe(false);
    expect(pointInPolygon(u, 15, 30)).toBe(true);
    expect(pointInPolygon(u, 50, 90)).toBe(true);
  });
});

describe('hitTest', () => {
  it('returns the id of the polygon under the point, or null', () => {
    const polygons = { pool: square, spa: square.map(([x, y]) => [x + 200, y] as [number, number]) };
    expect(hitTest(polygons, 60, 60)).toBe('pool');
    expect(hitTest(polygons, 260, 60)).toBe('spa');
    expect(hitTest(polygons, 160, 60)).toBeNull();
  });
});

describe('isClick', () => {
  it('treats a press that barely moved as a click and a longer one as a drag', () => {
    expect(isClick({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
    expect(isClick({ x: 0, y: 0 }, { x: 6, y: 1 })).toBe(false);
  });
});
