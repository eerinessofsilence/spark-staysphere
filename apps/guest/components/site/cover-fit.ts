export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Where `object-fit: cover` puts `media` inside `box`: scaled until it covers
 * both sides, then centred, so `x`/`y` go negative on whichever axis is cropped.
 */
export function coverRect(media: Size, box: Size): Point & Size {
  const scale = Math.max(box.width / media.width, box.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

/**
 * A point stored as fractions of `media`, in `box` pixels after the cover crop
 * — how a hotspot stays on the balcony it points at whatever the viewport.
 */
export function projectOnCover(point: Point, media: Size, box: Size): Point {
  const rect = coverRect(media, box);
  return { x: rect.x + point.x * rect.width, y: rect.y + point.y * rect.height };
}
