'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface ScrollArrowsProps {
  /** id of the rail this pages — a sibling, not a child, so a DOM lookup is
   * simpler here than threading a ref through the page. Its direct children
   * must be `<li>`, one per tile, so a tile's real width can be measured. */
  targetId: string;
  className?: string;
}

/**
 * Two round arrows that page a horizontally-scrolling rail by one tile's
 * width. Each disables itself against the end it can no longer move toward —
 * the same tell any horizontally-scrolling row on a travel site gives.
 *
 * The rail's own gap is read off it rather than assumed, so the same control
 * pages a `gap-3` grid-turned-rail and a `gap-4` strip correctly.
 */
export function ScrollArrows({ targetId, className }: ScrollArrowsProps) {
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  React.useEffect(() => {
    const rail = document.getElementById(targetId);
    if (!rail) return;

    const update = () => {
      // A rail with its own inset (`px-6`, to line tiles up with the page
      // padding) settles its scroll-snap resting position there, not at 0,
      // so "at the start" has to account for it rather than assume 0.
      const style = getComputedStyle(rail);
      const insetStart = parseFloat(style.paddingLeft) || 0;
      const insetEnd = parseFloat(style.paddingRight) || 0;
      setAtStart(rail.scrollLeft <= insetStart + 1);
      setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - insetEnd - 1);
    };

    update();
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      rail.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [targetId]);

  const page = (direction: 1 | -1) => {
    const rail = document.getElementById(targetId);
    if (!rail) return;
    const tile = rail.querySelector<HTMLElement>(':scope > li');
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 16;
    const distance = tile ? tile.getBoundingClientRect().width + gap : rail.clientWidth * 0.8;
    rail.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => page(-1)}
        disabled={atStart}
        aria-label="Scroll to previous rooms"
        className={cn(iconButton('light'), 'disabled:opacity-40')}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => page(1)}
        disabled={atEnd}
        aria-label="Scroll to more rooms"
        className={cn(iconButton('light'), 'disabled:opacity-40')}
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

interface RoomStripControlsProps {
  targetId: string;
  href: string;
  className?: string;
}

/**
 * `ScrollArrows` plus the way out to the full catalog — the pairing "The
 * other rooms" uses, where nothing else in the section already links out.
 *
 * Below `sm`, where the heading and this no longer fit one line, the pair
 * takes the full width it now has to itself and splits — arrows at the
 * left edge, the pill at the right — rather than huddling together at one
 * end with the rest of the row empty. From `sm`, where it usually rides
 * beside the heading, it shrinks back to a compact group at that edge.
 */
export function RoomStripControls({ targetId, href, className }: RoomStripControlsProps) {
  return (
    <div className={cn('flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start', className)}>
      <ScrollArrows targetId={targetId} />
      <Link href={href} className={pill('secondary')}>
        View all rooms
        <ArrowUpRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
