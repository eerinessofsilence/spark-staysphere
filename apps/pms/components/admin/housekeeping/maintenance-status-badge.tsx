import { CheckCircle, Clock, Wrench } from '@phosphor-icons/react/dist/ssr';
import type { MaintenanceIssueStatus } from '@/lib/domain/maintenance-issue';
import { maintenanceStatusKeys } from '@/lib/i18n/admin/maintenance';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { statusBadge } from '@/lib/ui';

const marks = {
  Open: { Icon: Wrench, tone: 'text-warning' },
  'In Progress': { Icon: Clock, tone: 'text-accent-strong' },
  Resolved: { Icon: CheckCircle, tone: 'text-success' },
};

export function MaintenanceStatusBadge({ status, t }: { status: MaintenanceIssueStatus; t: AdminT }) {
  const { Icon, tone } = marks[status];
  return <span className={statusBadge()}>
    <Icon weight="fill" className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
    {t(maintenanceStatusKeys[status])}
  </span>;
}
