import type { MediaAsset } from './ports';

/** `public/images/panoramas` is the only folder equirectangular captures live in. */
export function isPanorama(asset: MediaAsset): boolean {
  return asset.folder === 'panoramas';
}

/** Equirectangular is 2:1 within a per-mille of rounding from a real capture. */
export function isEquirectangular(asset: MediaAsset): boolean {
  return Math.abs(asset.width / asset.height - 2) < 0.01;
}
