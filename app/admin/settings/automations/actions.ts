'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/application/admin-session';
import { emailAutomationsService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { AutomationTrigger, EmailAutomationRule } from '@/lib/domain/ports';
import { getAdminT } from '@/lib/i18n/admin/server';

export interface AutomationActionResult {
  ok: boolean;
  message: string;
}

export async function setAutomationEnabledAction(id: string, enabled: boolean, label: string): Promise<AutomationActionResult> {
  const t = await getAdminT();
  await requirePermission('team.permIntegrations');
  const hotelSlug = await getSelectedHotelSlug();
  const ok = await emailAutomationsService.setEnabled(hotelSlug, id, enabled);
  if (!ok) return { ok: false, message: t('automations.hotelNotFound') };
  revalidatePath('/admin/settings/automations');
  return { ok: true, message: t('automations.updated', { automation: label, state: enabled ? t('automations.on') : t('automations.off') }) };
}

export interface AutomationPreviewResult {
  ok: boolean;
  message?: string;
  subject?: string;
  body?: string;
  /** The designed HTML a guest's mail client actually renders — see `lib/application/email-html.ts`. */
  html?: string;
}

/** A stored rule's id for the plain "view what this sends" button, or a draft `{trigger, subject, body}` for the editor's own live preview before it's saved. */
export async function previewAutomationAction(input: string | { trigger: AutomationTrigger; subject: string; body: string }): Promise<AutomationPreviewResult> {
  const t = await getAdminT();
  await requirePermission('team.permIntegrations');
  const hotelSlug = await getSelectedHotelSlug();
  const preview = await emailAutomationsService.preview(hotelSlug, input);
  if (!preview) return { ok: false, message: t('automations.hotelNotFound') };
  return { ok: true, subject: preview.subject, body: preview.body, html: preview.html };
}

export interface SaveAutomationResult {
  ok: boolean;
  message: string;
  rule?: EmailAutomationRule;
}

const SAVE_ERROR_KEY = {
  hotelNotFound: 'automations.hotelNotFound',
  notFound: 'automations.notFound',
  triggerLocked: 'automations.triggerLocked',
  invalid: 'automations.invalidRule',
} as const;

export async function saveAutomationAction(input: {
  id?: string;
  trigger: AutomationTrigger;
  subject: string;
  body: string;
  enabled: boolean;
}): Promise<SaveAutomationResult> {
  const t = await getAdminT();
  await requirePermission('team.permIntegrations');
  const hotelSlug = await getSelectedHotelSlug();
  const result = await emailAutomationsService.saveRule(hotelSlug, input);
  if (!result.ok) return { ok: false, message: t(SAVE_ERROR_KEY[result.message]) };
  revalidatePath('/admin/settings/automations');
  return { ok: true, message: t(input.id ? 'automations.updatedRule' : 'automations.created'), rule: result.rule };
}

export async function deleteAutomationAction(id: string): Promise<AutomationActionResult> {
  const t = await getAdminT();
  await requirePermission('team.permIntegrations');
  const hotelSlug = await getSelectedHotelSlug();
  const ok = await emailAutomationsService.deleteRule(hotelSlug, id);
  if (!ok) return { ok: false, message: t('automations.deleteFailed') };
  revalidatePath('/admin/settings/automations');
  return { ok: true, message: t('automations.deleted') };
}
