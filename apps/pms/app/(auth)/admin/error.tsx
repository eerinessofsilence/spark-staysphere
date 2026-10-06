'use client';

import * as React from 'react';
import Link from 'next/link';
import { pill } from '@/lib/ui';

export default function AdminAuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    const requestId = crypto.randomUUID();
    console.error('Admin sign-in page failed', { route: '/admin/sign-in', code: 'auth_service_unavailable', requestId }, error);
  }, [error]);

  return (
    <section className="mx-auto w-full max-w-sm rounded-[18px] bg-card p-6 shadow-soft sm:p-8">
      <h1 className="text-display text-2xl">Admin sign-in is temporarily unavailable</h1>
      <p role="alert" className="mt-3 text-sm text-muted-foreground">
        The sign-in service could not reach the hotel data store. Your account was not signed out. Try again shortly.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={pill('primary')}>Try again</button>
        <Link href="/admin/sign-in" className={pill('secondary')}>Return to sign in</Link>
      </div>
    </section>
  );
}
