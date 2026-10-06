#!/usr/bin/env node
/**
 * Walks `public/images/**`, reads each WebP's width/height straight out of
 * its header bytes (no image library — see the note in TECH.md on why the
 * CMS ships no upload path), and writes the result to
 * `lib/infrastructure/media-manifest.generated.json`, committed so the media
 * picker in `/admin/content` never touches the filesystem at request time.
 *
 * `public/images/hotel/spin/**` is excluded on purpose: the spinner's 160
 * orbit frames are not a pickable photograph, they are the turnable model's
 * own asset set, and the CMS brief explicitly keeps them out of the picker.
 *
 * Run with `npm run generate:media-manifest` after adding or removing a file
 * under public/images.
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const imagesDir = path.join(root, 'public', 'images');
const outFile = path.join(root, 'lib', 'infrastructure', 'media-manifest.generated.json');

const EXCLUDED_DIRS = new Set([path.join(imagesDir, 'hotel', 'spin')]);

/**
 * Parses a WebP's pixel dimensions from its RIFF header. Handles the three
 * chunk shapes libwebp actually produces — lossy `VP8 `, lossless `VP8L`,
 * and extended `VP8X` (used when a still carries metadata/alpha) — since
 * this repo's WebPs come from more than one export path.
 */
function parseWebpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const fourCC = buffer.toString('ascii', 12, 16);
  const payload = buffer.subarray(20);

  if (fourCC === 'VP8X') {
    const width = (payload[4] | (payload[5] << 8) | (payload[6] << 16)) + 1;
    const height = (payload[7] | (payload[8] << 8) | (payload[9] << 16)) + 1;
    return { width, height };
  }

  if (fourCC === 'VP8 ') {
    // 3-byte frame tag, then the 3-byte start code (0x9d 0x01 0x2a).
    if (payload[3] !== 0x9d || payload[4] !== 0x01 || payload[5] !== 0x2a) return null;
    const width = (payload[6] | (payload[7] << 8)) & 0x3fff;
    const height = (payload[8] | (payload[9] << 8)) & 0x3fff;
    return { width, height };
  }

  if (fourCC === 'VP8L') {
    if (payload[0] !== 0x2f) return null;
    const bits = payload[1] | (payload[2] << 8) | (payload[3] << 16) | (payload[4] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  return null;
}

async function walk(dir) {
  if (EXCLUDED_DIRS.has(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = (await walk(imagesDir)).sort();
  const manifest = [];

  for (const file of files) {
    const buffer = await readFile(file);
    const dimensions = parseWebpDimensions(buffer);
    if (!dimensions) {
      console.error(`Could not read WebP dimensions for ${path.relative(root, file)}, skipping.`);
      continue;
    }
    const relativeToImages = path.relative(imagesDir, file).split(path.sep).join('/');
    const folder = path.dirname(relativeToImages) === '.' ? '' : path.dirname(relativeToImages);
    const { size } = await stat(file);
    manifest.push({
      url: `/images/${relativeToImages}`,
      folder,
      filename: path.basename(file),
      width: dimensions.width,
      height: dimensions.height,
      bytes: size,
    });
  }

  await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.length} entries to ${path.relative(root, outFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
