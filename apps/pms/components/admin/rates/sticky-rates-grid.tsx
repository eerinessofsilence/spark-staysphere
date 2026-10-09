'use client';

import { useRef, type ReactNode } from 'react';

/**
 * The page scrolls vertically, while the rate cells scroll horizontally.
 * Keeping the date header outside that horizontal scrollport lets it stick
 * to the page; the two scrollports mirror only their horizontal position.
 */
export function StickyRatesGrid({ header, minWidth, children }: {
  header: ReactNode;
  minWidth: string;
  children: ReactNode;
}) {
  const headerViewport = useRef<HTMLDivElement>(null);
  const bodyViewport = useRef<HTMLDivElement>(null);

  const syncScroll = (source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (target && target.scrollLeft !== source.scrollLeft) target.scrollLeft = source.scrollLeft;
  };

  return (
    <div data-rates-grid className="relative min-w-0 rounded-[18px] bg-card shadow-soft contain-inline-size">
      <div data-rates-header className="sticky top-20 z-30 rounded-t-[18px] bg-card lg:top-0">
        <div
          data-rates-header-scroll
          ref={headerViewport}
          onScroll={(event) => syncScroll(event.currentTarget, bodyViewport.current)}
          className="no-scrollbar overflow-x-auto rounded-t-[18px]"
        >
          <div style={{ minWidth }} className="text-sm">{header}</div>
        </div>
      </div>
      <div
        ref={bodyViewport}
        onScroll={(event) => syncScroll(event.currentTarget, headerViewport.current)}
        data-rates-body
        className="relative overflow-x-auto rounded-b-[18px]"
      >
        <div style={{ minWidth }} className="text-sm">{children}</div>
      </div>
    </div>
  );
}
