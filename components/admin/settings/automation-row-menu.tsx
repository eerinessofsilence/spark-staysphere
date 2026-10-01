'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, EllipsisHorizontalIcon, EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { AutomationTrigger, EmailAutomationRule } from '@/lib/domain/ports';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { useUndoableDelete } from '@/components/admin/shell/undoable-delete';
import type { AutomationActionResult, AutomationPreviewResult, SaveAutomationResult } from '@/app/admin/settings/automations/actions';
import { AutomationEditorModal } from './automation-editor-button';
import { AutomationPreviewModal } from './automation-preview-button';

const itemClass =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-stone data-disabled:cursor-not-allowed data-disabled:opacity-60';

/**
 * A row's Preview, Edit and Delete behind one "⋯" — same shape as the CMS's
 * own `RowActions`, plus a Preview item so the same action the whole card's
 * own click opens (`automation-row.tsx`) is still explicit and keyboard-
 * reachable. A built-in rule has no Delete item at all (it can't be
 * removed).
 */
export function AutomationRowMenu({
  rule,
  label,
  saveAction,
  previewAction,
  deleteAction,
}: {
  rule: EmailAutomationRule;
  label: string;
  saveAction: (input: { id?: string; trigger: AutomationTrigger; subject: string; body: string; enabled: boolean }) => Promise<SaveAutomationResult>;
  previewAction: (input: string | { trigger: AutomationTrigger; subject: string; body: string }) => Promise<AutomationPreviewResult>;
  deleteAction: (id: string) => Promise<AutomationActionResult>;
}) {
  const t = useAdminT();
  const router = useRouter();
  const deferDelete = useUndoableDelete();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function remove() {
    setDeleting(true);
    setConfirming(false);
    const result = await deferDelete(`automation:${rule.id}`, label, () => deleteAction(rule.id));
    setDeleting(false);
    if (!result) return;
    if (result.ok) {
      setConfirming(false);
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          disabled={deleting}
          openOnHover
          delay={80}
          closeDelay={150}
          aria-label={t('form.actionsFor', { label })}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground"
        >
          <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className="min-w-44 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <Menu.Item onClick={() => setPreviewOpen(true)} closeOnClick className={itemClass}>
                <EyeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('automations.previewAction')}
              </Menu.Item>
              <Menu.Item onClick={() => setEditorOpen(true)} closeOnClick className={itemClass}>
                <PencilSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('form.edit')}
              </Menu.Item>
              {!rule.builtIn ? (
                <Menu.Item onClick={() => setConfirming(true)} closeOnClick className={cn(itemClass, 'text-danger data-highlighted:bg-danger/10')}>
                  <TrashIcon className="size-4 shrink-0" aria-hidden="true" />
                  {t('form.delete')}
                </Menu.Item>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <AutomationPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} ruleId={rule.id} label={label} action={previewAction} />
      <AutomationEditorModal open={editorOpen} onOpenChange={setEditorOpen} rule={rule} saveAction={saveAction} previewAction={previewAction} />

      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('form.removeLabel', { label })}>
        <p className="text-sm">{t('automations.deleteConfirm')}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={remove} disabled={deleting} className={pill('primary')}>
            {deleting ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('form.remove')}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={pill('secondary')}>
            {t('form.keepIt')}
          </button>
        </div>
      </Modal>
    </>
  );
}
