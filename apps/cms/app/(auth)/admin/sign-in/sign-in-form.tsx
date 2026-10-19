'use client';
import { useActionState } from 'react';
import { signInAction } from '../actions';
import { pill, fieldClass } from '@/lib/ui';

export function SignInForm() {
  const [error, action, pending] = useActionState(signInAction, '');
  return <form action={action} className="grid gap-4">
    <label htmlFor="password" className="text-sm">Password</label>
    <input id="password" name="password" type="password" autoComplete="current-password" required className={fieldClass} />
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <button type="submit" disabled={pending} className={pill('primary')}>{pending ? 'Signing in…' : 'Sign in'}</button>
  </form>;
}
