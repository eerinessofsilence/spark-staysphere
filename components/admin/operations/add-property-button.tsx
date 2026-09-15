'use client';

import * as React from 'react';
import { BuildingOffice2Icon, PlusIcon } from '@heroicons/react/24/outline';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';

/**
 * Onboarding a second property is real StaySphere scope — the property
 * switcher in the sidebar already shows what a portfolio looks like — but
 * this demo's whole backend is one hotel (`DEMO_HOTEL_SLUG`), so there is
 * nothing here to actually create. Same honesty as "Mock adapters" on
 * Integrations or "Demo — sign-in and roles arrive with admin auth" on Team
 * & roles: say what the button would do once it's real, not pretend it works.
 */
export function AddPropertyButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill(variant)}>
        <PlusIcon className="size-4" aria-hidden="true" />
        Add property
      </button>

      <Modal open={open} onClose={close} title="Add property">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
            <BuildingOffice2Icon className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            This demo manages one property, Asteria Cove. A production StaySphere account holds as
            many hotels as a team runs, each with its own dashboard, content and reservations —
            switching between them is what the property picker in the sidebar previews.
          </p>
        </div>
      </Modal>
    </>
  );
}
