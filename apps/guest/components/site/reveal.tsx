'use client';

import * as React from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger a block that arrives with its neighbours, in milliseconds. */
  delay?: number;
}

/**
 * Fades a block in and lifts it the last centimetre as it scrolls into view.
 *
 * The hidden state lives in CSS (`[data-reveal='pending']` in globals.css),
 * gated on the document being scripted, so this component only ever has to
 * flip one attribute — and the copy is never invisible on a page where that
 * flip could not happen.
 *
 * It fires once. A heading that re-hides itself on the way back up turns a
 * page into a slideshow, and re-reading something you have already read
 * should not cost you a second animation.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.dataset.reveal = 'shown';
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          element.dataset.reveal = 'shown';
          observer.disconnect();
        }
      },
      // A little inside the fold rather than exactly at it: arriving at the
      // very edge of the screen, the movement happens where it cannot be seen.
      { rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal="pending"
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
