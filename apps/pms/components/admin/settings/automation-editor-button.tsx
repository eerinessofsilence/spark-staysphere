'use client';

import * as React from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { AUTOMATION_TRIGGER_KINDS, type AutomationTrigger, type AutomationTriggerKind, type EmailAutomationRule } from '@/lib/domain/ports';
import { isTimeBasedTrigger, TRIGGER_KIND_OPTION_LABEL_KEY } from '@/lib/i18n/admin/automation-trigger';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { Field, Select, TextArea, TextInput } from '@/components/admin/content/fields';
import type { AutomationPreviewResult, SaveAutomationResult } from '@/app/admin/settings/automations/actions';

const DEFAULT_DAYS = 1;

/**
 * The form both "Edit" (opened from a row's `AutomationRowMenu`) and
 * "Create automation" (`AutomationEditorButton` below) show — controlled
 * from outside (`open`/`onOpenChange`) so either caller owns when it's on
 * screen. A built-in rule's trigger *kind* stays locked (it's what its
 * lifecycle event fires) but its days, subject and body are exactly as
 * editable as a custom rule's; deleting lives in the row menu, not here.
 */
export function AutomationEditorModal({
  open,
  onOpenChange,
  rule,
  saveAction,
  previewAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: EmailAutomationRule;
  saveAction: (input: { id?: string; trigger: AutomationTrigger; subject: string; body: string; enabled: boolean }) => Promise<SaveAutomationResult>;
  previewAction: (input: string | { trigger: AutomationTrigger; subject: string; body: string }) => Promise<AutomationPreviewResult>;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [triggerKind, setTriggerKind] = React.useState<AutomationTriggerKind>(rule?.trigger.kind ?? 'booking_confirmed');
  const [days, setDays] = React.useState(String(rule?.trigger.days ?? DEFAULT_DAYS));
  const [subject, setSubject] = React.useState(rule?.subject ?? '');
  const [body, setBody] = React.useState(rule?.body ?? '');
  const [busy, setBusy] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [preview, setPreview] = React.useState<{ subject: string; html: string } | null>(null);

  // Re-seed from `rule` every time the modal opens rather than once on mount
  // — the same rule can be edited more than once without the page remounting.
  React.useEffect(() => {
    if (!open) return;
    setTriggerKind(rule?.trigger.kind ?? 'booking_confirmed');
    setDays(String(rule?.trigger.days ?? DEFAULT_DAYS));
    setSubject(rule?.subject ?? '');
    setBody(rule?.body ?? '');
    setPreview(null);
  }, [open, rule]);

  const timeBased = isTimeBasedTrigger(triggerKind);
  const trigger: AutomationTrigger = timeBased ? { kind: triggerKind, days: Number(days) || 0 } : { kind: triggerKind };
  const canSave = subject.trim().length > 0 && body.trim().length > 0 && (!timeBased || Number(days) > 0);

  async function runPreview() {
    setPreviewing(true);
    const result = await previewAction({ trigger, subject, body });
    setPreviewing(false);
    if (result.ok && result.subject && result.html) setPreview({ subject: result.subject, html: result.html });
    else toast.error(result.message ?? t('automations.previewFailed'));
  }

  async function save() {
    setBusy(true);
    const result = await saveAction({ id: rule?.id, trigger, subject, body, enabled: rule?.enabled ?? true });
    setBusy(false);
    if (result.ok) {
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title={rule ? t('automations.editTitle') : t('automations.newTitle')} className="sm:max-w-2xl">
      <div className="grid gap-5">
        <Field id="automation-trigger" label={t('automations.trigger')}>
          <Select
            id="automation-trigger"
            value={triggerKind}
            disabled={rule?.builtIn}
            onChange={(value) => setTriggerKind(value as AutomationTriggerKind)}
          >
            {AUTOMATION_TRIGGER_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(TRIGGER_KIND_OPTION_LABEL_KEY[kind])}
              </option>
            ))}
          </Select>
        </Field>

        {timeBased ? (
          <Field id="automation-days" label={triggerKind === 'before_check_in' ? t('automations.daysBeforeCheckIn') : t('automations.daysAfterCheckOut')}>
            <TextInput id="automation-days" type="number" min={1} max={60} required value={days} onChange={(event) => setDays(event.target.value)} />
          </Field>
        ) : null}

        <Field id="automation-subject" label={t('automations.previewSubject')}>
          <TextInput id="automation-subject" maxLength={200} required value={subject} onChange={(event) => setSubject(event.target.value)} />
        </Field>

        <Field id="automation-body" label={t('automations.previewBody')} hint={t('automations.placeholdersHint')}>
          <TextArea id="automation-body" rows={8} required value={body} onChange={(event) => setBody(event.target.value)} className="font-mono text-xs" />
        </Field>

        <div>
          <button type="button" onClick={runPreview} disabled={previewing || !canSave} className={pill('secondary')}>
            {previewing ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('automations.previewAction')}
          </button>
        </div>

        {preview ? (
          <div className="grid gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('automations.previewSubject')}</p>
              <p className="mt-1 font-medium">{preview.subject}</p>
            </div>
            {/* Sandboxed and script-less: a self-contained, inline-styled document (`renderAutomationEmailHtml`), rendered exactly as a guest's mail client would. */}
            <iframe
              title={t('automations.previewAction')}
              srcDoc={preview.html}
              sandbox=""
              className="h-[480px] w-full rounded-2xl border border-border bg-white"
            />
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className={pill('secondary')}>
            {t('automations.cancel')}
          </button>
          <button type="button" onClick={save} disabled={busy || !canSave} className={pill('primary')}>
            {busy ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('automations.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** The header's own "Create automation" pill — owns its open state and hands `AutomationEditorModal` an empty draft. */
export function AutomationEditorButton({
  saveAction,
  previewAction,
}: {
  saveAction: (input: { id?: string; trigger: AutomationTrigger; subject: string; body: string; enabled: boolean }) => Promise<SaveAutomationResult>;
  previewAction: (input: string | { trigger: AutomationTrigger; subject: string; body: string }) => Promise<AutomationPreviewResult>;
}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4" aria-hidden="true" />
        {t('automations.create')}
      </button>
      <AutomationEditorModal open={open} onOpenChange={setOpen} saveAction={saveAction} previewAction={previewAction} />
    </>
  );
}
