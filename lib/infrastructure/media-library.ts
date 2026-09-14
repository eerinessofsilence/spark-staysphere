import type { MediaAsset, MediaLibraryPort } from '../domain/ports';
import manifest from './media-manifest.generated.json';

export { isEquirectangular, isPanorama } from '../domain/media';

/**
 * The CMS's whole media library: every WebP under `public/images/**`, minus
 * the spinner's orbit frames, with dimensions read from each file's own
 * header at build time by `scripts/generate-media-manifest.mjs`. There is no
 * upload path in v1 (`.openai/hosting.json` has `r2: null`), so this
 * committed JSON is the entire vocabulary the picker in `/admin/content` and
 * `content-service.ts`'s "url must be in the media library" rule can offer.
 */
export const mediaManifest: MediaAsset[] = manifest;

export function findMediaAsset(url: string): MediaAsset | undefined {
  return mediaManifest.find((asset) => asset.url === url);
}

export const mediaLibraryPort: MediaLibraryPort = {
  list: () => mediaManifest,
  find: findMediaAsset,
};
