'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/admin/shell/toast';
import { announceVersion } from './version-channel';
import { useUndoableToggle } from './use-undoable-toggle';

export interface SaleToggleResult {
  ok: boolean;
  message: string;
  version?: number;
  previousVersion?: number;
}

interface AddOnSaleToggleProps {
  addOnId: string;
  enabled: boolean;
  action: (id: string, enabled: boolean) => Promise<SaleToggleResult>;
}

/**
 * On sale or withdrawn, from an add-on's own page. It acts at once — exactly like the switch in
 * the add-on list — so both places behave the same, say what they did, and offer an undo. The
 * form below keeps its version in step through the shared channel.
 */
export function AddOnSaleToggle({ addOnId, enabled, action }: AddOnSaleToggleProps) {
  const t = useAdminT();
  const router = useRouter();
  const { pending, setPending, message, setMessage, undoTo, setUndoTo } = useUndoableToggle<boolean>();

  const apply = async (next: boolean, offerUndo: boolean) => {
    setPending(true);
    setMessage('');
    const result = await action(addOnId, next);
    if (result.ok && result.version !== undefined && result.previousVersion !== undefined) {
      announceVersion(`addon:${addOnId}`, result.previousVersion, result.version);
      setUndoTo(offerUndo ? !next : null);
      toast.success(result.message);
      router.refresh();
    } else {
      setUndoTo(null);
      toast.error(result.message);
    }
    setMessage(result.ok ? '' : result.message);
    setPending(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label
        htmlFor="addon-on-sale"
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full border border-border bg-card pr-4 pl-2 text-sm font-medium"
      >
        <Switch
          id="addon-on-sale"
          aria-label={t('addOn.onSale')}
          checked={enabled}
          disabled={pending}
          onCheckedChange={(checked) => apply(checked, true)}
          className="shrink-0"
        />
        {enabled ? t('addOn.onSale') : t('addOn.withdrawn')}
        {pending ? <ArrowPathIcon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
      </label>
      <p role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        {message}
        {undoTo !== null && !pending ? (
          <button
            type="button"
            onClick={() => apply(undoTo, false)}
            className="cursor-pointer font-medium text-foreground underline underline-offset-2"
          >
            {t('addOn.undo')}
          </button>
        ) : null}
      </p>
    </div>
  );
}
