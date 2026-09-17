import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  centroid,
  curveFromPoint,
  curvesOf,
  edgeControlPoint,
  edgeCurve,
  edgeMidpoint,
  flattenPolygon,
  hasCurves,
  packEdgeCurve,
  pointInPolygon,
  pointsOf,
  polygonArea,
  selfIntersects,
  snapPolygonToNeighbours,
  toNormalized,
  toPathData,
  toPixels,
  type Point,
  type Polygon,
} from './geometry';

const SQUARE: Polygon = {
  points: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
};
const TRIANGLE: Polygon = {
  points: [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
};

// Degenerate cases — the usual source of editor bugs.
const TWO_POINTS: Polygon = { points: [[0.2, 0.2], [0.8, 0.8]] };
const DUPLICATES: Polygon = {
  points: [
    [0, 0],
    [1, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
};
const COLLINEAR: Polygon = { points: [[0, 0], [0.5, 0], [1, 0]] };

describe('pointsOf', () => {
  it('reads the point list', () => {
    expect(pointsOf(SQUARE)).toEqual(SQUARE.points);
  });
});

describe('toPixels / toNormalized', () => {
  it('turns normalized coordinates into pixels', () => {
    expect(toPixels(SQUARE, 2000, 1000)).toEqual([
      [0, 0],
      [2000, 0],
      [2000, 1000],
      [0, 1000],
    ]);
  });

  it('round-trips back to the original coordinates', () => {
    const source: Point[] = [[0.1234, 0.5678], [0.9, 0.25]];
    expect(toNormalized(toPixels({ points: source }, 2048, 1152), 2048, 1152)).toEqual(source);
  });

  it('swapping the image for another resolution does not move the markup', () => {
    // The same normalized coordinates at 2048px and at 4096px give the same
    // fraction of the frame — that is the entire point of normalizing them.
    const polygon: Polygon = { points: [[0.25, 0.5]] };
    expect(toPixels(polygon, 2048, 1024)).toEqual([[512, 512]]);
    expect(toPixels(polygon, 4096, 2048)).toEqual([[1024, 1024]]);
    expect(toNormalized(toPixels(polygon, 4096, 2048), 4096, 2048)).toEqual(polygon.points);
  });

  it('clamps overflow past the frame edges into [0, 1]', () => {
    expect(toNormalized([[-50, -10], [3000, 2000]], 1000, 1000)).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('rounds to 6 decimal places', () => {
    // 1/3 = 0.3333333333… → 0.333333
    expect(toNormalized([[1, 2]], 3, 3)).toEqual([[0.333333, 0.666667]]);
  });

  it('throws on a zero size: a broken asset would otherwise silently break every normalization', () => {
    expect(() => toPixels(SQUARE, 0, 100)).toThrow(/Invalid image size/);
    expect(() => toNormalized([[1, 1]], 100, 0)).toThrow(/Invalid image size/);
    expect(() => toNormalized([[1, 1]], -100, 100)).toThrow(/Invalid image size/);
  });

  it('an empty polygon turns into an empty one', () => {
    expect(toPixels({ points: [] }, 100, 100)).toEqual([]);
    expect(toNormalized([], 100, 100)).toEqual([]);
  });
});

describe('pointInPolygon', () => {
  it('tells inside from outside', () => {
    expect(pointInPolygon([0.5, 0.5], SQUARE)).toBe(true);
    expect(pointInPolygon([1.5, 0.5], SQUARE)).toBe(false);
    expect(pointInPolygon([0.5, -0.1], SQUARE)).toBe(false);
  });

  it('works on a non-convex polygon', () => {
    // An L-shape: a notch cut from the top-right corner.
    const shape: Polygon = { points: [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]] };
    expect(pointInPolygon([0.5, 1.5], shape)).toBe(true);
    expect(pointInPolygon([1.5, 1.5], shape)).toBe(false);
    expect(pointInPolygon([1.5, 0.5], shape)).toBe(true);
  });

  it('degenerate polygons contain nothing', () => {
    expect(pointInPolygon([0.5, 0.5], TWO_POINTS)).toBe(false);
    expect(pointInPolygon([0.5, 0], COLLINEAR)).toBe(false);
    expect(pointInPolygon([0, 0], { points: [] })).toBe(false);
  });
});

describe('polygonArea', () => {
  it('computes a unit square', () => {
    expect(polygonArea(SQUARE)).toBe(1);
  });

  it('computes a triangle', () => {
    expect(polygonArea(TRIANGLE)).toBe(0.5);
  });

  it('does not depend on winding direction', () => {
    const reversed: Polygon = { points: [...SQUARE.points].reverse() };
    expect(polygonArea(reversed)).toBe(1);
  });

  it('degenerate polygons have zero area', () => {
    expect(polygonArea(TWO_POINTS)).toBe(0);
    expect(polygonArea(COLLINEAR)).toBe(0);
    expect(polygonArea({ points: [] })).toBe(0);
    expect(polygonArea({ points: [[1, 1]] })).toBe(0);
  });

  it('duplicate points do not distort the area', () => {
    expect(polygonArea(DUPLICATES)).toBe(1);
  });
});

describe('centroid', () => {
  it('finds the square center', () => {
    expect(centroid(SQUARE)).toEqual([0.5, 0.5]);
  });

  it('finds the triangle center', () => {
    const [x, y] = centroid(TRIANGLE)!;
    expect(x).toBeCloseTo(1 / 3, 10);
    expect(y).toBeCloseTo(1 / 3, 10);
  });

  it('duplicate points do not shift the center', () => {
    const [x, y] = centroid(DUPLICATES)!;
    expect(x).toBeCloseTo(0.5, 10);
    expect(y).toBeCloseTo(0.5, 10);
  });

  it('falls back to the vertex average at zero area', () => {
    // The centroid formula divides by area — on a segment or collinear
    // points that is division by zero. A label still has to land somewhere.
    expect(centroid(TWO_POINTS)).toEqual([0.5, 0.5]);
    expect(centroid(COLLINEAR)).toEqual([0.5, 0]);
    expect(centroid({ points: [[0.3, 0.7]] })).toEqual([0.3, 0.7]);
  });

  it('an empty polygon has no center', () => {
    expect(centroid({ points: [] })).toBeNull();
  });
});

describe('boundingBox', () => {
  it('encloses the polygon', () => {
    const box = boundingBox({ points: [[0.2, 0.8], [0.6, 0.1], [0.4, 0.5]] })!;
    expect(box.minX).toBe(0.2);
    expect(box.minY).toBe(0.1);
    expect(box.maxX).toBe(0.6);
    expect(box.maxY).toBe(0.8);
    // width/height are floating-point differences — exact equality here
    // would be unfair: 0.6 − 0.2 isn't exactly 0.4 in binary floating point.
    expect(box.width).toBeCloseTo(0.4, 12);
    expect(box.height).toBeCloseTo(0.7, 12);
  });

  it('a single point has a zero-size box', () => {
    expect(boundingBox({ points: [[0.5, 0.5]] })).toEqual({
      minX: 0.5,
      minY: 0.5,
      maxX: 0.5,
      maxY: 0.5,
      width: 0,
      height: 0,
    });
  });

  it('duplicate points do not affect the box', () => {
    expect(boundingBox(DUPLICATES)).toEqual(boundingBox(SQUARE));
  });

  it('an empty polygon has no box', () => {
    expect(boundingBox({ points: [] })).toBeNull();
  });
});

describe('rounded sides', () => {
  // A square whose top side bows outward.
  const CURVED: Polygon = { points: [[0, 0], [1, 0], [1, 1], [0, 1]], curves: [0.5, 0, 0, 0] };

  it('a polygon with no curves field reads as straight', () => {
    expect(curvesOf(SQUARE)).toEqual([]);
    expect(curvesOf(TRIANGLE)).toEqual([]);
    expect(hasCurves(SQUARE)).toBe(false);
    expect(hasCurves({ points: SQUARE.points, curves: [0, 0, 0, 0] })).toBe(false);
    expect(hasCurves(CURVED)).toBe(true);
  });

  it('the control point sits on the chord perpendicular', () => {
    // Side (0,0)→(1,0): the perpendicular runs down the Y axis.
    expect(edgeControlPoint([0, 0], [1, 0], 0.5)).toEqual([0.5, 0.5]);
    expect(edgeControlPoint([0, 0], [1, 0], -0.5)).toEqual([0.5, -0.5]);
    expect(edgeControlPoint([0, 0], [1, 0], 0)).toEqual([0.5, 0]);
  });

  it('the curve midpoint sits at half the control point offset', () => {
    expect(edgeMidpoint([0, 0], [1, 0], 0.5)).toEqual([0.5, 0.25]);
    expect(edgeMidpoint([0, 0], [1, 0], 0)).toEqual([0.5, 0]);
  });

  it('curveFromPoint inverts edgeMidpoint', () => {
    const a: Point = [0.2, 0.3];
    const b: Point = [0.8, 0.5];

    for (const curve of [[0, -1.2], [0, 0.4], [0.3, 0.5], [-0.25, 0], [0.1, -0.7]] as const) {
      const back = curveFromPoint(a, b, edgeMidpoint(a, b, curve as [number, number]));
      expect(back[0]).toBeCloseTo(curve[0], 10);
      expect(back[1]).toBeCloseTo(curve[1], 10);
    }
  });

  it('the handle moves along the chord too, not just across it', () => {
    const a: Point = [0, 0];
    const b: Point = [1, 0];
    // A pure along-chord offset: the handle slides toward the right end, no bow.
    expect(edgeMidpoint(a, b, [0.4, 0])).toEqual([0.7, 0]);
    // And back the other way.
    expect(curveFromPoint(a, b, [0.7, 0])[0]).toBeCloseTo(0.4, 10);
    expect(curveFromPoint(a, b, [0.7, 0])[1]).toBeCloseTo(0, 10);
  });

  it('the old bare-number form reads as a pure across-chord bow', () => {
    expect(edgeCurve(0.5)).toEqual([0, 0.5]);
    expect(edgeCurve([0.2, 0.5])).toEqual([0.2, 0.5]);
    expect(edgeCurve(0)).toEqual([0, 0]);
    expect(edgeCurve(undefined)).toEqual([0, 0]);
    // Polygons drawn before the along-chord offset existed still draw the same.
    expect(edgeControlPoint([0, 0], [1, 0], 0.5)).toEqual(edgeControlPoint([0, 0], [1, 0], [0, 0.5]));
  });

  it('packs compactly', () => {
    expect(packEdgeCurve(0, 0)).toBe(0);
    expect(packEdgeCurve(0, 0.5)).toBe(0.5);
    expect(packEdgeCurve(0.2, 0.5)).toEqual([0.2, 0.5]);
  });

  it('a degenerate side has zero curvature, not infinite', () => {
    expect(curveFromPoint([0.5, 0.5], [0.5, 0.5], [0.9, 0.9])).toEqual([0, 0]);
  });

  it('a straight polygon\'s path is made of segments', () => {
    expect(toPathData(SQUARE, 100, 200)).toBe('M 0.0,0.0 L 100.0,0.0 L 100.0,200.0 L 0.0,200.0 Z');
  });

  it('a rounded polygon\'s path uses a quadratic curve', () => {
    const path = toPathData(CURVED, 100, 200);
    expect(path.startsWith('M 0.0,0.0 Q 50.0,100.0 100.0,0.0 L')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    // Exactly one curve — the other three sides are straight.
    expect([...path.matchAll(/Q /g)]).toHaveLength(1);
    // Three straight sides, but Z draws the closing one — two segments in the path.
    expect([...path.matchAll(/L /g)]).toHaveLength(2);
  });

  it('a curved closing side is drawn as a curve', () => {
    const closing: Polygon = { points: [[0, 0], [1, 0], [1, 1]], curves: [0, 0, 0.5] };
    // Side (1,1)→(0,0): dx = dy = -1, control point [1, 0] → in pixels 10,0
    expect(toPathData(closing, 10, 10)).toBe('M 0.0,0.0 L 10.0,0.0 L 10.0,10.0 Q 10.0,0.0 0.0,0.0 Z');
  });

  it('swapping the image does not move a curved side', () => {
    // The path on a doubled frame is exactly the doubled path: the curve is affine.
    const small = toPathData(CURVED, 100, 200);
    const large = toPathData(CURVED, 200, 400);
    const doubled = small.replace(/[\d.]+/g, (n) => (Number(n) * 2).toFixed(1));
    expect(large).toBe(doubled);
  });

  it('flattenPolygon splits the curve and leaves straight sides alone', () => {
    expect(flattenPolygon(SQUARE)).toEqual(SQUARE.points);
    expect(flattenPolygon(CURVED, 8)).toHaveLength(4 + 7);
    // The first inserted point lies between the ends of the bowed side.
    const flat = flattenPolygon(CURVED, 8);
    expect(flat[1]![0]).toBeGreaterThan(0);
    expect(flat[1]![1]).toBeGreaterThan(0);
  });

  it('a heavily bowed side is caught as a self-intersection after flattening', () => {
    // Both horizontal sides bow toward each other and overlap.
    const crossing: Polygon = { points: [[0, 0], [1, 0], [1, 0.3], [0, 0.3]], curves: [1.2, 0, 1.2, 0] };
    expect(selfIntersects(crossing.points)).toBe(false);
    expect(selfIntersects(flattenPolygon(crossing))).toBe(true);
  });
});

describe('snapPolygonToNeighbours', () => {
  const SIZE = { width: 1000, height: 1000, tolerance: 6 };

  it('pulls a vertex to a neighbour\'s vertex', () => {
    // The right side of the left polygon and the left side of the right one
    // are 2px apart.
    const left: Polygon = { points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] };
    const right: Polygon = { points: [[0.502, 0], [1, 0], [1, 0.5], [0.502, 0.5]] };

    const { points, snapped } = snapPolygonToNeighbours(right, [left], SIZE);
    expect(snapped).toBe(2);
    expect(points[0]).toEqual([0.5, 0]);
    expect(points[3]).toEqual([0.5, 0.5]);
    // Distant vertices are left alone.
    expect(points[1]).toEqual([1, 0]);
  });

  it('leaves anything farther than the tolerance alone', () => {
    const left: Polygon = { points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] };
    const far: Polygon = { points: [[0.6, 0], [1, 0], [1, 0.5], [0.6, 0.5]] };

    const { points, snapped } = snapPolygonToNeighbours(far, [left], SIZE);
    expect(snapped).toBe(0);
    expect(points).toEqual(far.points);
  });

  it('sits a vertex on a neighbour\'s side when no vertex of its own is near', () => {
    const wall: Polygon = { points: [[0, 0], [0, 1], [0.5, 1], [0.5, 0]] };
    // The vertex hangs mid-wall, 3px from it.
    const neighbour: Polygon = { points: [[0.503, 0.5], [1, 0.4], [1, 0.6]] };

    const { points, snapped } = snapPolygonToNeighbours(neighbour, [wall], SIZE);
    expect(snapped).toBe(1);
    expect(points[0]).toEqual([0.5, 0.5]);
  });

  it('a neighbour\'s vertex outranks its side', () => {
    // The point is nearly equidistant from the neighbour's corner and its
    // side — the corner must win.
    const box: Polygon = { points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] };
    const corner: Polygon = { points: [[0.502, 0.502], [0.9, 0.9], [0.9, 0.5]] };

    const { points } = snapPolygonToNeighbours(corner, [box], SIZE);
    expect(points[0]).toEqual([0.5, 0.5]);
  });

  it('snaps to a rounded wall by its curve, not its chord', () => {
    // The right wall bows outward: the perpendicular to (0,1) is (-1,0), so
    // negative curvature bows outward. The curve's midpoint sits at x = 0.6.
    const curved: Polygon = { points: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]], curves: [0, -0.2, 0, 0] };
    // A point near the bulge: 98px from the chord at x = 0.5, only 2px from the curve.
    const probe: Polygon = { points: [[0.598, 0.5], [0.9, 0.4], [0.9, 0.6]] };

    const { snapped, points } = snapPolygonToNeighbours(probe, [curved], SIZE);
    expect(snapped).toBe(1);
    expect(points[0]![0]).toBeGreaterThan(0.59);
    expect(points[0]![0]).toBeLessThan(0.601);
  });

  it('does not throw with no neighbours or no points', () => {
    expect(snapPolygonToNeighbours(SQUARE, [], SIZE).snapped).toBe(0);
    expect(snapPolygonToNeighbours({ points: [] }, [SQUARE], SIZE).points).toEqual([]);
  });
});

describe('selfIntersects', () => {
  it('catches a bowtie', () => {
    expect(selfIntersects([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(true);
  });

  it('catches a crossing in the middle of a complex contour', () => {
    expect(selfIntersects([[0, 0], [4, 0], [4, 4], [2, -1], [0, 4]])).toBe(true);
  });

  it('passes normal polygons', () => {
    expect(selfIntersects(SQUARE)).toBe(false);
    expect(selfIntersects(TRIANGLE)).toBe(false);
    // Non-convex is fine too.
    expect(selfIntersects([[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]])).toBe(false);
  });

  it('fewer than four points cannot cross', () => {
    expect(selfIntersects([])).toBe(false);
    expect(selfIntersects([[0, 0]])).toBe(false);
    expect(selfIntersects(TWO_POINTS)).toBe(false);
    expect(selfIntersects(COLLINEAR)).toBe(false);
  });

  it('duplicate and collinear points do not count as self-intersection', () => {
    // Otherwise the editor would block saving polygons the operator drew
    // perfectly correctly — they just clicked the same point twice.
    expect(selfIntersects(DUPLICATES)).toBe(false);
    expect(selfIntersects([[0, 0], [0.5, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
    expect(selfIntersects([[0, 0], [0, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
  });
});
