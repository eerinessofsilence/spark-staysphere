'use client';

import * as React from 'react';
import { Modal } from '@/components/site/modal';
import { fieldClass, pill } from '@/lib/ui';

/**
 * Sign in / sign up, in the header where the booking CTA used to sit. Both
 * buttons open the one dialog the large travel sites use — a single email
 * field, no password on the first screen.
 *
 * Nothing is submitted anywhere: real auth is still ahead of this prototype
 * (see CLAUDE.md), and the dialog says so rather than implying an account.
 */

type Mode = 'signin' | 'signup';

const copy: Record<Mode, { title: string; heading: string; body: string; switchTo: Mode; switchLabel: string }> = {
  signin: {
    title: 'Log in',
    heading: 'Welcome back',
    body: 'Enter the email address you booked with.',
    switchTo: 'signup',
    switchLabel: 'New here? Create an account',
  },
  signup: {
    title: 'Sign up',
    heading: 'Create your account',
    body: 'Start with your email address.',
    switchTo: 'signin',
    switchLabel: 'Already have an account? Log in',
  },
};

export function AuthActions() {
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const open = (next: Mode) => {
    setMode(next);
    setSubmitted(false);
  };

  const close = () => {
    setMode(null);
    setSubmitted(false);
    setEmail('');
  };

  const active = mode ? copy[mode] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => open('signin')}
        className={pill('ghost', 'hidden h-10 px-4 sm:inline-flex')}
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => open('signup')}
        className={pill('primary', 'hidden h-10 px-4 sm:inline-flex sm:h-11 sm:px-5')}
      >
        Sign up
      </button>

      {/* One button is all a phone header has room for; the dialog holds both. */}
      <button
        type="button"
        onClick={() => open('signin')}
        className={pill('primary', 'h-10 px-4 sm:hidden')}
      >
        Log in
      </button>

      <Modal open={mode !== null} onClose={close} title={active?.title ?? 'Log in'}>
        {active ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <h2 className="text-display text-2xl">{active.heading}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{active.body}</p>

            <label htmlFor="auth-email" className="mt-5 mb-1.5 block text-sm text-muted-foreground">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={fieldClass}
            />

            <button type="submit" className={pill('primary', 'mt-4 w-full')}>
              Continue
            </button>

            {submitted ? (
              <p role="status" className="mt-3 text-sm font-medium">
                Thanks — this prototype stops here. No account was created and nothing was sent.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => open(active.switchTo)}
              className="mt-4 cursor-pointer text-sm font-medium text-accent-strong underline underline-offset-4"
            >
              {active.switchLabel}
            </button>

            <p className="mt-5 rounded-2xl bg-stone/60 p-3 text-xs leading-relaxed text-muted-foreground">
              Demo sign-in. Accounts are not created, no password is asked for, and the address you
              type is never sent anywhere.
            </p>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
