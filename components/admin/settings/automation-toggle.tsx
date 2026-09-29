'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/admin/shell/toast';
import type { AutomationActionResult } from '@/app/admin/settings/automations/actions';

/**
 * One automation's on/off switch — no undo, no version: unlike a CMS field
 * or an add-on's sale status, flipping this has nothing to conflict with,
 * so a plain toggle-and-refresh is the whole interaction.
 */
export function AutomationToggle({
  id,
  enabled,
  label,
  action,
}: {
  id: string;
  enabled: boolean;
  label: string;
  action: (id: string, enabled: boolean, label: string) => Promise<AutomationActionResult>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Switch
      id={`automation-${id}`}
      aria-label={label}
      checked={enabled}
      disabled={pending}
      onCheckedChange={async (checked) => {
        setPending(true);
        const result = await action(id, checked, label);
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
