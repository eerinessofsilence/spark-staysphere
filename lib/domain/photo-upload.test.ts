import { describe, expect, it } from 'vitest';
import { imageDimensions, jpegDimensions, pngDimensions } from './photo-upload';

describe('photo dimensions', () => {
  it('reads JPEG dimensions from a SOF marker', () => {
    const bytes = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08,
      0x02, 0x58, 0x04, 0xb0, 0x03,
      0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xd9,
    ]).buffer;
    expect(jpegDimensions(bytes)).toEqual({ width: 1200, height: 600 });
    expect(imageDimensions(bytes, 'image/jpeg')).toEqual({ width: 1200, height: 600 });
  });

  it('reads PNG dimensions from IHDR', () => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    new DataView(bytes.buffer).setUint32(16, 1600, false);
    new DataView(bytes.buffer).setUint32(20, 800, false);
    expect(pngDimensions(bytes.buffer)).toEqual({ width: 1600, height: 800 });
  });
});
