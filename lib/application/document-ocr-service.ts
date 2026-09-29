import type { DocumentOcrProvider, DocumentRecognition } from '@/lib/domain/guest-document';
import { mergeDocumentRecognitions, recognizeDocumentText } from '@/lib/domain/document-mrz';
import { documentPhotoCanvas, documentMrzCanvas, type DocumentImageRegion } from './document-ocr-image';
import type { Page } from 'tesseract.js';

function hasIdentity(result: DocumentRecognition): boolean {
  return ['firstName', 'lastName', 'documentNumber', 'dateOfBirth', 'expirationDate', 'issuingCountry']
    .every((key) => {
      const field = key as keyof DocumentRecognition['fields'];
      return !!result.fields[field] && (result.confidence[field] ?? 0) >= 0.5;
    });
}

function mrzRegion(data: Page, canvas: HTMLCanvasElement): DocumentImageRegion | null {
  const lines = data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)) ?? [];
  const candidates = lines.filter((line) => {
    const text = line.text.toUpperCase().replace(/\s/g, '');
    return /[<«‹]{2}/.test(text) ||
      (text.length >= 28 && /\d{6}[0-9OIL][MFX<]\d{6}/.test(text));
  });
  if (!candidates.length) return null;
  // Include an adjacent row if OCR saw only one MRZ row. Full width avoids
  // clipping the left/right end of a line on a skewed photograph.
  const top = Math.min(...candidates.map((line) => line.bbox.y0));
  const bottom = Math.max(...candidates.map((line) => line.bbox.y1));
  const margin = Math.max(...candidates.map((line) => line.bbox.y1 - line.bbox.y0)) * 2;
  const from = Math.min(canvas.height - 1, Math.max(0, top - margin));
  return { left: 0, top: from, width: canvas.width, height: Math.min(canvas.height, bottom + margin) - from };
}

function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason);
    signal.addEventListener('abort', stop, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
  });
}

/** Browser OCR adapter. Replace this provider without changing booking or guest components. */
const localOcr: DocumentOcrProvider = {
  async recognize(photo, signal) {
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    signal?.throwIfAborted();
    const controller = new AbortController();
    const stop = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', stop, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error('Document recognition timed out')), 90_000);
    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let mrz: HTMLCanvasElement | undefined;
    try {
      const preparing = documentPhotoCanvas(photo);
      void preparing.then((prepared) => {
        if (controller.signal.aborted) prepared.width = prepared.height = 0;
      }, () => {});
      canvas = await abortable(preparing, controller.signal);
      // Tesseract's initialization promise can stay pending if language loading
      // fails. Check the same-origin asset first so failures reach review.
      const language = await fetch('/vendor/document-ocr/eng.traineddata.gz', { method: 'HEAD', signal: controller.signal });
      if (!language.ok || language.headers.get('content-type')?.includes('text/html')) {
        throw new Error('Document recognition data unavailable');
      }
      const creating = createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: '/vendor/document-ocr/worker.min.js',
        corePath: '/vendor/document-ocr', langPath: '/vendor/document-ocr',
        cacheMethod: 'none', workerBlobURL: false,
        logger: () => {}, errorHandler: () => controller.abort(new Error('Document recognition failed')),
      }, { load_system_dawg: '0', load_freq_dawg: '0' });
      // A close/timeout during initialization must also dispose of the worker
      // if its asynchronous creation completes afterwards.
      void creating.then((created) => {
        if (controller.signal.aborted) void created.terminate();
      }, () => {});
      worker = await abortable(creating, controller.signal);
      await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, user_defined_dpi: '300' }), controller.signal);
      const { data } = await abortable(worker.recognize(canvas, { rotateAuto: true }, { text: true, blocks: true }), controller.signal);
      let result = recognizeDocumentText(data.text, data.confidence);
      if (hasIdentity(result)) return result;

      // Read the MRZ separately from the cover page, portrait and bilingual
      // labels. The restricted alphabet prevents dictionary substitutions.
      const detected = mrzRegion(data, canvas);
      const region = detected ?? { left: 0, top: Math.floor(canvas.height * 0.45), width: canvas.width, height: Math.ceil(canvas.height * 0.55) };
      mrz = documentMrzCanvas(canvas, region);
      await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<', preserve_interword_spaces: '1' }), controller.signal);
      const pass = await abortable(worker.recognize(mrz, { rotateAuto: true }, { text: true }), controller.signal);
      result = mergeDocumentRecognitions(result, recognizeDocumentText(pass.data.text, pass.data.confidence));
      if (hasIdentity(result)) return result;

      // Sparse mode recovers rows when the MRZ is higher in the photo or the
      // lower-page crop includes hands/background instead of the document.
      await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }), controller.signal);
      const sparse = await abortable(worker.recognize(canvas, { rotateAuto: true }, { text: true }), controller.signal);
      return mergeDocumentRecognitions(result, recognizeDocumentText(sparse.data.text, sparse.data.confidence));
    } finally {
      signal?.removeEventListener('abort', stop);
      clearTimeout(timeout);
      controller.abort();
      await worker?.terminate();
      if (canvas) canvas.width = canvas.height = 0;
      if (mrz) mrz.width = mrz.height = 0;
    }
  },
};

export class DocumentOcrService {
  constructor(private readonly provider: DocumentOcrProvider = localOcr) {}
  recognize(photo: Blob, signal?: AbortSignal) { return this.provider.recognize(photo, signal); }
}
export const documentOcrService = new DocumentOcrService();
