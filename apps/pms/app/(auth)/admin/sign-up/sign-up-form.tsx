'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import Link from 'next/link';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { signUpAction, type SignUpState } from '../actions';

const initial: SignUpState = { error: null };

export function SignUpForm() {
  const t = useAdminT();
  const [state, action, pending] = React.useActionState(signUpAction, initial);
  return <form action={action} className="grid gap-4">
    <label className="grid gap-1.5 text-sm text-muted-foreground">{t('signup.name')}
      <input name="name" required autoComplete="name" maxLength={120} className={fieldClass} />
    </label>
    <label className="grid gap-1.5 text-sm text-muted-foreground">{t('account.email')}
      <input name="email" type="email" required autoComplete="email" maxLength={254} className={fieldClass} />
    </label>
    <label className="grid gap-1.5 text-sm text-muted-foreground">{t('account.password')}
      <input name="password" type="password" required autoComplete="new-password" minLength={12} maxLength={128} className={fieldClass} />
      <span className="text-xs">{t('signup.passwordHint')}</span>
    </label>
    {state.error ? <p role="alert" className="text-sm text-danger">{t(`signup.${state.error}`)}</p> : null}
    <button type="submit" disabled={pending} className={pill('primary', 'mt-2 w-full')}>{pending ? t('signIn.signingIn') : t('signup.create')}</button>
    <Link href="/admin/sign-in" className="min-h-11 text-center text-sm font-medium text-accent-strong underline underline-offset-4">{t('signIn.title')}</Link>
    <Preloader active={pending} label={t('page.loading')} />
  </form>;
}
