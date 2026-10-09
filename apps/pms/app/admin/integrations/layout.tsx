import type { ReactNode } from 'react';
import { PermissionGate } from '@/components/admin/shell/permission-gate';
export default function IntegrationsAccessLayout({ children }: { children: ReactNode }) {
  return <PermissionGate permission="team.permIntegrations">{children}</PermissionGate>;
}
