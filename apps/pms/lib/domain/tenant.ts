export interface DraftHotel {
  id: string;
  slug: string;
  name: string;
  location: string;
  currency: 'EUR' | 'USD' | 'GBP';
  timezone: string;
  ownerId: string;
  createdAt: string;
  trialEndsAt: string;
}

export interface TenantStore {
  createAccount(input: { id: string; name: string; email: string; passwordHash: string; createdAt: string }): Promise<boolean>;
  findAccount(email: string): Promise<{ id: string; name: string; email: string; role: string; passwordHash: string; onboarded: boolean | number } | null>;
  markOnboarded(memberId: string): Promise<void>;
  createHotel(input: DraftHotel & { submissionKey: string }): Promise<DraftHotel>;
  listHotelsForMember(memberId: string): Promise<DraftHotel[]>;
  findHotel(id: string): Promise<DraftHotel | null>;
}
