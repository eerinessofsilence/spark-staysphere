'use client';

import * as React from 'react';

/**
 * The reorder/remove/add state shared by every CMS list editor —
 * `OrderedStringList` (amenities, a rate's included services),
 * `MediaListEditor` (a room's gallery), `PhotoListEditor` (an add-on's
 * photos). No drag-and-drop library, per the CMS brief: rows move with
 * up/down buttons instead.
 *
 * Rows carry an id of their own, stable across a reorder, because the list
 * this hook backs is keyed by it. Keyed by index instead, a swap leaves the
 * DOM node — and the browser's focus on whichever button was just pressed —
 * sitting at the same position while the item under it changes: pressing
 * "Move up" twice in a row moves the row that swapped in, undoing the first
 * move rather than repeating it.
 *
 * A save hands the saved list back down as `initial`; the effect below takes
 * it (dropping whatever local edit hadn't been saved), so the next save
 * starts from what is actually stored.
 */
export function useOrderedList<T>(initial: T[]) {
  const initialJson = JSON.stringify(initial);
  const nextId = React.useRef(0);
  const toRows = React.useCallback(
    (values: T[]) => values.map((value) => ({ id: nextId.current++, value })),
    [],
  );
  const [rows, setRows] = React.useState(() => toRows(initial));

  React.useEffect(() => {
    setRows(toRows(JSON.parse(initialJson) as T[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJson]);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setRows(next);
  }

  function remove(index: number) {
    setRows(rows.filter((_, candidate) => candidate !== index));
  }

  function add(value: T) {
    setRows([...rows, { id: nextId.current++, value }]);
  }

  function update(index: number, value: T) {
    const next = [...rows];
    next[index] = { ...next[index]!, value };
    setRows(next);
  }

  const values = React.useMemo(() => rows.map((row) => row.value), [rows]);

  return { rows, values, move, remove, add, update } as const;
}
