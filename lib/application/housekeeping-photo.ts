export type HousekeepingPhotoErrorCode = 'invalid_type' | 'decode_failed' | 'processing_failed' | 'too_large' | 'read_failed';

/** Callers translate `code` themselves — this module has no presentation strings of its own. */
export class HousekeepingPhotoError extends Error {
  constructor(public readonly code: HousekeepingPhotoErrorCode) {
    super(code);
  }
}

/** Downsize camera images before upload or offline storage; D1 keeps a compact evidence copy. */
export async function prepareHousekeepingPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new HousekeepingPhotoError('invalid_type');
  const image = await createImageBitmap(file).catch(() => { throw new HousekeepingPhotoError('decode_failed'); });
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) { image.close(); throw new HousekeepingPhotoError('processing_failed'); }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
  if (!blob || blob.size > 700_000) throw new HousekeepingPhotoError('too_large');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new HousekeepingPhotoError('read_failed'));
    reader.readAsDataURL(blob);
  });
}
