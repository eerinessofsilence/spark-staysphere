/** Decode with HTMLImageElement, including iOS browsers without createImageBitmap. */
export async function documentPhotoCanvas(photo: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(photo);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to open document photo'));
      image.src = url;
    });
    const scale = Math.min(2, 2600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface DocumentImageRegion { left: number; top: number; width: number; height: number }

/** Enlarge the MRZ and suppress coloured security patterns before OCR. Memory only. */
export function documentMrzCanvas(source: HTMLCanvasElement, region: DocumentImageRegion): HTMLCanvasElement {
  const scale = Math.min(3, 2400 / region.width);
  const border = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(region.width * scale) + border * 2;
  canvas.height = Math.round(region.height * scale) + border * 2;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, region.left, region.top, region.width, region.height,
    border, border, canvas.width - border * 2, canvas.height - border * 2);
  const pixels = context.getImageData(border, border, canvas.width - border * 2, canvas.height - border * 2);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grey = Math.round(pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114);
    pixels.data[i] = grey;
    histogram[grey]++;
  }
  const count = pixels.data.length / 4;
  const percentile = (fraction: number) => {
    let total = 0;
    for (let i = 0; i < histogram.length; i++) {
      total += histogram[i];
      if (total >= count * fraction) return i;
    }
    return 255;
  };
  const dark = percentile(0.005);
  const range = percentile(0.85) - dark;
  for (let i = 0; i < pixels.data.length; i += 4) {
    // A nearly uniform crop should stay uniform; stretching it would turn
    // a blank/light page black and erase faint text.
    const grey = range < 30 ? pixels.data[i] : Math.max(0, Math.min(255, Math.round((pixels.data[i] - dark) * 255 / range)));
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = grey;
  }
  context.putImageData(pixels, border, border);
  return canvas;
}
