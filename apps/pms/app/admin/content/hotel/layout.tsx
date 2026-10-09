import type { ReactNode } from 'react';
import { PermissionGate } from '@/components/admin/shell/permission-gate';

export default function HotelSettingsAccessLayout({ children }: { children: ReactNode }) {
  return <PermissionGate permission="team.permBrandDomain">{children}</PermissionGate>;
}
