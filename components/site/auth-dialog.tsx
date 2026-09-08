'use client';

import * as React from 'react';
import { Modal } from '@/components/site/modal';
import { fieldClass, pill } from '@/lib/ui';

/**
 * The one dialog the large travel sites use — a single email field, no
 * password on the first screen. It is opened from the header menu rather than
 * owning its own trigger, so signing in reads as one of the account's rows
 * rather than a second button competing with it.
 *
 * Nothing is submitted anywhere: real auth is still ahead of this prototype
 * (see CLAUDE.md), and the dialog says so rather than implying an account.
 */

export type AuthMode = 'signin' | 'signup';

const copy: Record<
  AuthMode,
  { title: string; heading: string; body: string; switchTo: AuthMode; switchLabel: string }
> = {
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

interface AuthDialogProps {
  mode: AuthMode | null;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
}

export function AuthDialog({ mode, onModeChange, onClose }: AuthDialogProps) {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const close = () => {
    setSubmitted(false);
    setEmail('');
    onClose();
  };

  const active = mode ? copy[mode] : null;

  return (
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
            onClick={() => {
              setSubmitted(false);
              onModeChange(active.switchTo);
            }}
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
  );
}
