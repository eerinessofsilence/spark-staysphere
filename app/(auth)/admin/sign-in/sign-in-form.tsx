'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { signInAction, type SignInState } from '../actions';

const initial: SignInState = { error: null };

export function SignInForm({ demo }: { demo: { email: string; password: string } | null }) {
  const t = useAdminT();
  const [state, action, pending] = React.useActionState(signInAction, initial);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  // A shared password has nothing to recover — it's the demo's one password
  // for the whole hotel. "Forgot password?" fills both fields with it
  // instead of ever printing it on the page — the email field itself stays
  // blank with a neutral placeholder rather than a real team member's
  // address, so the sign-in page never shows a name before anyone's signed
  // in. Only shown when there is a demo password to fill in; a real
  // deployment's own password isn't this page's to hand out.
  function fillDemoCredentials() {
    if (!demo) return;
    if (emailRef.current) emailRef.current.value = demo.email;
    if (passwordRef.current) passwordRef.current.value = demo.password;
  }

  return (
    <form action={action} className="grid gap-4">
      <div>
        <label htmlFor="sign-in-email" className="mb-1.5 block text-sm text-muted-foreground">
          {t('account.email')}
        </label>
        <input
          ref={emailRef}
          id="sign-in-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          placeholder={t('signIn.emailPlaceholder')}
          className={fieldClass}
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor="sign-in-password" className="block text-sm text-muted-foreground">
            {t('account.password')}
          </label>
          {demo ? (
            <button type="button" onClick={fillDemoCredentials} className="text-sm font-medium text-accent-strong hover:underline">
              {t('signIn.forgotPassword')}
            </button>
          ) : null}
        </div>
        <input ref={passwordRef} id="sign-in-password" name="password" type="password" required autoComplete="current-password" className={fieldClass} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error === 'tooMany' ? t('signIn.tooMany') : t('signIn.failed')}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={pill('primary', 'mt-2 w-full')}>
        {pending ? t('signIn.signingIn') : t('signIn.continue')}
      </button>
    </form>
  );
}
