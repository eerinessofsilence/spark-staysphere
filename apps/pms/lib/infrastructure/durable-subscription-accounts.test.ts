import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLibsqlD1 } from './libsql-d1';
import { durableSubscriptionAccounts } from './durable-subscription-accounts';

const database = vi.hoisted(() => ({ current: null as D1Database | null }));
vi.mock('./cloudflare-env', () => ({ getDemoDatabase: () => database.current }));

describe('durable subscription accounts', () => {
  beforeEach(() => { database.current = createLibsqlD1(':memory:'); });
  const trial = { memberId: 'client', trialStartedAt: '2026-10-05T12:00:00.000Z', trialEndsAt: '2026-10-12T12:00:00.000Z', demoEndsAt: null };
  it('keeps the original trial under concurrent requests and persists demo access separately', async () => {
    const results = await Promise.all([durableSubscriptionAccounts.startTrial(trial), durableSubscriptionAccounts.startTrial(trial)]);
    expect(results).toEqual([trial, trial]);
    const endsAt = '2026-11-11T12:00:00.000Z';
    expect(await durableSubscriptionAccounts.activateDemo('client', endsAt)).toEqual({ ...trial, demoEndsAt: endsAt });
    expect(await durableSubscriptionAccounts.startTrial({ ...trial, trialEndsAt: endsAt })).toEqual({ ...trial, demoEndsAt: endsAt });
  });
});
