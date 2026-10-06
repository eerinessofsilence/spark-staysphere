'use client';

import * as React from 'react';
import type { AutomationTrigger, EmailAutomationRule } from '@/lib/domain/ports';
import { AutomationPreviewModal } from './automation-preview-button';
import { AutomationRowMenu } from './automation-row-menu';
import { AutomationToggle } from './automation-toggle';
import type { AutomationActionResult, AutomationPreviewResult, SaveAutomationResult } from '@/app/admin/settings/automations/actions';

/**
 * One automation's row — the whole card opens the preview, the same way a
 * CMS list row opens on a click anywhere on it; the "⋯" menu and the switch
 * stop that click from reaching the card (`stopPropagation`) so toggling or
 * opening Edit doesn't also pop the preview open underneath it.
 */
export function AutomationRow({
  rule,
  title,
  subtitle,
  enabledAction,
  saveAction,
  previewAction,
  deleteAction,
}: {
  rule: EmailAutomationRule;
  title: string;
  subtitle: string;
  enabledAction: (id: string, enabled: boolean, label: string) => Promise<AutomationActionResult>;
  saveAction: (input: { id?: string; trigger: AutomationTrigger; subject: string; body: string; enabled: boolean }) => Promise<SaveAutomationResult>;
  previewAction: (input: string | { trigger: AutomationTrigger; subject: string; body: string }) => Promise<AutomationPreviewResult>;
  deleteAction: (id: string) => Promise<AutomationActionResult>;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);

  return (
    <li
      onClick={() => setPreviewOpen(true)}
      className="flex w-full min-w-0 max-w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:bg-stone/40 sm:gap-4 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" onClick={(event) => event.stopPropagation()}>
        <AutomationRowMenu rule={rule} label={title} saveAction={saveAction} previewAction={previewAction} deleteAction={deleteAction} />
        <AutomationToggle id={rule.id} enabled={rule.enabled} label={title} action={enabledAction} />
      </div>

      {/*
        Wrapped for the same reason as the actions above: `Modal` portals to
        `document.body`, but its clicks still bubble through the *React*
        tree (portals don't opt out of that) — without this, closing the
        modal would re-trigger the row's own `onClick` and reopen it in the
        same tick. `contents` keeps it out of the row's flex layout — a third
        flex child here, even an empty one, throws off how `justify-between`
        splits space between the title and the actions on the right.
      */}
      <div className="contents" onClick={(event) => event.stopPropagation()}>
        <AutomationPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} ruleId={rule.id} label={title} action={previewAction} />
      </div>
    </li>
  );
}
