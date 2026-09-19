'use server';

import { requireAdminSession } from '@/lib/application/admin-session';
import { headers } from 'next/headers';
import { z } from 'zod';
import { adminAssistantService, assistantInterpreterSource } from '@/lib/application/container';
import type { AdminApplyResult, AdminAskResult } from '@/lib/application/admin-assistant-service';
import { beginRequest, checkRateLimit, clientKeyFromHeaders, endRequest } from '@/lib/application/assistant-rate-limit';
import { MAX_UTTERANCE_LENGTH } from '@/lib/application/assistant-service';
import { adminDraftSchema, adminProposalSchema } from '@/lib/domain/admin-assistant';
import { revalidateContent } from '../content/_lib/revalidate';

/**
 * The admin assistant's two calls, as server actions rather than API routes
 * — the back office is server actions only (CLAUDE.md). Same guards as the
 * guest's `/api/assistant/search`: the per-isolate rate limit and the
 * one-in-flight lock, keyed the same way; and, as there, nothing here ever
 * logs the request text. The conversation's state (`draft`, `history`)
 * arrives from the browser with every message and is parsed, not trusted.
 */

const askSchema = z.object({
  utterance: z.string().max(MAX_UTTERANCE_LENGTH),
  draft: adminDraftSchema.nullable(),
  history: z.array(z.object({ role: z.enum(['admin', 'assistant']), text: z.string().max(MAX_UTTERANCE_LENGTH * 2) })).max(20),
});

export type AdminAskResponse =
  | { ok: true; result: AdminAskResult; interpretedBy: 'openai' | 'keyword' }
  | { ok: false; error: 'too_many_requests' | 'busy' | 'failed' };

export async function askAdminAssistantAction(input: unknown): Promise<AdminAskResponse> {
  await requireAdminSession();
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'failed' };

  const clientKey = clientKeyFromHeaders(await headers());
  if (!checkRateLimit(clientKey, 'chat')) return { ok: false, error: 'too_many_requests' };
  if (!beginRequest(clientKey)) return { ok: false, error: 'busy' };
  try {
    const result = await adminAssistantService.ask(parsed.data);
    return { ok: true, result, interpretedBy: result.usedInterpreter ? assistantInterpreterSource() : 'keyword' };
  } catch (error) {
    console.error('Admin assistant: ask failed.', error instanceof Error ? error.message : error);
    return { ok: false, error: 'failed' };
  } finally {
    endRequest(clientKey);
  }
}

/**
 * The proposal comes back from the browser, so it is parsed, not trusted —
 * and it carries the version it was read at, so a change made in between
 * surfaces as a conflict exactly as it would from the admin form.
 */
export async function applyAdminProposalAction(proposal: unknown): Promise<AdminApplyResult> {
  await requireAdminSession();
  const parsed = adminProposalSchema.safeParse(proposal);
  if (!parsed.success) return { ok: false, reason: 'validation', message: 'That proposal is not one this assistant made.' };

  const result = await adminAssistantService.apply(parsed.data);
  if (result.ok && parsed.data.kind !== 'navigate') revalidateContent();
  return result;
}
