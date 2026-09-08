'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ParallaxImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /**
   * How far the photo travels relative to the page, in pixels either side of
   * centre. Small and slow reads as depth; anything larger starts to look
   * like the image is unstuck from its frame.
   */
  strength?: number;
}

/**
 * A background photo that drifts slower than the page scrolling past it —
 * the one place on the site that isn't flat. The image is sized bigger than
 * its frame so the drift never uncovers an edge, and the whole effect is a
 * single `translate3d` written straight to the DOM on scroll rather than
 * through React state, so it costs nothing more than a layout read per frame.
 *
 * `prefers-reduced-motion` gets the plain, still photo: parallax is a flourish,
 * not something anyone is relying on to use the page.
 */
export function ParallaxImage({ src, alt, width, height, className, strength = 40 }: ParallaxImageProps) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const apply = () => {
      const rect = frame.getBoundingClientRect();
      const viewportMid = window.innerHeight / 2;
      const frameMid = rect.top + rect.height / 2;
      // -1 (frame centre above the viewport) .. 1 (below it), 0 at dead centre.
      const progress = (frameMid - viewportMid) / (window.innerHeight / 2 + rect.height / 2);
      const offset = Math.max(-1, Math.min(1, progress)) * strength;
      img.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    };

    // A plain transform write is cheap enough to do on every scroll tick —
    // scheduling it through requestAnimationFrame instead would leave the
    // photo frozen on a background or otherwise-throttled tab, since a
    // pending rAF callback never runs there.
    const onScroll = () => apply();

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [strength]);

  return (
    <div ref={frameRef} className="absolute inset-0 overflow-hidden">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={cn('absolute inset-x-0 -top-[12%] h-[124%] w-full object-cover', className)}
      />
    </div>
  );
}
