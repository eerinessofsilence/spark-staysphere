import { z } from 'zod';

export const MAINTENANCE_ISSUE_CATEGORIES = [
  'Air Conditioning',
  'Plumbing',
  'Electrical',
  'Furniture',
  'Bathroom',
  'TV / Internet',
  'Other',
] as const;

export type MaintenanceIssueCategory = (typeof MAINTENANCE_ISSUE_CATEGORIES)[number];
export const MAINTENANCE_ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved'] as const;
export const maintenanceIssueStatusSchema = z.enum(MAINTENANCE_ISSUE_STATUSES);
export type MaintenanceIssueStatus = z.infer<typeof maintenanceIssueStatusSchema>;

export interface MaintenanceIssue {
  id: string;
  hotelId: string;
  unitId: string;
  roomNumber: string;
  category: MaintenanceIssueCategory;
  description: string | null;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  updatedAt: string;
  status: MaintenanceIssueStatus;
  idempotencyKey: string;
  photos: MaintenanceIssuePhoto[];
  replacement?: MaintenanceReplacement | null;
  demo?: boolean;
  /** Public, generated illustrations for demo examples only; never real uploaded evidence. */
  demoPhotoUrls?: string[];
}

export interface MaintenanceReplacement {
  id: string;
  status: 'Pending' | 'Approved';
  reason: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
}

export interface MaintenanceIssuePhoto {
  id: string;
  issueId: string;
  hotelId: string;
  objectKey: string;
  contentType: 'image/jpeg';
  view?: 'photo' | '360';
}

export type HousekeeperMaintenanceIssue = Pick<MaintenanceIssue,
  'id' | 'unitId' | 'category' | 'description' | 'status' | 'createdAt' | 'demo'>;

export interface MaintenanceIssueNotification {
  id: string;
  hotelId: string;
  recipientId: string;
  issueId: string;
  title: 'New Maintenance Issue' | 'Replacement Approval Required';
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface MaintenanceIssueStore {
  create(input: {
    issue: MaintenanceIssue;
    notifications: MaintenanceIssueNotification[];
  }): Promise<{ issue: MaintenanceIssue; created: boolean }>;
  get(hotelId: string, issueId: string): Promise<MaintenanceIssue | null>;
  findByIdempotencyKey(hotelId: string, reporterId: string, key: string): Promise<MaintenanceIssue | null>;
  list(hotelId: string, limit?: number): Promise<MaintenanceIssue[]>;
  addPhotos(hotelId: string, issueId: string, photos: MaintenanceIssuePhoto[], updatedAt: string): Promise<MaintenanceIssue | null>;
  removePhoto(hotelId: string, issueId: string, photoId: string, updatedAt: string): Promise<MaintenanceIssue | null>;
  updateStatus(hotelId: string, issueId: string, status: MaintenanceIssueStatus, updatedAt: string): Promise<MaintenanceIssue | null>;
  requestReplacement(hotelId: string, issueId: string, replacement: MaintenanceReplacement, notifications: MaintenanceIssueNotification[]): Promise<MaintenanceIssue | null>;
  approveReplacement(hotelId: string, issueId: string, approverId: string, approverName: string, approvedAt: string): Promise<MaintenanceIssue | null>;
  listNotifications(hotelId: string, recipientId: string, limit?: number): Promise<MaintenanceIssueNotification[]>;
  markNotificationsRead(hotelId: string, recipientId: string, issueId: string, readAt: string): Promise<void>;
}
