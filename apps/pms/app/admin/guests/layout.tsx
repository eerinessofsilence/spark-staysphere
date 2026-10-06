import type { ReactNode } from 'react';
import { PermissionGate } from '@/components/admin/shell/permission-gate';
export default function GuestsAccessLayout({ children }: { children: ReactNode }) {
  return <PermissionGate permission="team.permViewBookings">{children}</PermissionGate>;
}
