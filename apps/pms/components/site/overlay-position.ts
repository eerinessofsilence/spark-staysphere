/** Keep an anchored popover inside the visible viewport, preferring below its trigger. */
export function anchoredPanelTop(
  anchor: Pick<DOMRect, 'top' | 'bottom'>,
  panelHeight: number,
  viewportHeight: number,
  gap = 10,
  margin = 12,
): number {
  const below = anchor.bottom + gap;
  if (below + panelHeight <= viewportHeight - margin) return below;

  const above = anchor.top - panelHeight - gap;
  if (above >= margin) return above;

  return Math.max(margin, viewportHeight - panelHeight - margin);
}
