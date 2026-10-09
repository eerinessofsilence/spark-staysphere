import type { SubscriptionAccount, SubscriptionAccountPort, SubscriptionCatalogPort, SubscriptionModule, SubscriptionStatus } from '@/lib/domain/subscription';

const DAY_MS = 24 * 60 * 60 * 1000;
export const FREE_TRIAL_DAYS = 7;

export function subscriptionStatus(account: SubscriptionAccount, now = Date.now()): SubscriptionStatus {
  const demoActive = account.demoEndsAt !== null && Date.parse(account.demoEndsAt) > now;
  const endsAt = demoActive ? account.demoEndsAt! : account.trialEndsAt;
  const daysLeft = Math.max(0, Math.ceil((Date.parse(endsAt) - now) / DAY_MS));
  return { state: demoActive ? 'demo-active' : daysLeft > 0 ? 'trial' : 'expired', endsAt, daysLeft };
}

export function createSubscriptionService(catalog: SubscriptionCatalogPort, accounts: SubscriptionAccountPort, clock = Date.now) {
  async function getAccount(memberId: string) {
    const now = clock();
    return accounts.startTrial({ memberId, trialStartedAt: new Date(now).toISOString(), trialEndsAt: new Date(now + FREE_TRIAL_DAYS * DAY_MS).toISOString(), demoEndsAt: null });
  }
  return {
    listModules: () => catalog.listModules(),
    getAccount,
    async confirmDemoPayment(memberId: string) {
      await getAccount(memberId);
      return accounts.activateDemo(memberId, new Date(clock() + 30 * DAY_MS).toISOString());
    },
  };
}

/** Preview pricing only. Included products never incur a second charge. */
export function selectedModuleCost(modules: SubscriptionModule[], selected: string[], plan: string) {
  return modules.filter((item) => selected.includes(item.id) && !item.includedIn.includes(plan))
    .reduce((sum, item) => sum + item.price, 0);
}
