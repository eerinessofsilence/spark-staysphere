'use client';

import * as React from 'react';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { signOutAction } from '@/app/(auth)/admin/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';

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
