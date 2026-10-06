import type { ReactNode } from 'react';
import { PermissionGate } from '@/components/admin/shell/permission-gate';

export default function ContentAccessLayout({ children }: { children: ReactNode }) {
  return <PermissionGate permission="team.permEditContent">{children}</PermissionGate>;
}
