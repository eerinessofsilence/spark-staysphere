/** Downsize camera images before upload or offline storage; D1 keeps a compact evidence copy. */
export async function prepareHousekeepingPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Нужно фото JPEG, PNG или WebP.');
  const image = await createImageBitmap(file).catch(() => { throw new Error('Не удалось открыть фото. Выберите другое.'); });
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) { image.close(); throw new Error('Не удалось обработать фото.'); }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
  if (!blob || blob.size > 700_000) throw new Error('Фото слишком большое. Выберите другое.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать фото.'));
    reader.readAsDataURL(blob);
  });
}
