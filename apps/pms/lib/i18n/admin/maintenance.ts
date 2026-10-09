import type { MaintenanceIssueCategory, MaintenanceIssueStatus } from '@/lib/domain/maintenance-issue';
import type { AdminTranslationKey } from './dictionaries';

export const maintenanceCategoryKeys: Record<MaintenanceIssueCategory, AdminTranslationKey> = {
  'Air Conditioning': 'maintenance.airConditioning',
  Plumbing: 'maintenance.plumbing',
  Electrical: 'maintenance.electrical',
  Furniture: 'maintenance.furniture',
  Bathroom: 'maintenance.bathroom',
  'TV / Internet': 'maintenance.tvInternet',
  Other: 'maintenance.other',
};

export const maintenanceStatusKeys: Record<MaintenanceIssueStatus, AdminTranslationKey> = {
  Open: 'maintenance.open',
  'In Progress': 'maintenance.inProgress',
  Resolved: 'maintenance.resolved',
};
