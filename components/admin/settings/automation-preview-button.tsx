'use client';

import * as React from 'react';
import { EyeIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import type { AutomationPreviewResult } from '@/app/admin/settings/automations/actions';

/**
 * What a guest actually receives for one stored automation, rendered
 * against a fabricated stay — never a real booking, never sent. Controlled
 * from outside (`open`/`onOpenChange`) so a row can open it from a click
 * anywhere on the card, not only from `AutomationPreviewButton`'s own eye
 * icon — see `automation-row.tsx`.
 */
export function AutomationPreviewModal({
  open,
  onOpenChange,
  ruleId,
  label,
  action,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId: string;
  label: string;
  action: (input: string) => Promise<AutomationPreviewResult>;
}) {
  const t = useAdminT();
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<{ subject: string; html: string } | null>(null);

  React.useEffect(() => {
    if (!open || preview || loading) return;
    setLoading(true);
    action(ruleId).then((result) => {
      setLoading(false);
      if (result.ok && result.subject && result.html) {
        setPreview({ subject: result.subject, html: result.html });
      } else {
        toast.error(result.message ?? t('automations.previewFailed'));
        onOpenChange(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetches once per open; `action`/`t`/`onOpenChange` are stable enough for a settings-screen modal
  }, [open, ruleId]);

  // Drop the fetched preview once closed, so a different row's "Preview" doesn't flash the last one's content before its own fetch resolves.
  React.useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title={t('automations.previewTitle', { automation: label })} className="sm:max-w-2xl">
      {loading || !preview ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('automations.previewLoading')}</p>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('automations.previewIntro')}</p>
          <div className="rounded-2xl border border-border bg-stone/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('automations.previewSubject')}</p>
            <p className="mt-1 font-medium">{preview.subject}</p>
          </div>
          {/* Sandboxed and script-less: this is a fully self-contained, inline-styled document (`renderAutomationEmailHtml`), rendered exactly as a guest's mail client would. */}
          <iframe
            title={t('automations.previewTitle', { automation: label })}
            srcDoc={preview.html}
            sandbox=""
            className="h-[560px] w-full rounded-2xl border border-border bg-white"
          />
        </div>
      )}
    </Modal>
  );
}

/** The eye icon on its own, for anywhere the row-level click (`automation-row.tsx`) doesn't apply. */
export function AutomationPreviewButton({
  ruleId,
  label,
  action,
}: {
  ruleId: string;
  label: string;
  action: (input: string) => Promise<AutomationPreviewResult>;
}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('automations.preview', { automation: label })}
        title={t('automations.preview', { automation: label })}
        className={iconButton('light', 'size-10 shrink-0')}
      >
        <EyeIcon className="size-4" aria-hidden="true" />
      </button>
      <AutomationPreviewModal open={open} onOpenChange={setOpen} ruleId={ruleId} label={label} action={action} />
    </>
  );
}
