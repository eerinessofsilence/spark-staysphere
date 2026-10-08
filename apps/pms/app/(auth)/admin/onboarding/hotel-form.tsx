'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { createHotelAction, type CreateHotelState } from '../actions';

const initial: CreateHotelState = { error: null };

export function HotelForm({ submissionKey }: { submissionKey: string }) {
  const t = useAdminT();
  const [state, action, pending] = React.useActionState(createHotelAction, initial);
  return <form action={action} className="grid gap-4">
    <input type="hidden" name="submissionKey" value={submissionKey} />
    <label className="grid gap-1.5 text-sm text-muted-foreground">{t('onboarding.hotelName')}
      <input name="name" required autoComplete="organization" minLength={2} maxLength={120} className={fieldClass} />
    </label>
    <label className="grid gap-1.5 text-sm text-muted-foreground">{t('onboarding.location')}
      <input name="location" autoComplete="address-level2" maxLength={160} className={fieldClass} />
    </label>
    <label className="grid gap-1.5 text-sm text-muted-foreground">{t('onboarding.currency')}
      <select name="currency" defaultValue="EUR" className={fieldClass}><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option></select>
    </label>
    <label className="grid gap-1.5 text-sm text-muted-foreground">{t('onboarding.timezone')}
      <input name="timezone" required defaultValue="Europe/Nicosia" maxLength={80} className={fieldClass} />
    </label>
    {state.error ? <p role="alert" className="text-sm text-danger">{t(state.error === 'invalid' ? 'onboarding.invalidHotel' : 'onboarding.unavailable')}</p> : null}
    <p className="text-sm leading-relaxed text-muted-foreground">{t('onboarding.trialInfo')}</p>
    <button type="submit" disabled={pending} className={pill('primary', 'mt-2 w-full')}>{pending ? t('signIn.signingIn') : t('onboarding.startTrial')}</button>
    <Preloader active={pending} label={t('page.loading')} />
  </form>;
}
