'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { Modal } from '@/components/site/modal';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface IntegrationConnectProps {
  /** Already in the team member's language — the page translates the adapter's name and steps. */
  name: string;
  connected: boolean;
  steps: string[];
}

export function IntegrationConnect({ name, connected, steps }: IntegrationConnectProps) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const id = React.useId();

  const fields = [
    { id: 'endpoint', label: t('integrations.apiEndpoint'), placeholder: 'https://', type: 'url' },
    { id: 'client-id', label: t('integrations.clientId'), placeholder: t('integrations.clientIdPlaceholder'), type: 'text' },
    { id: 'secret', label: t('integrations.secret'), placeholder: '••••••••', type: 'password' },
  ];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        {connected ? t('integrations.manage') : t('integrations.connect')}
        <span className="sr-only"> {name}</span>
      </button>
      <Modal
        open={open}
        onClose={close}
        title={connected ? t('integrations.manageName', { name }) : t('integrations.connectName', { name })}
      >
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-medium">{t('integrations.whatConnecting')}</p>
            <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
              {steps.map((step) => (
                <li key={step} className="flex gap-2">
                  <span aria-hidden="true">·</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          <div role="group" aria-labelledby={`${id}-credentials`} className="grid gap-3">
            <h3 id={`${id}-credentials`} className="text-sm font-medium">
              {t('integrations.credentials')}
            </h3>
            {fields.map((field) => (
              <div key={field.id}>
                <label htmlFor={`${id}-${field.id}`} className="mb-1.5 block text-sm text-muted-foreground">
                  {field.label}
                </label>
                <input
                  id={`${id}-${field.id}`}
                  type={field.type}
                  disabled
                  placeholder={field.placeholder}
                  className={cn(fieldClass, 'disabled:cursor-not-allowed disabled:opacity-60')}
                />
              </div>
            ))}
          </div>

          <p className="rounded-2xl bg-stone/60 px-4 py-3 text-sm text-muted-foreground">
            {t('integrations.nothingStored')}
          </p>

          <div className="flex flex-wrap gap-3">
            <button type="button" disabled className={pill('primary')}>
              {connected ? t('integrations.save') : t('integrations.connect')}
            </button>
            <button type="button" onClick={close} className={pill('secondary')}>
              {t('integrations.close')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
