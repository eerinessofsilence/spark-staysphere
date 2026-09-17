/** `image/webp` → `webp`, etc. Falls back to a generic extension for anything unrecognised. */
const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function extensionFor(contentType: string): string {
  return EXTENSIONS[contentType] ?? 'bin';
}

export function frameKey(hotelId: string, frameSetId: string, index: number, contentType: string): string {
  return `spinner/${hotelId}/${frameSetId}/${String(index).padStart(3, '0')}.${extensionFor(contentType)}`;
}

/**
 * R2-backed frame storage. Every function takes the bucket explicitly and is
 * dispatched by `durable-spinner-frame-storage.ts` — nothing here decides
 * whether R2 is in use, same shape as `spinner-markup-d1.ts`.
 */
export async function putFrame(
  bucket: R2Bucket,
  input: { hotelId: string; frameSetId: string; index: number; contentType: string; bytes: ArrayBuffer },
): Promise<string> {
  const key = frameKey(input.hotelId, input.frameSetId, input.index, input.contentType);
  await bucket.put(key, input.bytes, {
    httpMetadata: { contentType: input.contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });
  return `/media/${key}`;
}

export async function deleteFrameSet(bucket: R2Bucket, hotelId: string, frameSetId: string): Promise<void> {
  const prefix = `spinner/${hotelId}/${frameSetId}/`;
  // R2's list is paginated; a frame set is at most a few hundred objects, so
  // one or two pages cover it, but loop rather than assume one page is enough.
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor });
    if (listed.objects.length > 0) await bucket.delete(listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}
