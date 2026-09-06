'use client';

import * as React from 'react';

/** A point on the stage a card should hang off, in the stage's local pixels. */
export interface CardAnchor {
  /** Horizontal centre of the thing being annotated. */
  x: number;
  /** Its top edge — the card rests just above this when there's room. */
  top: number;
  /** Its bottom edge — the card rests just below this otherwise. */
  bottom: number;
}

interface StageSize {
  width: number;
  height: number;
}

const MARGIN = 16;
const GAP = 16;
/**
 * Room kept clear at the bottom of a stage for the caption and paging rail:
 * the rail's own 16px offset, its 44px buttons, and a gap above them.
 */
const RAIL = 72;

/**
 * Positions a floating card next to whatever it explains — a marker, a
 * building — instead of it always landing in the same corner. The card is
 * measured with a `ResizeObserver` (its height varies with its copy), so the
 * flip between "above" and "below" the anchor clears it exactly, and the
 * result is clamped so the card never runs off the stage.
 */
export function useAnchoredCard<T extends HTMLElement = HTMLDivElement>(
  anchor: CardAnchor | null,
  stage: StageSize,
) {
  // Generic over the element: the marker's card is a div, the floor band's is
  // a link. The hook only ever reads `offsetWidth`/`offsetHeight`.
  const cardRef = React.useRef<T>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    // Not `entry.contentRect`: that excludes the card's own padding, and
    // `top`/`left` position its border box — the padding this card is given
    // is exactly the gap that used to go missing, landing the card that much
    // closer to the anchor than intended.
    const observer = new ResizeObserver(() => {
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
    // Re-observe whenever the card mounts fresh for a new anchor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor === null]);

  const style = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!anchor || stage.width <= 0 || stage.height <= 0) return undefined;
    // Before the first measurement, guess a size close to the card's real one
    // so it does not visibly jump once the observer reports back.
    const width = size.width || Math.min(360, stage.width - MARGIN * 2);
    const height = size.height || 150;

    const left = Math.min(Math.max(anchor.x - width / 2, MARGIN), Math.max(MARGIN, stage.width - width - MARGIN));

    // Above and below are not a coin flip on which half of the stage the
    // anchor sits in — that flips the card toward whichever side has less
    // room the moment the card is tall, and a clamp that only keeps it on
    // the stage does nothing to stop it then landing on top of the anchor.
    // Pick the side with room for it; if neither has enough, pick whichever
    // has more, so any remaining clamp has the least ground left to cover.
    const spaceAbove = anchor.top - GAP - MARGIN;
    const spaceBelow = stage.height - anchor.bottom - GAP - MARGIN;

    // On a phone the stage is barely taller than the card, so "beside the
    // marker" would mean "over the marker and most of the photograph". When
    // neither side can hold it, stop pretending: sit on the bottom edge, clear
    // of the rail, and leave the picture and its markers visible above.
    if (spaceAbove < height && spaceBelow < height) {
      return { left: MARGIN, right: MARGIN, bottom: RAIL };
    }

    const placeAbove = spaceAbove >= height || spaceAbove >= spaceBelow;
    const top = placeAbove
      ? Math.max(MARGIN, anchor.top - GAP - height)
      : Math.min(Math.max(MARGIN, stage.height - height - MARGIN), anchor.bottom + GAP);

    return { left, top };
  }, [anchor, stage.width, stage.height, size.width, size.height]);

  return { cardRef, style };
}
