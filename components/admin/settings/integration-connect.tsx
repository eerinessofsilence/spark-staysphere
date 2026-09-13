'use client';

import * as React from 'react';
import { Modal } from '@/components/site/modal';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface IntegrationConnectProps {
  name: string;
  connected: boolean;
  steps: string[];
}

export function IntegrationConnect({ name, connected, steps }: IntegrationConnectProps) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        {connected ? 'Manage' : 'Connect'}
        <span className="sr-only"> {name}</span>
      </button>
      <Modal open={open} onClose={close} title={`${connected ? 'Manage' : 'Connect'} ${name}`}>
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-medium">What connecting does</p>
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
              Credentials
            </h3>
            {[
              { label: 'API endpoint', placeholder: 'https://', type: 'url' },
              { label: 'Client ID', placeholder: 'Provided by the system you connect', type: 'text' },
              { label: 'Secret', placeholder: '••••••••', type: 'password' },
            ].map((field) => (
              <div key={field.label}>
                <label htmlFor={`${id}-${field.label}`} className="mb-1.5 block text-sm text-muted-foreground">
                  {field.label}
                </label>
                <input
                  id={`${id}-${field.label}`}
                  type={field.type}
                  disabled
                  placeholder={field.placeholder}
                  className={cn(fieldClass, 'disabled:cursor-not-allowed disabled:opacity-60')}
                />
              </div>
            ))}
          </div>

          <p className="rounded-2xl bg-stone/60 px-4 py-3 text-sm text-muted-foreground">
            Nothing is stored in this demo. Credentials are entered here once a live adapter replaces
            the mock.
          </p>

          <div className="flex flex-wrap gap-3">
            <button type="button" disabled className={pill('primary')}>
              {connected ? 'Save' : 'Connect'}
            </button>
            <button type="button" onClick={close} className={pill('secondary')}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
