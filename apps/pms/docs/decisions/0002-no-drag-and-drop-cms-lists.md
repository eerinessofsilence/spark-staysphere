# 2. CMS reorderable lists use up/down buttons, not drag-and-drop

**Status:** Decided and shipped (`components/admin/content/use-ordered-list.ts`, and the three
editors built on it: `ordered-string-list.tsx`, `media-list-editor.tsx`, `photo-list-editor.tsx`).

## Context

Four places in `/admin/content` let a hotel team reorder a list: a room's amenities, a rate's
included services, a room's photo gallery, an add-on's photos. Something has to let a person move
an item up, down, or off the list.

## Decision

Every reorderable list in the CMS is rows with `iconButton`s for move-up, move-down, and remove,
serialized into one hidden JSON input the server action reads back — no drag-and-drop library.
Stated as a fact in every place this ships (the commit that added the CMS, `35a0814`; TECH.md's
CMS section), not revisited since. All three editors now share one hook,
`useOrderedList<T>` — reorder, remove, and add are identical state operations across a list of
strings, of labelled media items, and of bare photo URLs; only the row's own markup differs.

## Why

- **No new dependency** for a feature used in exactly one part of the product.
- **Keyboard- and screen-reader-operable for free.** A button has a name, a focus state, and
  works with a keyboard out of the box; a drag target needs deliberate extra work to reach the
  same bar (DESIGN_SYSTEM.md's Accessibility section requires keyboard navigation everywhere, no
  exception carved out for the CMS).
- **Consistent with everything else `iconButton` already does** in this product — one shape for
  every icon-only action (DESIGN_SYSTEM.md rule 7), rather than a one-off interaction pattern that
  only this feature uses.

## Consequences

- Reordering a long list is more clicks than a drag would be. Not addressed, since CMS lists in
  this product are short (amenities, a handful of photos) by nature of what they represent.
- The three editors sharing `useOrderedList` means a fix to the shared reorder/remove/add logic
  (e.g. the row-identity bug fixed in `0bba465` — keying rows by a stable id instead of array
  index, so pressing "move up" twice doesn't undo itself) now has to be made once, and benefits
  all three list types the moment it lands, rather than needing to be found and fixed three times.
