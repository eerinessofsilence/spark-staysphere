import type { MediaAsset } from './ports';

/** `public/images/panoramas` is the only folder equirectangular captures live in. */
export function isPanorama(asset: MediaAsset): boolean {
  return asset.folder === 'panoramas';
}

/** Equirectangular is 2:1 within a per-mille of rounding from a real capture. */
export function isEquirectangular(asset: MediaAsset): boolean {
  return Math.abs(asset.width / asset.height - 2) < 0.01;
}

/** A panorama goes into a gallery as a 360° view and everything else as a photo — never a choice to get wrong. */
export function mediaTypeOf(asset: MediaAsset): 'image' | '360' {
  return isPanorama(asset) && isEquirectangular(asset) ? '360' : 'image';
}

/** "second-bedroom-2.webp" → "Second bedroom": a starting label a person only has to check. */
export function labelFromFilename(filename: string): string {
  const words = filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/-\d+$/, '')
    .split(/[-_]+/)
    .filter(Boolean)
    .join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Photo';
}

/** "rooms/deluxe-sea" → "Rooms · Deluxe sea". */
export function folderLabel(folder: string): string {
  return folder
    .split('/')
    .map((part) => part.replace(/-/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' · ');
}
