import type { MediaAsset, MediaLibraryPort } from "../domain/ports";
import manifest from "./media-manifest.generated.json";
import { getMediaBucket } from "./cloudflare-env";

export { isEquirectangular, isPanorama } from "../domain/media";

/**
 * The CMS's whole media library: every WebP under `public/images/**`, minus
 * the spinner's orbit frames, with dimensions read from each file's own
 * header at build time by `scripts/generate-media-manifest.mjs`. Uploaded
 * photographs are added from the MEDIA bucket at request time.
 */
export const mediaManifest: MediaAsset[] = manifest;

export function findMediaAsset(url: string): MediaAsset | undefined {
  return mediaManifest.find((asset) => asset.url === url);
}

function assetOf(object: R2Object): MediaAsset | undefined {
  const meta = object.customMetadata;
  if (!meta?.filename || !meta.width || !meta.height) return undefined;
  return {
    url: `/media/${object.key}`,
    folder: "uploads",
    filename: meta.filename,
    width: Number(meta.width),
    height: Number(meta.height),
    bytes: object.size,
  };
}

/** Committed photographs plus durable uploads, whose metadata lives on each R2 object. */
export const mediaLibraryPort: MediaLibraryPort = {
  async list() {
    const bucket = getMediaBucket();
    if (!bucket) return mediaManifest;
    const uploaded: MediaAsset[] = [];
    let cursor: string | undefined;
    do {
      const options: R2ListOptions & { include: string[] } = {
        prefix: "photos/",
        cursor,
        include: ["customMetadata"],
      };
      const page = await bucket.list(options);
      for (const object of page.objects) {
        const asset = assetOf(object);
        if (asset) uploaded.push(asset);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return [...uploaded, ...mediaManifest];
  },
  async find(url) {
    const seed = findMediaAsset(url);
    if (seed) return seed;
    if (!url.startsWith("/media/photos/")) return undefined;
    const object = await getMediaBucket()?.head(url.slice("/media/".length));
    return object ? assetOf(object) : undefined;
  },
  async upload({ hotelId, filename, width, height, bytes }) {
    const bucket = getMediaBucket();
    if (!bucket) throw new Error("Photo storage is unavailable.");
    const key = `photos/${hotelId}/${crypto.randomUUID()}.webp`;
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: "image/webp",
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { filename, width: String(width), height: String(height) },
    });
    return {
      url: `/media/${key}`,
      folder: "uploads",
      filename,
      width,
      height,
      bytes: bytes.byteLength,
    };
  },
};
