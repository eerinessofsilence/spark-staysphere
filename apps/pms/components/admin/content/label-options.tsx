/**
 * `<option>` children for a `Select` from a `value → label` map — the room
 * new/edit pages both build the bed-type and view lists this way. A plain
 * function, not a component: `Select` (`./fields`) reads its children back
 * out via `React.Children.toArray`, so this only needs to hand back the same
 * `<option>` elements a call site would have written inline.
 *
 * Deliberately its own module, without `'use client'`: both call sites are
 * Server Components, and every export of a `'use client'` file — a plain
 * function included, not just its components — is treated as a client
 * reference that cannot be invoked synchronously from server code.
 */
export function labelOptions(labels: Record<string, string>): React.ReactElement[] {
  return Object.entries(labels).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}
