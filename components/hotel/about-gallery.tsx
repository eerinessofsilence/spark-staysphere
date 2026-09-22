"use client";

import * as React from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { Hotel } from "@/lib/domain/schemas";
import { useT } from "@/lib/i18n/context";
import { iconButton } from "@/lib/ui";

export function AboutGallery({
  photos,
  alt,
}: {
  photos: NonNullable<Hotel["aboutPhotos"]>;
  alt: string;
}) {
  const t = useT();
  const [index, setIndex] = React.useState(0);
  const selected = Math.min(index, photos.length - 1);
  const photo = photos[selected];
  if (!photo) return null;
  const go = (direction: number) =>
    setIndex((current) => (current + direction + photos.length) % photos.length);
  return (
    <div
      className="relative size-full"
      role="group"
      aria-label={alt}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          go(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <img
        src={photo.url}
        alt={alt}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
      {photos.length > 1 ? (
        <>
          <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("room.previousPhoto")}
              className={iconButton("glass")}
            >
              <CaretLeft weight="fill" className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("room.nextPhoto")}
              className={iconButton("glass")}
            >
              <CaretRight weight="fill" className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="absolute inset-x-4 bottom-4 flex gap-2 overflow-x-auto rounded-[18px] bg-card/90 p-2">
            {photos.map((item, i) => (
              <button
                key={`${item.url}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === selected}
                aria-label={`${alt} ${i + 1}`}
                className="size-12 shrink-0 overflow-hidden rounded-lg border-2 border-transparent focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent"
              >
                <img
                  src={item.url}
                  alt=""
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
