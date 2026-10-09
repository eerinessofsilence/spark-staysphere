import type { MaintenanceIssueStore } from '../domain/maintenance-issue';
import { maintenanceIssueStoreD1 } from './maintenance-issue-store-d1';

/** Maintenance reports require durable issue and notification records; never report success using an in-memory fallback. */
export const durableMaintenanceIssueStore: MaintenanceIssueStore = maintenanceIssueStoreD1;
