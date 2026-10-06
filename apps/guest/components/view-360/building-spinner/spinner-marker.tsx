'use client';

import type * as React from 'react';
import { MapPin } from '@phosphor-icons/react/dist/ssr';
import type { SpinnerHotspot } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';

interface SpinnerMarkerProps {
  hotspot: SpinnerHotspot;
  /** The room's floor and price as one short line, when the hotspot sells a room. */
  line: string | null;
  isActive: boolean;
  isHovered: boolean;
  style: React.CSSProperties;
  buttonRef: (element: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onHoverChange: (hovering: boolean) => void;
}

/**
 * A storey's marker: a lens on the photograph, with the label beside it as its
 * own small frosted chip from `sm` up. Not one pill around both: on a phone,
 * where only the disc shows, a pill wrapping a disc was a grey ring around an
 * ink dot. Pressed, the lens fills with ink so the chosen storey is
 * unmistakable against the rest.
 */
export function SpinnerMarker({ hotspot, line, isActive, isHovered, style, buttonRef, onSelect, onHoverChange }: SpinnerMarkerProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={isActive}
      aria-label={[hotspot.label, line].filter(Boolean).join(', ')}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={style}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-2 text-xs font-medium"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-11 place-items-center rounded-full transition-[transform,background-color] duration-200 sm:size-10',
          isActive ? 'bg-ink text-[#F7F5F0] shadow-soft' : 'glass-lens text-[#161616]',
          !isActive && isHovered && 'scale-110',
        )}
      >
        <MapPin weight="fill" className="size-5" />
      </span>
      <span
        className={cn('hidden rounded-full px-3 py-1.5 sm:inline', isActive ? 'bg-ink text-[#F7F5F0]' : 'glass text-foreground')}
      >
        {hotspot.label}
        {line ? <span className={cn('font-normal', isActive ? 'text-white/70' : 'text-muted-foreground')}> · {line}</span> : null}
      </span>
    </button>
  );
}
