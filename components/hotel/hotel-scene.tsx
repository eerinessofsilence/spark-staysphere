'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Anchor,
  ArrowRight,
  ArrowsIn,
  ArrowsOut,
  Bell,
  Car,
  CaretLeft,
  CaretRight,
  Drop,
  MapPin,
  Sparkle,
  Sun,
  SwimmingPool,
  Waves,
  Wine,
} from '@phosphor-icons/react/dist/ssr';
import type { HotelArea, Hotspot } from '@/lib/domain/schemas';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * The arrival screen: photography of the property, one area at a time, with
 * hotspots that lead into the catalog. Positions are stored as fractions of the
 * photo and mapped through the same cover-crop the browser applies, so a
 * marker stays on the balcony it points at whatever the viewport.
 */

const hotspotIcons: Record<string, typeof MapPin> = {
  'sea-view': Waves,
  roof: Sun,
  cove: Anchor,
  infinity: SwimmingPool,
  pavilion: Wine,
  hydro: Drop,
  treatment: Sparkle,
  reception: Bell,
  transfer: Car,
};

interface HotelSceneProps {
  areas: HotelArea[];
  location: string;
  /** Query string appended to hotspot links so the stay survives navigation. */
  stayQuery?: string;
  className?: string;
}

export function HotelScene({ areas, location, stayQuery, className }: HotelSceneProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const [activeHotspot, setActiveHotspot] = React.useState<string | null>(null);
  const [dims, setDims] = React.useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const area = areas[index] ?? areas[0];
  if (!area) return null;

  const go = (next: number) => {
    setIndex((next + areas.length) % areas.length);
    setActiveHotspot(null);
  };

  const toggleFullscreen = async () => {
    const element = stageRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Fullscreen is a progressive enhancement; ignore refusals (iOS Safari).
    }
  };

  /** `object-fit: cover` for a marker: same scale and centring as the photo. */
  const positionFor = (hotspot: Hotspot): React.CSSProperties => {
    const { width, height } = area.photo;
    if (!dims.width || !dims.height) {
      return { left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` };
    }
    const scale = Math.max(dims.width / width, dims.height / height);
    return {
      left: (dims.width - width * scale) / 2 + hotspot.x * width * scale,
      top: (dims.height - height * scale) / 2 + hotspot.y * height * scale,
    };
  };

  const hotspotHref = (hotspot: Hotspot): string => {
    const [path, query] = hotspot.href.split('?');
    const params = new URLSearchParams(query ?? '');
    if (stayQuery) new URLSearchParams(stayQuery).forEach((value, key) => params.set(key, value));
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  };

  const active = area.hotspots.find((hotspot) => hotspot.id === activeHotspot) ?? null;

  return (
    <div className={cn('relative', className)}>
      <div
        ref={stageRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Explore the hotel area by area. ${areas.length} areas.`}
        className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-stone sm:aspect-[16/10]"
      >
        {/* All areas are stacked so switching is instant; only one is visible. */}
        {areas.map((candidate, candidateIndex) => (
          <img
            key={candidate.id}
            src={candidate.photo.url}
            alt={candidateIndex === index ? candidate.photo.alt : ''}
            width={candidate.photo.width}
            height={candidate.photo.height}
            decoding="async"
            fetchPriority={candidateIndex === 0 ? 'high' : 'auto'}
            aria-hidden={candidateIndex !== index}
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-500',
              candidateIndex === index ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent"
        />

        {/* Area switcher, desktop */}
        <div
          role="tablist"
          aria-label="Areas of the hotel"
          className="absolute top-4 left-4 z-20 hidden flex-wrap gap-1.5 sm:flex"
        >
          {areas.map((candidate, candidateIndex) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={candidateIndex === index}
              onClick={() => go(candidateIndex)}
              className={cn(
                pill(candidateIndex === index ? 'primary' : 'glass', 'h-10 px-4'),
              )}
            >
              {candidate.name}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
          onClick={toggleFullscreen}
          className={iconButton('glass', 'absolute top-4 right-4 z-20')}
        >
          {isFullscreen ? (
            <ArrowsIn weight="fill" className="size-5" aria-hidden="true" />
          ) : (
            <ArrowsOut weight="fill" className="size-5" aria-hidden="true" />
          )}
        </button>

        {area.hotspots.map((hotspot) => {
          const isActive = hotspot.id === activeHotspot;
          const Icon = hotspotIcons[hotspot.id] ?? MapPin;
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-pressed={isActive}
              aria-label={hotspot.label}
              onClick={() => setActiveHotspot(isActive ? null : hotspot.id)}
              style={positionFor(hotspot)}
              className={cn(
                'absolute z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full p-1 pr-1 text-sm font-medium transition-colors sm:pr-4',
                isActive ? 'bg-ink text-[#F7F5F0]' : 'glass text-foreground hover:bg-white/90',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-9 place-items-center rounded-full',
                  isActive ? 'bg-white/15 text-white' : 'bg-ink text-[#F7F5F0]',
                )}
              >
                <Icon weight="fill" className="size-4" />
              </span>
              <span className="hidden sm:inline">{hotspot.label}</span>
            </button>
          );
        })}

        {/* Bottom rail: caption or the open hotspot on the left, paging on the right. */}
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-end justify-between gap-3">
          <div aria-live="polite" className="pointer-events-auto max-w-[min(24rem,100%)]">
            {active ? (
              <div className="glass rounded-3xl p-4 text-foreground shadow-soft">
                <p className="font-medium">{active.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {active.description}
                </p>
                <Link href={hotspotHref(active)} className={pill('primary', 'mt-3 h-10 px-4')}>
                  {active.cta}
                  <ArrowRight weight="bold" className="size-4" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-white">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs backdrop-blur-sm">
                  <MapPin weight="fill" className="size-3.5" aria-hidden="true" />
                  {location}
                </span>
                <p className="hidden max-w-md text-sm leading-relaxed text-white/85 sm:block">
                  {area.description}
                </p>
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1 text-white">
            <button
              type="button"
              aria-label="Previous area"
              onClick={() => go(index - 1)}
              className={iconButton('glass', 'text-foreground')}
            >
              <CaretLeft weight="bold" className="size-4" aria-hidden="true" />
            </button>
            <span className="text-display min-w-[4.5rem] text-center text-lg tabular-nums">
              {String(index + 1).padStart(2, '0')}
              <span className="text-white/60"> / {String(areas.length).padStart(2, '0')}</span>
            </span>
            <button
              type="button"
              aria-label="Next area"
              onClick={() => go(index + 1)}
              className={iconButton('glass', 'text-foreground')}
            >
              <CaretRight weight="bold" className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Area switcher, mobile */}
      <div
        role="tablist"
        aria-label="Areas of the hotel"
        className="mt-3 flex gap-2 overflow-x-auto pb-1 contain-inline-size sm:hidden"
      >
        {areas.map((candidate, candidateIndex) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={candidateIndex === index}
            onClick={() => go(candidateIndex)}
            className={pill(candidateIndex === index ? 'primary' : 'secondary', 'h-10 px-4')}
          >
            {candidate.name}
          </button>
        ))}
      </div>
    </div>
  );
}
