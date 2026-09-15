'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

const buttonClass = cn(iconButton('dark'), 'pointer-events-auto size-10 bg-transparent hover:bg-white/15');

/** The ink pill under the orbit: turn left, "360°", turn right. A press never starts a drag. */
export function TurnControls({ onTurn }: { onTurn: (direction: 1 | -1) => void }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/85 p-1 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Turn left"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onTurn(-1)}
        className={buttonClass}
      >
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
      </button>
      <span className="px-1 text-sm font-medium text-[#F7F5F0]">360°</span>
      <button
        type="button"
        aria-label="Turn right"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onTurn(1)}
        className={buttonClass}
      >
        <ChevronRightIcon className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
