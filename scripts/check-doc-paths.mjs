#!/usr/bin/env node
/**
 * Fails if any backticked, path-looking string in a Markdown file doesn't
 * resolve to a real file in this repo. Checked three ways, in order: the
 * literal path from the repo root, the literal path relative to the doc's
 * own directory, and — since a lot of prose here names a file by its bare
 * filename without the directory ("see content-service.ts") — a match
 * against every file in the repo sharing that basename.
 *
 * Run in CI so a doc naming a file that got renamed or deleted is caught
 * before merge. This exists because this project's own top-level docs had
 * drifted from the code in exactly this way before a dedicated review
 * caught it by hand — see docs/README.md's "Keeping this accurate" note.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = process.cwd();
// Everything else, hidden or not (.openai, .github, .oxlintrc.json, …), is
// walked normally — several files docs actually reference live in a hidden
// directory or start with a dot, so "hidden" isn't a reason to skip one.
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.claude',
  'dist',
  '.wrangler',
  '.vinext',
  '.next',
  'coverage',
  'playwright-report',
  'test-results',
]);

// Extensions worth checking — source files, configs, and other docs. Not
// every extension in the repo: images, fonts, and the like are never named
// this way in prose, and including them would just widen the false-positive
// surface for no real benefit.
const EXTENSIONS = ['ts', 'tsx', 'mjs', 'js', 'json', 'md', 'py', 'css'];
const PATH_PATTERN = new RegExp(
  '`([a-zA-Z0-9_./\\[\\]-]+\\.(?:' + EXTENSIONS.join('|') + '))`',
  'g',
);

// Deliberate template placeholders that look like a path but never resolve
// to one on purpose — checked verbatim, not by pattern, so this list stays
// short and every entry is something a human can audit at a glance.
const KNOWN_PLACEHOLDERS = new Set([
  'NNNN-kebab-case-summary.md', // docs/decisions/README.md's naming template
  'DIR/manifest.json', // scripts/README.md's fetch-polyhaven.py usage example
  'components/hotel/resort-canvas.tsx', // SPINNER_SPEC.md: named precisely because it was removed (added and reverted in consecutive commits) — the file not existing is the point being made
]);

function listFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

const allFiles = listFiles(ROOT);
const markdownFiles = allFiles.filter((f) => f.endsWith('.md'));

// basename -> every matching path in the repo, for the bare-filename check.
const byBasename = new Map();
for (const file of allFiles) {
  const base = file.split('/').pop();
  const list = byBasename.get(base) ?? [];
  list.push(file);
  byBasename.set(base, list);
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

let failures = 0;
let checked = 0;

for (const doc of markdownFiles) {
  const text = readFileSync(doc, 'utf8');
  const seen = new Set();
  for (const match of text.matchAll(PATH_PATTERN)) {
    const candidate = match[1];
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (KNOWN_PLACEHOLDERS.has(candidate)) continue;
    checked += 1;

    const asRoot = join(ROOT, candidate);
    const asRelative = join(dirname(doc), candidate);
    const basenameHit = byBasename.has(candidate.split('/').pop());

    if (exists(asRoot) || exists(asRelative) || basenameHit) continue;

    failures += 1;
    console.error(`${relative(ROOT, doc)}: \`${candidate}\` does not match any file in the repo`);
  }
}

console.log(`Checked ${checked} path-looking references across ${markdownFiles.length} Markdown files.`);
if (failures > 0) {
  console.error(`${failures} broken reference${failures === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log('All good.');
