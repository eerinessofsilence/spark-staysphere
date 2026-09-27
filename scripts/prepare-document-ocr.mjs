import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Reproducible local assets from locked npm dependencies. No document is sent to a CDN.
const target = resolve('public/vendor/document-ocr');
await mkdir(target, { recursive: true });
await copyFile(resolve('node_modules/tesseract.js/dist/worker.min.js'), `${target}/worker.min.js`);
await copyFile(resolve('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt'), `${target}/LICENSE.txt`);
for (const file of await readdir(resolve('node_modules/tesseract.js-core'))) {
  if (file.endsWith('.wasm') || file.endsWith('.wasm.js')) await copyFile(resolve('node_modules/tesseract.js-core', file), `${target}/${file}`);
}
await copyFile(resolve('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'), `${target}/eng.traineddata.gz`);
