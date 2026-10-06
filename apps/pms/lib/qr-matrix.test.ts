import { describe, expect, it } from 'vitest';
import { qrMatrix } from './qr-matrix';

describe('service menu QR matrix', () => {
  it('encodes a public menu URL as a square with finder patterns', () => {
    const matrix = qrMatrix('https://hotel.example/services/menu?ids=addon_breakfast,addon_transfer');
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    for (const [x, y] of [[0, 0], [matrix.length - 7, 0], [0, matrix.length - 7]]) {
      expect(matrix[y]![x]).toBe(true);
      expect(matrix[y + 1]![x + 1]).toBe(false);
      expect(matrix[y + 3]![x + 3]).toBe(true);
    }
  });
});
