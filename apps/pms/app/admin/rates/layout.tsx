import type { ReactNode } from 'react';
import { PermissionGate } from '@/components/admin/shell/permission-gate';

export default function RatesAccessLayout({ children }: { children: ReactNode }) {
  return <PermissionGate permission="team.permEditRates">{children}</PermissionGate>;
}
