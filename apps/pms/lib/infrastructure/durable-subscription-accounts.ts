import type { SubscriptionAccount, SubscriptionAccountPort } from '@/lib/domain/subscription';
import { getDemoDatabase } from './cloudflare-env';
import { ensureSchema } from './d1-schema';
import { createMockSubscriptionAccounts } from './subscription-accounts-mock';

const mock = createMockSubscriptionAccounts();
const select = 'SELECT member_id AS memberId, trial_started_at AS trialStartedAt, trial_ends_at AS trialEndsAt, demo_ends_at AS demoEndsAt FROM subscription_accounts WHERE member_id = ?';

async function read(db: D1Database, memberId: string): Promise<SubscriptionAccount> {
  const account = await db.prepare(select).bind(memberId).first<SubscriptionAccount>();
  if (!account) throw new Error('Subscription account not found');
  return account;
}

export const durableSubscriptionAccounts: SubscriptionAccountPort = {
  async startTrial(account) {
    const db = getDemoDatabase();
    if (!db) return mock.startTrial(account);
    await ensureSchema(db);
    await db.prepare('INSERT INTO subscription_accounts (member_id, trial_started_at, trial_ends_at) VALUES (?, ?, ?) ON CONFLICT(member_id) DO NOTHING')
      .bind(account.memberId, account.trialStartedAt, account.trialEndsAt).run();
    return read(db, account.memberId);
  },
  async activateDemo(memberId, endsAt) {
    const db = getDemoDatabase();
    if (!db) return mock.activateDemo(memberId, endsAt);
    await ensureSchema(db);
    await db.prepare('UPDATE subscription_accounts SET demo_ends_at = ? WHERE member_id = ?').bind(endsAt, memberId).run();
    return read(db, memberId);
  },
};
