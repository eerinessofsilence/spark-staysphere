'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { signOutAction } from '@/app/(auth)/admin/actions';
import type { AdminInterest } from '@/lib/application/admin-interests';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill, tag } from '@/lib/ui';

/** The account page's "Sign out" — the same action the sidebar menu calls, as a plain pill in the header. */
export function SignOutButton() {
  const t = useAdminT();
  const [pending, startTransition] = React.useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => signOutAction())} className={pill('secondary')}>
      <ArrowRightStartOnRectangleIcon className="size-4" aria-hidden="true" />
      {pending ? t('session.signingOut') : t('session.signOut')}
    </button>
  );
}

/**
 * What was picked in the second step of sign-in, and the way back to that
 * step to change it — `/admin/welcome` with `next` pointing home, so it
 * returns here rather than landing on the first interest's screen.
 */
export function InterestsSettings({ interests }: { interests: AdminInterest[] }) {
  const t = useAdminT();
  return (
    <div role="group" aria-labelledby="interests-heading" className="rounded-[18px] bg-card p-6 shadow-soft">
      <h2 id="interests-heading" className="text-lg font-medium">
        {t('interests.title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('interests.body')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {interests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('interests.none')}</p>
        ) : (
          interests.map((interest) => (
            <span key={interest} className={tag()}>
              {t(`interest.${interest}.title`)}
            </span>
          ))
        )}
      </div>
      <Link href="/admin/welcome?next=/admin/account" className={pill('secondary', 'mt-5')}>
        {t('interests.change')}
      </Link>
    </div>
  );
}
