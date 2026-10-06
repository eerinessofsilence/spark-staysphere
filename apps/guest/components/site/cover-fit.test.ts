import { describe, expect, it } from 'vitest';
import { coverRect, projectOnCover } from './cover-fit';

const frame = { width: 1600, height: 900 };

describe('coverRect', () => {
  it('fills the box exactly when the aspect ratios match', () => {
    expect(coverRect(frame, { width: 800, height: 450 })).toEqual({ x: 0, y: 0, width: 800, height: 450 });
  });

  it('crops the sides of a wide frame in a tall box, keeping it centred', () => {
    // A 16:9 frame covering a 390×844 phone stage scales to the stage's height.
    const rect = coverRect(frame, { width: 390, height: 844 });
    expect(rect.height).toBe(844);
    expect(rect.width).toBeCloseTo(1500.44, 2);
    expect(rect.x).toBeCloseTo((390 - rect.width) / 2, 6);
    expect(rect.y).toBe(0);
  });

  it('crops top and bottom of a tall photo in a wide box', () => {
    const rect = coverRect({ width: 1000, height: 1500 }, { width: 1000, height: 500 });
    expect(rect).toEqual({ x: 0, y: -500, width: 1000, height: 1500 });
  });
});

describe('projectOnCover', () => {
  it('puts the photo centre at the box centre however it is cropped', () => {
    const box = { width: 390, height: 844 };
    expect(projectOnCover({ x: 0.5, y: 0.5 }, frame, box)).toEqual({ x: 195, y: 422 });
  });

  it('maps a corner fraction to where the cropped photo actually starts', () => {
    const point = projectOnCover({ x: 0, y: 0 }, { width: 1000, height: 1500 }, { width: 1000, height: 500 });
    expect(point).toEqual({ x: 0, y: -500 });
  });
});
