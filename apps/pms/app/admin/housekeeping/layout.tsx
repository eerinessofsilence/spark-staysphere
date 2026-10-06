import type { ReactNode } from 'react';
import { PermissionGate } from '@/components/admin/shell/permission-gate';

export default function HousekeepingAccessLayout({ children }: { children: ReactNode }) {
  return <PermissionGate permission="team.permHousekeeping">{children}</PermissionGate>;
}
