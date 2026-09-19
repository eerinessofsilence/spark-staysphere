'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { signInAction, type SignInState } from '../actions';

const initial: SignInState = { error: null };

export function SignInForm({ demo }: { demo: { email: string; password: string } | null }) {
  const t = useAdminT();
  const [state, action, pending] = React.useActionState(signInAction, initial);

  return (
    <form action={action} className="grid gap-4">
      <div>
        <label htmlFor="sign-in-email" className="mb-1.5 block text-sm text-muted-foreground">
          {t('account.email')}
        </label>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          defaultValue={demo?.email ?? ''}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="sign-in-password" className="mb-1.5 block text-sm text-muted-foreground">
          {t('account.password')}
        </label>
        <input id="sign-in-password" name="password" type="password" required autoComplete="current-password" className={fieldClass} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error === 'tooMany' ? t('signIn.tooMany') : t('signIn.failed')}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={pill('primary', 'mt-2 w-full')}>
        {pending ? t('signIn.signingIn') : t('signIn.continue')}
      </button>

      {demo ? (
        <p className="rounded-2xl bg-stone/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {t('signIn.demoHint', { password: demo.password, email: demo.email })}
        </p>
      ) : null}
    </form>
  );
}
