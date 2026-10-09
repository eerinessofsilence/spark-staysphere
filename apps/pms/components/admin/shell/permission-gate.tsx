import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import type { TeamPermissionKey } from '@/lib/domain/schemas';

/** Server-side page boundary; links are hidden in the nav, direct URLs are gated here too. */
export async function PermissionGate({ permission, children }: { permission: TeamPermissionKey; children: ReactNode }) {
  try {
    await requirePermission(permission);
  } catch (error) {
    if (error instanceof AdminPermissionError) notFound();
    throw error;
  }
  return children;
}
