'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { approveMaintenanceReplacementAction, markMaintenanceIssueReadAction, requestMaintenanceReplacementAction, updateMaintenanceIssueStatusAction } from '@/app/admin/maintenance/actions';
import type { MaintenanceIssueStatus, MaintenanceReplacement } from '@/lib/domain/maintenance-issue';
import { fieldClass, pill } from '@/lib/ui';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';

export function MaintenanceIssueActions({ issueId, hotelSlug, status, replacement, canApproveReplacement, timezone }: {
  issueId: string; hotelSlug: string; status: MaintenanceIssueStatus;
  replacement?: MaintenanceReplacement | null; canApproveReplacement: boolean; timezone: string;
}) {
  const router = useRouter();
  const t = useAdminT();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [readError, setReadError] = React.useState(false);
  const [saved, setSaved] = React.useState('');
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const locale = useAdminLocale();
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone });
  const awaitingApproval = replacement?.status === 'Pending';
  const lock = React.useRef(false);
  const markRead = React.useCallback(async () => {
    try {
      const result = await markMaintenanceIssueReadAction(issueId, hotelSlug);
      setReadError(!result.ok);
    } catch { setReadError(true); }
  }, [issueId, hotelSlug]);
  React.useEffect(() => { void markRead(); }, [markRead]);

  async function update(next: MaintenanceIssueStatus) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(''); setSaved('');
    try {
      const result = await updateMaintenanceIssueStatusAction(issueId, hotelSlug, next);
      if (!result.ok) { setError(result.message); return; }
      setSaved(t('maintenance.saved'));
      router.refresh();
    } catch { setError(t('maintenance.failed')); }
    finally { lock.current = false; setBusy(false); }
  }

  async function changeReplacement(approve: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSaved('');
    try {
      const result = approve ? await approveMaintenanceReplacementAction(issueId, hotelSlug)
        : await requestMaintenanceReplacementAction(issueId, hotelSlug, reason);
      if (!result.ok) { setError(result.message); return; }
      setSaved(result.message); setRequestOpen(false);
      router.refresh();
    } catch { setError(t('maintenance.replacementFailed')); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div data-tour="maintenance-status" className="mt-6 border-t border-border pt-5">
    <section aria-label={t('maintenance.replacement')} className="mb-6 grid gap-3">
      <h2 className="text-sm font-medium">{t('maintenance.replacement')}</h2>
      {replacement ? <>
        <p className="text-sm font-medium">{t(awaitingApproval ? 'maintenance.replacementPending' : 'maintenance.replacementApproved')}</p>
        <p className="whitespace-pre-wrap text-sm">{replacement.reason}</p>
        <p className="text-xs text-muted-foreground">{t('maintenance.replacementRequestedBy', {
          name: replacement.requestedByName, date: formatter.format(new Date(replacement.requestedAt)),
        })}</p>
        {replacement.approvedAt && replacement.approvedByName ? <p className="text-xs text-muted-foreground">{t('maintenance.replacementApprovedBy', {
          name: replacement.approvedByName, date: formatter.format(new Date(replacement.approvedAt)),
        })}</p> : null}
        {awaitingApproval ? <>
          <p className="text-sm text-muted-foreground">{t('maintenance.replacementPendingClose')}</p>
          {canApproveReplacement ? <button type="button" disabled={busy} onClick={() => void changeReplacement(true)}
            className={pill('primary', 'w-fit')}>{t('maintenance.approveReplacement')}</button> : null}
        </> : <p className="text-sm text-muted-foreground">{t('maintenance.replacementApprovedHelp')}</p>}
      </> : status !== 'Resolved' ? <>
        <p className="text-sm text-muted-foreground">{t('maintenance.replacementHelp')}</p>
        {requestOpen ? <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void changeReplacement(false); }}>
          <label className="grid gap-2 text-sm font-medium">{t('maintenance.replacementReason')}
            <textarea required maxLength={1000} rows={3} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)}
              placeholder={t('maintenance.replacementPlaceholder')} className={fieldClass} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !reason.trim()} className={pill('primary')}>{t('maintenance.sendReplacement')}</button>
            <button type="button" disabled={busy} onClick={() => setRequestOpen(false)} className={pill('secondary')}>{t('maintenance.cancelReplacement')}</button>
          </div>
        </form> : <button type="button" disabled={busy} onClick={() => { setError(''); setSaved(''); setRequestOpen(true); }}
          className={pill('secondary', 'w-fit')}>{t('maintenance.requestReplacement')}</button>}
      </> : <p className="text-sm text-muted-foreground">{t('maintenance.replacementResolved')}</p>}
    </section>
    <h2 className="text-sm font-medium">{t('maintenance.status')}</h2>
    <div className="mt-3 flex flex-wrap gap-2">
      {status === 'Open' ? <button type="button" disabled={busy} onClick={() => void update('In Progress')} className={pill('primary')}>{t('maintenance.markInProgress')}</button> : null}
      {status !== 'Resolved' ? <button type="button" disabled={busy || awaitingApproval} onClick={() => void update('Resolved')} className={pill('secondary')}>{t('maintenance.markResolved')}</button> : null}
      {status === 'Resolved' ? <button type="button" disabled={busy} onClick={() => void update('Open')} className={pill('secondary')}>{t('maintenance.reopen')}</button> : null}
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
    {busy || saved ? <p role="status" className="mt-3 text-sm text-muted-foreground">{busy ? t('maintenance.saving') : saved}</p> : null}
    {readError ? <p role="alert" className="mt-3 text-sm text-danger">{t('maintenance.readFailed')}
      <button type="button" onClick={() => void markRead()} className={pill('ghost', 'ml-2')}>{t('maintenance.retry')}</button>
    </p> : null}
  </div>;
}
