'use client';

import * as React from 'react';
import { builtinRoleKey, demoMembers, type TeamMember } from '@/lib/application/team-directory';
import { useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { cn } from '@/lib/utils';

const ROTATE_MS = 6000;

/**
 * One demo team member per quote, each with their own corner of the
 * property and their own corner of the back office — matched by id, not by
 * list position. Every active member gets a turn (Katerina is `invited`,
 * not yet signed in even in the demo, so she has no quote to give).
 */
const SLIDES: { memberId: string; quote: AdminTranslationKey; photo: string }[] = [
  { memberId: 'marios', quote: 'signIn.quote1', photo: '/images/hotel/lobby.webp' },
  { memberId: 'sofia', quote: 'signIn.quote2', photo: '/images/hotel/facade.webp' },
  { memberId: 'andreas', quote: 'signIn.quote3', photo: '/images/hotel/cove.webp' },
  { memberId: 'elena', quote: 'signIn.quote4', photo: '/images/hotel/pool.webp' },
];

function memberOf(id: string): TeamMember {
  return demoMembers.find((member) => member.id === id) ?? demoMembers[0]!;
}

/**
 * The photo panel beside the sign-in and welcome forms: a true edge-to-edge
 * half of the screen (no card, no rounding — flush against the form column),
 * a different corner of the property behind each quote, fading between
 * them — fictional, like every other name and stay in this demo
 * (CLAUDE.md), praising the product rather than the hotel, since the
 * audience here is the team member signing in, not a guest. Cycles on its
 * own; the dots both show progress and jump to a slide.
 */
export function AuthShowcase() {
  const t = useAdminT();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % SLIDES.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const slide = SLIDES[index]!;
  const member = memberOf(slide.memberId);
  // Every showcase member is one of the fixed seed roles, never a custom one.
  const roleKey = builtinRoleKey(member.role) ?? 'role.owner';

  return (
    <div className="relative hidden overflow-hidden lg:block">
      {SLIDES.map((item, itemIndex) => (
        // eslint-disable-next-line @next/next/no-img-element -- fixed local assets, not next/image candidates here
        <img
          key={item.photo}
          src={item.photo}
          alt=""
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-out',
            itemIndex === index ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

      <div className="absolute top-10 left-10">
        {/* Flattened to a plain white mark: the SVG's own dark-mode colouring
            (lime accent, for the app's own near-black canvas) reads as a
            mistake over an arbitrary photograph rather than the night theme
            it was drawn for. */}
        <img src="/brand/staysphere-logo.svg" alt="StaySphere" className="h-7 w-auto brightness-0 invert" />
      </div>

      <div className="absolute right-10 bottom-10 left-10 max-w-md text-white">
        <p key={slide.quote} className="text-accent-italic text-3xl leading-snug text-balance">
          “{t(slide.quote)}”
        </p>
        <p className="mt-4 text-sm font-medium">
          {member.name} <span className="font-normal text-white/70">· {t(roleKey)}</span>
        </p>

        <div className="mt-6 flex gap-1.5" role="tablist" aria-label={t('signIn.title')}>
          {SLIDES.map((item, itemIndex) => (
            <button
              key={item.memberId}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              aria-label={`${itemIndex + 1}`}
              onClick={() => setIndex(itemIndex)}
              className={cn('h-1 flex-1 rounded-full transition-colors', itemIndex === index ? 'bg-white' : 'bg-white/30 hover:bg-white/50')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
