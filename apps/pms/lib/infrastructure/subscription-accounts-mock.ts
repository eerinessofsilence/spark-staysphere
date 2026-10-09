import type { SubscriptionAccount, SubscriptionAccountPort } from '@/lib/domain/subscription';

export function createMockSubscriptionAccounts(): SubscriptionAccountPort {
  const accounts = new Map<string, SubscriptionAccount>();
  return {
    async startTrial(account) {
      if (!accounts.has(account.memberId)) accounts.set(account.memberId, { ...account });
      return { ...accounts.get(account.memberId)! };
    },
    async activateDemo(memberId, demoEndsAt) {
      const account = accounts.get(memberId);
      if (!account) throw new Error('Subscription account not found');
      accounts.set(memberId, { ...account, demoEndsAt });
      return { ...accounts.get(memberId)! };
    },
  };
}
