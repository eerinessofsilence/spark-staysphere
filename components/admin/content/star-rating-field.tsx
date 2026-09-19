'use client';

import * as React from 'react';
import { Star } from '@phosphor-icons/react/dist/ssr';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralForm } from '@/lib/i18n/plural';
import { cn } from '@/lib/utils';

const stars = [1, 2, 3, 4, 5];

/**
 * Five clickable stars, filled gold up to the picked count — `text-star`, a
 * token of its own rather than `text-warning`: that one is tuned dark for
 * text contrast and reads as brown at icon size, not the gold a star rating
 * needs. A hidden input keeps `starRating` in `ContentForm`'s plain
 * `FormData` submit.
 */
export function StarRatingField({ id, name, defaultValue }: { id: string; name: string; defaultValue: number }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [rating, setRating] = React.useState(defaultValue);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const shown = hovered ?? rating;
  const starCount = (count: number) =>
    pluralForm(locale, count, {
      one: t('hotel.starsOne', { count }),
      few: t('hotel.starsFew', { count }),
      many: t('hotel.starsMany', { count }),
      other: t('hotel.starsMany', { count }),
    });

  return (
    <div
      role="radiogroup"
      aria-label={t('hotel.starRating')}
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
          aria-label={starCount(value)}
          onPointerEnter={() => setHovered(value)}
          onFocus={() => setHovered(value)}
          onBlur={() => setHovered(null)}
          onClick={() => setRating(value)}
          className="rounded-full p-0.5 transition-transform hover:scale-110 focus-visible:scale-110"
        >
          <Star
            weight={value <= shown ? 'fill' : 'regular'}
            className={cn('size-6', value <= shown ? 'text-star' : 'text-border')}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{starCount(rating)}</span>
    </div>
  );
}
