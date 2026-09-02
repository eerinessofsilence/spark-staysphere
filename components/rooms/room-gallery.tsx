'use client';

import * as React from 'react';
import { ArrowsIn, ArrowsOut, CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import type { RoomType } from '@/lib/domain/schemas';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

/** Photographs of the room, one zone at a time. Keyboard: arrows page, tabs switch. */
export function RoomGallery({ room }: { room: RoomType }) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const photos = room.media.filter((item) => item.type === 'image');
  const [index, setIndex] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const photo = photos[index] ?? photos[0];

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!photo) return null;

  const go = (next: number) => setIndex((next + photos.length) % photos.length);

  const toggleFullscreen = async () => {
    const element = stageRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Progressive enhancement only.
    }
  };

  return (
    <figure className="m-0">
      <div
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${room.name} photographs`}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') go(index - 1);
          if (event.key === 'ArrowRight') go(index + 1);
        }}
        className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-stone sm:aspect-[16/10]"
      >
        {photos.map((candidate, candidateIndex) => (
          <img
            key={candidate.url}
            src={candidate.url}
            alt={candidateIndex === index ? `${room.name} — ${candidate.label ?? 'photo'}` : ''}
            width={candidate.width}
            height={candidate.height}
            decoding="async"
            aria-hidden={candidateIndex !== index}
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-500',
              candidateIndex === index ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}

        <button
          type="button"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
          onClick={toggleFullscreen}
          className={iconButton('glass', 'absolute top-4 right-4 z-10')}
        >
          {isFullscreen ? (
            <ArrowsIn weight="fill" className="size-5" aria-hidden="true" />
          ) : (
            <ArrowsOut weight="fill" className="size-5" aria-hidden="true" />
          )}
        </button>

        <div className="absolute inset-x-4 bottom-4 z-10 flex items-end justify-between gap-3">
          <span className="glass rounded-full px-3.5 py-2 text-sm font-medium">{photo.label}</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous photo" onClick={() => go(index - 1)} className={iconButton('glass')}>
              <CaretLeft weight="bold" className="size-4" aria-hidden="true" />
            </button>
            <span className="text-display min-w-[4.5rem] text-center text-lg text-white tabular-nums drop-shadow">
              {String(index + 1).padStart(2, '0')}
              <span className="text-white/60"> / {String(photos.length).padStart(2, '0')}</span>
            </span>
            <button type="button" aria-label="Next photo" onClick={() => go(index + 1)} className={iconButton('glass')}>
              <CaretRight weight="bold" className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        {photos.length} photographs of the {room.name}. Use the buttons below to switch.
      </figcaption>

      <div role="tablist" aria-label="Room photographs" className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {photos.map((candidate, candidateIndex) => (
          <button
            key={candidate.url}
            type="button"
            role="tab"
            aria-selected={candidateIndex === index}
            onClick={() => setIndex(candidateIndex)}
            className={cn(
              pill(candidateIndex === index ? 'primary' : 'secondary', 'h-auto gap-2.5 py-1 pr-4 pl-1'),
            )}
          >
            <span className="size-9 shrink-0 overflow-hidden rounded-full bg-stone">
              <img src={candidate.url} alt="" width={72} height={72} loading="lazy" className="size-full object-cover" />
            </span>
            {candidate.label}
          </button>
        ))}
      </div>
    </figure>
  );
}
