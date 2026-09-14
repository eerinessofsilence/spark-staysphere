'use client';

import * as React from 'react';
import { Star } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';

const stars = [1, 2, 3, 4, 5];

/**
 * Five clickable stars, filled gold up to the picked count — `text-warning`,
 * the palette's one amber step, rather than a one-off hex the rest of the
 * product's warm/clay/stone tones don't otherwise use. A hidden input keeps
 * `starRating` in `ContentForm`'s plain `FormData` submit.
 */
export function StarRatingField({ id, name, defaultValue }: { id: string; name: string; defaultValue: number }) {
  const [rating, setRating] = React.useState(defaultValue);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const shown = hovered ?? rating;

  return (
    <div
      role="radiogroup"
      aria-label="Star rating"
      className="flex items-center gap-1"
      onPointerLeave={() => setHovered(null)}
    >
      <input type="hidden" id={id} name={name} value={rating} />
      {stars.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
          onPointerEnter={() => setHovered(value)}
          onFocus={() => setHovered(value)}
          onBlur={() => setHovered(null)}
          onClick={() => setRating(value)}
          className="rounded-full p-0.5 transition-transform hover:scale-110 focus-visible:scale-110"
        >
          <Star
            weight={value <= shown ? 'fill' : 'regular'}
            className={cn('size-6', value <= shown ? 'text-warning' : 'text-border')}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {rating} {rating === 1 ? 'star' : 'stars'}
      </span>
    </div>
  );
}
