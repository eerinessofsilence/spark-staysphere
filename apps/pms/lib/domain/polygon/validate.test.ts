import { describe, expect, it } from 'vitest';
import { checkPolygon, parseSaveBatch } from './validate';
import type { Polygon } from './geometry';

const ID = '3f2b8c1e-6a4d-4f0e-9b7a-2c5d8e1f0a3b';
const OTHER_ID = '9a1c2e3f-4b5d-4c6e-8f7a-0b1c2d3e4f5a';
const SQUARE: Polygon = { points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]] };
// A "bowtie": the sides cross.
const BOWTIE = { points: [[0.1, 0.1], [0.4, 0.4], [0.4, 0.1], [0.1, 0.4]] };

describe('checkPolygon', () => {
  it('passes a normal polygon through as-is', () => {
    expect(checkPolygon(SQUARE)).toEqual(SQUARE);
  });

  it('drops an empty curves field, keeps a non-empty one', () => {
    expect(checkPolygon({ ...SQUARE, curves: [] })).toEqual({ points: SQUARE.points });
    expect(checkPolygon({ ...SQUARE, curves: [0.2, [0.1, -0.2]] })).toEqual({
      points: SQUARE.points,
      curves: [0.2, [0.1, -0.2]],
    });
  });

  it('drops extra fields on the polygon', () => {
    expect(checkPolygon({ ...SQUARE, color: 'red' })).toEqual({ points: SQUARE.points });
  });

  it.each([
    ['no points', {}, 'no point list'],
    ['two points', { points: [[0, 0], [1, 1]] }, 'fewer than three points'],
    ['pixels instead of fractions', { points: [[10, 10], [400, 10], [400, 400]] }, 'outside 0..1'],
    ['NaN', { points: [[0, 0], [Number.NaN, 0], [1, 1]] }, 'not a number'],
    ['a point that is not a pair', { points: [[0, 0], [1], [1, 1]] }, 'not a pair of numbers'],
    ['a bowtie', BOWTIE, 'cross themselves'],
    ['curvature not a list', { ...SQUARE, curves: 0.2 }, 'must be a list'],
    ['more curves than sides', { ...SQUARE, curves: [0, 0, 0, 0, 0] }, 'more curves than sides'],
    ['excessive curvature', { ...SQUARE, curves: [5] }, 'implausibly'],
  ])('rejects: %s', (_, polygon, message) => {
    expect(() => checkPolygon(polygon)).toThrow(message);
  });

  it('catches a self-intersection only a bowed side produces', () => {
    // A thin rectangle: the top side is bowed downward hard enough that the
    // arc crosses the bottom side, though the vertex-to-vertex polyline is clean.
    const thin = { points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.15], [0.1, 0.15]], curves: [0.5] };
    expect(() => checkPolygon(thin)).toThrow('cross themselves');
  });

  it('names the polygon\'s position in the batch', () => {
    expect(() => checkPolygon({ points: [] }, 2)).toThrow('Polygon #3');
  });
});

describe('parseSaveBatch', () => {
  it('parses the batch and drops extra fields', () => {
    const batch = { upserts: [{ id: ID, polygon: SQUARE, extra: 1 }], deletes: [OTHER_ID] };
    expect(parseSaveBatch(batch)).toEqual({ rows: [{ id: ID, polygon: SQUARE }], deletes: [OTHER_ID] });
  });

  it('an empty batch is not an error', () => {
    expect(parseSaveBatch({})).toEqual({ rows: [], deletes: [] });
  });

  it('rejects a malformed id', () => {
    expect(() => parseSaveBatch({ upserts: [{ id: '1', polygon: SQUARE }] })).toThrow('Invalid id');
    expect(() => parseSaveBatch({ deletes: ['drop table'] })).toThrow('Invalid id');
  });

  it('rejects a non-list', () => {
    expect(() => parseSaveBatch({ upserts: {} })).toThrow('must be a list');
  });
});
