'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { EmailAutomationKind } from '@/lib/domain/ports';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/admin/shell/toast';
import type { AutomationToggleResult } from '@/app/admin/settings/automations/actions';

/**
 * One automation's on/off switch — no undo, no version: unlike a CMS field
 * or an add-on's sale status, flipping this has nothing to conflict with,
 * so a plain toggle-and-refresh is the whole interaction.
 */
export function AutomationToggle({
  kind,
  enabled,
  label,
  action,
}: {
  kind: EmailAutomationKind;
  enabled: boolean;
  label: string;
  action: (kind: EmailAutomationKind, enabled: boolean) => Promise<AutomationToggleResult>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Switch
      id={`automation-${kind}`}
      aria-label={label}
      checked={enabled}
      disabled={pending}
      onCheckedChange={async (checked) => {
        setPending(true);
        const result = await action(kind, checked);
        if (result.ok) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
        setPending(false);
      }}
      className="shrink-0"
    />
  );
}
