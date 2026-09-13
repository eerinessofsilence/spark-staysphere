import type { CatalogEntryRecord } from './ports';

/**
 * Merges seed data with CMS overlay rows of the same kind: an overlay row
 * whose id matches a seed entity replaces it wholesale, and an overlay row
 * with an id the seed never had is a new entity, appended after the seed
 * ones. Pure and backend-agnostic, so a D1-backed overlay and an in-memory
 * one merge identically — see `lib/infrastructure/durable-hotel-repository.ts`.
 */
export function mergeCatalog<T extends { id: string }>(
  seed: T[],
  overlay: CatalogEntryRecord<T>[],
): T[] {
  const overlayById = new Map(overlay.map((entry) => [entry.id, entry.data]));
  const merged = seed.map((item) => overlayById.get(item.id) ?? item);

  const seedIds = new Set(seed.map((item) => item.id));
  const created = overlay
    .filter((entry) => !seedIds.has(entry.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => entry.data);

  return [...merged, ...created];
}

/**
 * The version a caller must submit as `expectedVersion` to edit this entity.
 * `0` for a seed entity that has never been overlaid, so a first edit is
 * still subject to optimistic concurrency against a concurrent first edit.
 */
export function effectiveVersion(overlay: CatalogEntryRecord[], id: string): number {
  return overlay.find((entry) => entry.id === id)?.version ?? 0;
}
