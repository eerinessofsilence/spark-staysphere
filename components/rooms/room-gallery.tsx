'use client';

import * as React from 'react';
import { ArrowsPointingOutIcon, ChevronLeftIcon, ChevronRightIcon, GlobeAltIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useScrollLock } from '@/components/site/use-scroll-lock';
import { PanoramaViewer } from '@/components/view-360';
import type { RoomType } from '@/lib/domain/schemas';
import { useT } from '@/lib/i18n/context';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * The room, one zone at a time. A 360° capture is just another zone: it earns
 * a tab beside the photographs rather than a separate feature of its own.
 * Keyboard: arrows page, tabs switch.
 */
export function RoomGallery({ room }: { room: RoomType }) {
  const t = useT();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const views = room.media.filter((item) => item.type === 'image' || item.type === '360');
  const photos = views.filter((item) => item.type === 'image');
  const panoramaIndex = views.findIndex((item) => item.type === '360');
  const [index, setIndex] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // iOS Safari has no Fullscreen API for anything but a `<video>` element —
  // `requestFullscreen` either doesn't exist or never settles — so the button
  // falls back to a fixed overlay there, the same swap the arrival stage makes.
  const [fakeFullscreen, setFakeFullscreen] = React.useState(false);
  const fullscreen = isFullscreen || fakeFullscreen;
  const photo = views[index] ?? views[0];

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // The overlay's own escape hatch: Escape closes it, and the page behind it
  // must not scroll under it — the native API gets both for free.
  useScrollLock(fakeFullscreen);
  React.useEffect(() => {
    if (!fakeFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFakeFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fakeFullscreen]);

  if (!photo) return null;

  const photoPosition = photo.type === 'image' ? photos.indexOf(photo) : -1;

  /** Paging is about the photographs; the sphere is a mode, not a page. */
  const goPhoto = (delta: number) => {
    const from = photoPosition >= 0 ? photoPosition : 0;
    const next = photos[(from + delta + photos.length) % photos.length];
    if (next) setIndex(views.indexOf(next));
  };

  const toggleFullscreen = async () => {
    const element = stageRef.current;
    if (!element) return;
    if (fakeFullscreen) {
      setFakeFullscreen(false);
      return;
    }
    if (typeof element.requestFullscreen !== 'function' || document.fullscreenEnabled === false) {
      setFakeFullscreen(true);
      return;
    }
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Still refused (an embedded webview, a permission prompt) — the
      // overlay is the fallback of last resort.
      setFakeFullscreen(true);
    }
  };

  return (
    <figure className="m-0">
      <div
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={t('room.photographs', { name: room.name })}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') goPhoto(-1);
          if (event.key === 'ArrowRight') goPhoto(1);
        }}
        // Full screen shows the whole photograph on ink, the way a lightbox
        // does, rather than the cover crop the inline frame uses: on a phone
        // held upright that crop would keep only the middle of a landscape
        // shot, and "full size" means seeing all of it.
        className={cn(
          'relative aspect-[4/3] overflow-hidden rounded-[18px] sm:aspect-[16/10]',
          fullscreen ? 'bg-ink' : 'bg-stone',
          fakeFullscreen && 'fixed inset-0 z-50 aspect-auto rounded-none sm:aspect-auto',
        )}
      >
        {photos.map((candidate) => (
          <img
            key={candidate.url}
            src={candidate.url}
            alt={candidate.url === photo.url ? `${room.name} — ${candidate.label ?? t('room.photo')}` : ''}
            width={candidate.width}
            height={candidate.height}
            decoding="async"
            aria-hidden={candidate.url !== photo.url}
            className={cn(
              'absolute inset-0 size-full transition-opacity duration-500',
              fullscreen ? 'object-contain' : 'object-cover',
              candidate.url === photo.url ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}

        {/* Mounted only while its tab is open: a sphere holds a WebGL context
            and pulls its own image, neither worth spending on a hidden tab. */}
        {photo.type === '360' ? (
          <PanoramaViewer
            src={photo.url}
            title={`${room.name}, 360°`}
            className="absolute inset-0 size-full"
          />
        ) : null}

        {/* The 360 is a tab like any other, but a tab under the frame is easy
            to miss and disappears in fullscreen — so it gets a way in from the
            picture itself, the way the large travel sites surface a tour. */}
        {panoramaIndex >= 0 ? (
          <button
            type="button"
            onClick={() => setIndex(photo.type === '360' ? 0 : panoramaIndex)}
            className={pill('glass', 'absolute top-4 left-4 z-10 h-10 px-4 shadow-soft')}
          >
            {photo.type === '360' ? (
              <>
                <PhotoIcon className="size-4" aria-hidden="true" />
                {t('room.photos')}
              </>
            ) : (
              <>
                <GlobeAltIcon className="size-4" aria-hidden="true" />
                {t('room.threeSixtyView')}
              </>
            )}
          </button>
        ) : null}

        <button
          type="button"
          aria-label={fullscreen ? t('room.exitFullscreen') : t('room.viewFullscreen')}
          onClick={toggleFullscreen}
          className={iconButton('glass', 'absolute top-4 right-4 z-10')}
        >
          {fullscreen ? (
            <XMarkIcon className="size-5" aria-hidden="true" />
          ) : (
            <ArrowsPointingOutIcon className="size-5" aria-hidden="true" />
          )}
        </button>

        {/* Hidden over the sphere: paging means nothing there, and controls
            sitting on top of it would swallow the drag. */}
        {photo.type === 'image' ? (
          <div className="absolute inset-x-4 bottom-4 z-10 flex items-end justify-between gap-3">
            <span className="glass rounded-full px-3.5 py-2 text-sm font-medium">{photo.label}</span>
            {/* No counter: the tabs under the photograph already name every
                view and mark the one showing. */}
            <div className="flex items-center gap-1">
              <button type="button" aria-label={t('room.previousPhoto')} onClick={() => goPhoto(-1)} className={iconButton('glass')}>
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label={t('room.nextPhoto')} onClick={() => goPhoto(1)} className={iconButton('glass')}>
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <figcaption className="sr-only">
        {t('room.viewsOfRoom', { count: String(views.length), name: room.name })}
      </figcaption>

      <div role="tablist" aria-label={t('room.roomViews')} className="mt-3 flex gap-2 overflow-x-auto pb-1 contain-inline-size">
        {views.map((candidate, candidateIndex) => (
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
            <span
              className={cn(
                'size-9 shrink-0 overflow-hidden rounded-full bg-stone',
                candidate.type === '360' && 'grid place-items-center text-foreground',
              )}
            >
              {candidate.type === '360' ? (
                <GlobeAltIcon className="size-4" aria-hidden="true" />
              ) : (
                <img src={candidate.url} alt="" width={72} height={72} loading="lazy" className="size-full object-cover" />
              )}
            </span>
            {candidate.label}
          </button>
        ))}
      </div>

      {photo.type === '360' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('room.dragToLookAroundPre')}
          <a
            href="https://polyhaven.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Poly Haven
          </a>
          {t('room.dragToLookAroundPost')}
        </p>
      ) : null}
    </figure>
  );
}
