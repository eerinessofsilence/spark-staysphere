'use client';

import * as React from 'react';
import {
  ArrowPathRoundedSquareIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  PuzzlePieceIcon,
  TableCellsIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { ADMIN_INTERESTS, type AdminInterest } from '@/lib/application/admin-interests';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { saveInterestsAction } from '../actions';

/** The same marks the sidebar uses for the same screens, so the choice made here is recognisable there. */
const ICONS: Record<AdminInterest, typeof TableCellsIcon> = {
  'front-desk': TableCellsIcon,
  reservations: CalendarDaysIcon,
  rates: TagIcon,
  content: DocumentTextIcon,
  orbit: ArrowPathRoundedSquareIcon,
  accounting: BanknotesIcon,
  channels: PuzzlePieceIcon,
};

/**
 * Step two: what the team member is here for, as many as apply. Plain
 * checkboxes under the hood — the form posts them as `interests` — dressed
 * as cards so a phone can tap them. "Skip" is its own form on purpose:
 * one that carries nothing but `next`, so skipping never posts whatever
 * happened to be ticked.
 */
export function InterestsForm({ initial, next }: { initial: AdminInterest[]; next: string | null }) {
  const t = useAdminT();
  const [picked, setPicked] = React.useState<Set<AdminInterest>>(() => new Set(initial));

  const toggle = (interest: AdminInterest) => {
    setPicked((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(interest)) nextSet.delete(interest);
      else nextSet.add(interest);
      return nextSet;
    });
  };

  return (
    <>
      <form action={saveInterestsAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div role="group" aria-label={t('welcome.title')} className="grid gap-3 sm:grid-cols-2">
          {ADMIN_INTERESTS.map((interest) => {
            const Icon = ICONS[interest];
            const active = picked.has(interest);
            return (
              <label
                key={interest}
                className={cn(
                  'relative flex cursor-pointer items-start gap-3 rounded-[18px] border-2 bg-card p-4 pr-12 shadow-soft transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
                  active ? 'border-accent bg-accent/10' : 'border-border hover:bg-stone/60',
                )}
              >
                <input
                  type="checkbox"
                  name="interests"
                  value={interest}
                  checked={active}
                  onChange={() => toggle(interest)}
                  className="absolute top-4 right-4"
                />
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center text-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold sm:text-lg">{t(`interest.${interest}.title`)}</span>
                  <span className="mt-1 block text-xs leading-snug text-muted-foreground sm:text-sm">{t(`interest.${interest}.body`)}</span>
                </span>
              </label>
            );
          })}
        </div>

        <button type="submit" disabled={picked.size === 0} className={pill('primary', 'mt-6 w-full')}>
          {t('welcome.continue')}
        </button>
      </form>

      <form action={saveInterestsAction} className="mt-2">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button type="submit" className={pill('ghost', 'w-full')}>
          {t('welcome.skip')}
        </button>
      </form>
    </>
  );
}
