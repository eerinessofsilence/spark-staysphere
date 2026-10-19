'use client';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { SaleToggleResult } from '@/components/admin/content/add-on-sale-toggle';
import { useUndoableToggle } from '@/components/admin/content/use-undoable-toggle';
import { useAdminT } from '@/lib/i18n/admin/context';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from '@/components/admin/shell/toast';

export function AddOnToggle({
  addOnId,
  addOnName,
  enabled,
  action,
}: {
  addOnId: string;
  addOnName: string;
  enabled: boolean;
  action: (id: string, enabled: boolean) => Promise<SaleToggleResult>;
}) {
  const router = useRouter();
  const t = useAdminT();
  const { pending, setPending, message, setMessage, undoTo, setUndoTo } = useUndoableToggle<boolean>();
  const id = `addon-toggle-${addOnId}`;

  const change = async (checked: boolean, offerUndo: boolean) => {
    setPending(true);
    setMessage('');
    const result = await action(addOnId, checked);
    if (result.ok) {
      setUndoTo(offerUndo ? !checked : null);
      toast.success(
        result.message || (checked ? t('ops.addOnOnSale', { addOn: addOnName }) : t('ops.addOnWithdrawn', { addOn: addOnName })),
      );
      router.refresh();
    } else {
      // A version conflict or a validation failure must not look like it
      // saved — the switch itself already reflects the server's last-known
      // state once router.refresh() below runs, so this message is what
      // tells the hotel team the flip they just made did not take.
      setUndoTo(null);
      setMessage(result.message);
      toast.error(result.message);
      router.refresh();
    }
    setPending(false);
  };

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
        <Switch
          id={id}
          aria-label={addOnName}
          checked={enabled}
          disabled={pending}
          onCheckedChange={(checked) => change(checked, true)}
          className="shrink-0"
        />
        <span className={cn('font-medium', !enabled && 'text-muted-foreground')}>
          {enabled ? t('ops.onSale') : t('ops.withdrawn')}
          <span className="sr-only"> — {addOnName}</span>
        </span>
      </label>
      {pending ? (
        <ArrowPathIcon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : undoTo !== null ? (
        <button
          type="button"
          onClick={() => change(undoTo, false)}
          className="cursor-pointer font-medium underline underline-offset-2"
        >
          <span aria-hidden="true">{t('ops.undo')}</span>
          <span className="sr-only">{t('ops.undoFor', { addOn: addOnName })}</span>
        </button>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" className="w-full text-xs text-muted-foreground basis-full">
          {message}
        </p>
      ) : null}
    </div>
  );
}
