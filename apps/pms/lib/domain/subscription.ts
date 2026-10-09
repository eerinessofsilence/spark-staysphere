export type SubscriptionModule = {
  id: string;
  category: 'operations' | 'distribution' | 'guest';
  price: number;
  includedIn: string[];
  name: { en: string; de: string; ru: string };
  description?: { en: string; de: string; ru: string };
};
export interface SubscriptionCatalogPort {
  listModules(): Promise<SubscriptionModule[]>;
}

export type SubscriptionAccount = {
  memberId: string;
  trialStartedAt: string;
  trialEndsAt: string;
  /** Demo entitlement only; never proof of a real payment. */
  demoEndsAt: string | null;
};

export type SubscriptionStatus = {
  state: 'trial' | 'expired' | 'demo-active';
  endsAt: string;
  daysLeft: number;
};

export interface SubscriptionAccountPort {
  /** Atomically create once. Signing in again must never restart the trial. */
  startTrial(account: SubscriptionAccount): Promise<SubscriptionAccount>;
  activateDemo(memberId: string, endsAt: string): Promise<SubscriptionAccount>;
}
