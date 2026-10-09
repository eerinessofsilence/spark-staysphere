import type { TenantStore } from '../domain/tenant';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './tenant-store-d1';

function database(): D1Database {
  const db = getDemoDatabase();
  if (!db) throw new Error('Account and hotel storage are unavailable.');
  return db;
}

export const durableTenantStore: TenantStore = {
  createAccount: (input) => d1.createAccount(database(), input),
  findAccount: (email) => d1.findAccount(database(), email),
  markOnboarded: (memberId) => d1.markOnboarded(database(), memberId),
  createHotel: (input) => d1.createHotel(database(), input),
  listHotelsForMember: (memberId) => d1.listHotelsForMember(database(), memberId),
  findHotel: (id) => d1.findHotel(database(), id),
};
