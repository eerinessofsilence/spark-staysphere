import type { DocumentOcrProvider } from '@/lib/domain/guest-document';
import { recognizeDocumentText } from '@/lib/domain/document-mrz';

/** Browser OCR adapter. Replace this provider without changing booking or guest components. */
const localOcr: DocumentOcrProvider = {
  async recognize(photo, signal) {
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    signal?.throwIfAborted();
    const worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: '/vendor/document-ocr/worker.min.js',
      corePath: '/vendor/document-ocr', langPath: '/vendor/document-ocr',
      cacheMethod: 'none', workerBlobURL: false,
      logger: () => {}, errorHandler: () => {},
    });
    const stop = () => { void worker.terminate(); };
    signal?.addEventListener('abort', stop, { once: true });
    try {
      signal?.throwIfAborted();
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      const { data } = await worker.recognize(photo, {}, { text: true });
      signal?.throwIfAborted();
      return recognizeDocumentText(data.text, data.confidence);
    } finally {
      signal?.removeEventListener('abort', stop);
      await worker.terminate();
    }
  },
};

export class DocumentOcrService {
  constructor(private readonly provider: DocumentOcrProvider = localOcr) {}
  recognize(photo: Blob, signal?: AbortSignal) { return this.provider.recognize(photo, signal); }
}
export const documentOcrService = new DocumentOcrService();
