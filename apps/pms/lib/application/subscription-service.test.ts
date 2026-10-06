import { describe, expect, it } from 'vitest';
import { createSubscriptionService, selectedModuleCost, subscriptionStatus } from './subscription-service';
import type { SubscriptionModule } from '@/lib/domain/subscription';
import { createMockSubscriptionAccounts } from '@/lib/infrastructure/subscription-accounts-mock';

const modules: SubscriptionModule[] = [
  { id: 'included', price: 29, category: 'operations', includedIn: ['growth'], name: { en: 'Desk', de: 'Desk', ru: 'Desk' } },
  { id: 'extra', price: 19, category: 'operations', includedIn: [], name: { en: 'Extra', de: 'Extra', ru: 'Extra' } },
];
describe('subscription module estimate', () => {
  it('charges only selected optional modules and ignores unknown IDs and duplicates', () => {
    expect(selectedModuleCost(modules, ['included', 'extra', 'extra', 'unknown'], 'growth')).toBe(19);
  });
  it('recalculates plan inclusions and removal', () => {
    expect(selectedModuleCost(modules, ['included', 'extra'], 'starter')).toBe(48);
    expect(selectedModuleCost(modules, [], 'growth')).toBe(0);
  });
});

describe('seven-day free trial', () => {
  const start = Date.parse('2026-10-05T12:00:00.000Z');
  const day = 86_400_000;
  function setup() {
    let now = start;
    const store = createMockSubscriptionAccounts();
    const service = createSubscriptionService({ listModules: async () => modules }, store, () => now);
    return { service, store, advance: (value: number) => { now = value; } };
  }

  it('starts at zero cost for exactly seven days and expires at the boundary', async () => {
    const { service } = setup();
    const account = await service.getAccount('new-client');
    expect(account.trialEndsAt).toBe('2026-10-12T12:00:00.000Z');
    expect(subscriptionStatus(account, start)).toMatchObject({ state: 'trial', daysLeft: 7 });
    expect(subscriptionStatus(account, start + 7 * day - 1)).toMatchObject({ state: 'trial', daysLeft: 1 });
    expect(subscriptionStatus(account, start + 7 * day)).toMatchObject({ state: 'expired', daysLeft: 0 });
  });

  it('does not restart after sign-in, a service restart, or simultaneous first visits', async () => {
    const { service, store, advance } = setup();
    const [first, simultaneous] = await Promise.all([service.getAccount('client'), service.getAccount('client')]);
    expect(simultaneous).toEqual(first);
    advance(start + 8 * day);
    expect(await service.getAccount('client')).toEqual(first);
    const restarted = createSubscriptionService({ listModules: async () => modules }, store, () => start + 9 * day);
    expect(subscriptionStatus(await restarted.getAccount('client'), start + 9 * day).state).toBe('expired');
    expect(subscriptionStatus(await restarted.getAccount('other-client'), start + 9 * day).daysLeft).toBe(7);
  });

  it('grants a separate thirty-day demo subscription after confirmation without extending the trial', async () => {
    const { service, advance } = setup();
    const trial = await service.getAccount('client');
    advance(start + 7 * day);
    const active = await service.confirmDemoPayment('client');
    expect(active.trialEndsAt).toBe(trial.trialEndsAt);
    expect(subscriptionStatus(active, start + 7 * day)).toMatchObject({ state: 'demo-active', daysLeft: 30 });
    expect(subscriptionStatus(await service.getAccount('other'), start + 7 * day).state).toBe('trial');
    expect(subscriptionStatus(active, start + 37 * day).state).toBe('expired');
  });
});
