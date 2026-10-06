'use client';

import * as React from 'react';

/** Counts shown beside sidebar items, keyed by the item's href — today only the unread guest messages on Communications. */
export type AdminBadges = Partial<Record<string, number>>;

const AdminBadgesContext = React.createContext<AdminBadges>({});

/**
 * Provided once by `AdminShell` so both places `AdminNav` renders — the
 * desk sidebar and the phone's menu sheet — read the same numbers without
 * each being handed them.
 */
export function AdminBadgesProvider({ badges, children }: { badges: AdminBadges; children: React.ReactNode }) {
  return <AdminBadgesContext.Provider value={badges}>{children}</AdminBadgesContext.Provider>;
}

export function useAdminBadges(): AdminBadges {
  return React.useContext(AdminBadgesContext);
}
