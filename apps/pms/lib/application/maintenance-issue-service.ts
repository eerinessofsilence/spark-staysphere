import type { Clock } from '../domain/ports';
import type { HousekeeperMaintenanceIssue, MaintenanceIssue, MaintenanceIssueCategory, MaintenanceIssueNotification, MaintenanceIssueStatus, MaintenanceIssueStore, MaintenanceReplacement } from '../domain/maintenance-issue';
import { MAINTENANCE_ISSUE_CATEGORIES, maintenanceIssueStatusSchema } from '../domain/maintenance-issue';
import { jpegDimensions } from '../domain/photo-upload';
import type { PrivateDocumentStorage } from '../domain/guest-document';
import type { TeamMember } from './team-directory';
import type { TeamService } from './team-service';
import type { HousekeepingService } from './housekeeping-service';
import type { CatalogService } from './catalog-service';
import type { CatalogReader } from '../domain/ports';

export const MAX_MAINTENANCE_PHOTOS = 5;
export const MAX_MAINTENANCE_PHOTO_BYTES = 700_000;
export const MAX_MAINTENANCE_DESCRIPTION = 1_000;

export interface MaintenancePhotoInput {
  bytes: ArrayBuffer;
  contentType: string;
  view?: 'photo' | '360';
}

export type CreateMaintenanceIssueResult =
  | { ok: true; issue: MaintenanceIssue; created: boolean; notificationCount: number }
  | { ok: false; error: 'forbidden' | 'roomNotFound' | 'notAssigned' | 'invalidInput' | 'storageUnavailable' };

export type MaintenanceReplacementResult =
  | { ok: true; issue: MaintenanceIssue }
  | { ok: false; error: 'forbidden' | 'notFound' | 'invalidInput' | 'resolved' | 'noHotelier' | 'notRequested' };

export type MaintenancePhotosResult =
  | { ok: true; issue: MaintenanceIssue }
  | { ok: false; error: 'forbidden' | 'notFound' | 'invalidInput' | 'photoLimit' | 'storageUnavailable' };

function isCategory(value: string): value is MaintenanceIssueCategory {
  return (MAINTENANCE_ISSUE_CATEGORIES as readonly string[]).includes(value);
}

function validJpeg(photo: MaintenancePhotoInput): boolean {
  const dimensions = jpegDimensions(photo.bytes);
  return photo.contentType === 'image/jpeg' && photo.bytes.byteLength > 0 &&
    photo.bytes.byteLength <= MAX_MAINTENANCE_PHOTO_BYTES && dimensions !== null &&
    (photo.view === undefined || photo.view === 'photo' || (photo.view === '360' && dimensions.width === dimensions.height * 2));
}

export class MaintenanceIssueService {
  constructor(
    private readonly store: MaintenanceIssueStore,
    private readonly storage: PrivateDocumentStorage,
    private readonly catalog: Pick<CatalogService, 'getHotel'>,
    private readonly rooms: Pick<CatalogReader, 'listPhysicalRooms'>,
    private readonly housekeeping: Pick<HousekeepingService, 'listAssignments'>,
    private readonly team: Pick<TeamService, 'listMembers' | 'hasPermission'>,
    private readonly clock: Clock,
    private readonly demoStore: () => MaintenanceIssueStore | null = () => null,
  ) {}

  async create(input: {
    hotelSlug: string;
    unitId: string;
    category: string;
    description: string;
    reporter: TeamMember;
    idempotencyKey: string;
    photos: MaintenancePhotoInput[];
  }): Promise<CreateMaintenanceIssueResult> {
    const isHousekeeper = input.reporter.role === 'Housekeeper';
    if (input.reporter.status !== 'active' || (!isHousekeeper && input.reporter.role !== 'Owner' && input.reporter.role !== 'Hotelier') || !(await this.team.hasPermission(input.reporter.role, 'team.permHousekeeping'))) {
      return { ok: false, error: 'forbidden' };
    }
    if (!isCategory(input.category) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idempotencyKey) ||
      input.description.length > MAX_MAINTENANCE_DESCRIPTION || input.photos.length < 1 ||
      input.photos.length > MAX_MAINTENANCE_PHOTOS || !input.photos.every(validJpeg)) {
      return { ok: false, error: 'invalidInput' };
    }

    const hotel = await this.catalog.getHotel(input.hotelSlug);
    if (!isHousekeeper && !(await this.canManageHotel(input.reporter, hotel.id))) return { ok: false, error: 'forbidden' };
    const [rooms, assignments] = await Promise.all([
      this.rooms.listPhysicalRooms(hotel.id),
      isHousekeeper ? this.housekeeping.listAssignments(input.hotelSlug) : Promise.resolve([]),
    ]);
    const room = rooms.find((candidate) => candidate.id === input.unitId);
    if (!room) return { ok: false, error: 'roomNotFound' };
    if (isHousekeeper && !assignments.some((assignment) => assignment.hotelId === hotel.id && assignment.unitId === room.id && assignment.memberId === input.reporter.id)) {
      return { ok: false, error: 'notAssigned' };
    }

    const existing = await this.store.findByIdempotencyKey(hotel.id, input.reporter.id, input.idempotencyKey);
    if (existing) return { ok: true, issue: existing, created: false, notificationCount: 0 };

    const id = crypto.randomUUID();
    const createdAt = this.clock.now().toISOString();
    const uploadedKeys: string[] = [];
    const photos = input.photos.map((photo) => {
      const photoId = crypto.randomUUID();
      const objectKey = `maintenance/${hotel.id}/${id}/${photoId}.jpg`;
      return { id: photoId, issueId: id, hotelId: hotel.id, objectKey, contentType: 'image/jpeg' as const, view: photo.view ?? 'photo' as const };
    });

    let saveAttempted = false;
    try {
      for (const [index, photo] of input.photos.entries()) {
        uploadedKeys.push(photos[index]!.objectKey);
        await this.storage.put(photos[index]!.objectKey, photo.bytes, 'image/jpeg');
      }

      const issue: MaintenanceIssue = {
        id,
        hotelId: hotel.id,
        unitId: room.id,
        roomNumber: room.number,
        category: input.category,
        description: input.description.trim() || null,
        reporterId: input.reporter.id,
        reporterName: input.reporter.name,
        createdAt,
        updatedAt: createdAt,
        status: 'Open',
        idempotencyKey: input.idempotencyKey,
        photos,
      };
      const recipients = (await this.team.listMembers()).filter((member) =>
        member.status === 'active' && member.role === 'Hotelier' && member.hotelIds?.includes(hotel.id),
      );
      const authorized = await Promise.all(recipients.map(async (member) =>
        await this.team.hasPermission(member.role, 'team.permHousekeeping') ? member : null,
      ));
      const notifications: MaintenanceIssueNotification[] = authorized.filter((member): member is TeamMember => member !== null).map((member) => ({
        id: crypto.randomUUID(),
        hotelId: hotel.id,
        recipientId: member.id,
        issueId: id,
        title: 'New Maintenance Issue',
        message: `Room ${room.number}: ${input.category} issue reported.`,
        createdAt,
        readAt: null,
      }));

      saveAttempted = true;
      const saved = await this.store.create({ issue, notifications });
      if (!saved.created) await this.storage.delete(uploadedKeys).catch(() => undefined);
      return { ok: true, issue: saved.issue, created: saved.created, notificationCount: saved.created ? notifications.length : 0 };
    } catch {
      // A storage error after the database commit can leave a saved issue.
      // Never delete its evidence unless we can establish that this upload lost the race.
      if (saveAttempted) {
        try {
          const saved = await this.store.findByIdempotencyKey(hotel.id, input.reporter.id, input.idempotencyKey);
          if (saved) {
            if (saved.id !== id) await this.storage.delete(uploadedKeys).catch(() => undefined);
            return { ok: true, issue: saved, created: false, notificationCount: 0 };
          }
          await this.storage.delete(uploadedKeys).catch(() => undefined);
        } catch { /* Preserve evidence while the database outcome is unknown. */ }
      } else {
        await this.storage.delete(uploadedKeys).catch(() => undefined);
      }
      return { ok: false, error: 'storageUnavailable' };
    }
  }

  async canManageHotel(member: TeamMember, hotelId: string): Promise<boolean> {
    const allowedHotel = member.role === 'Owner' || (member.role === 'Hotelier' && Boolean(member.hotelIds?.includes(hotelId)));
    return member.status === 'active' && allowedHotel &&
      await this.team.hasPermission(member.role, 'team.permHousekeeping');
  }

  async addPhotos(input: { hotelId: string; issueId: string; member: TeamMember; idempotencyKey: string; photos: MaintenancePhotoInput[] }): Promise<MaintenancePhotosResult> {
    if (!(await this.canManageHotel(input.member, input.hotelId))) return { ok: false, error: 'forbidden' };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idempotencyKey) ||
      input.photos.length < 1 || input.photos.length > MAX_MAINTENANCE_PHOTOS || !input.photos.every(validJpeg)) {
      return { ok: false, error: 'invalidInput' };
    }
    const issue = await this.getForHotelier(input.hotelId, input.issueId, input.member);
    if (!issue) return { ok: false, error: 'notFound' };
    const store = issue.demo ? this.demoStore() : this.store;
    if (!store?.addPhotos) return { ok: false, error: 'storageUnavailable' };
    const photos = input.photos.map((photo, index) => {
      const id = `${issue.id}:${input.idempotencyKey}:${index}`;
      return { id, issueId: issue.id, hotelId: issue.hotelId,
        objectKey: `maintenance/${issue.hotelId}/${issue.id}/${id}-${crypto.randomUUID()}.jpg`, contentType: 'image/jpeg' as const, view: photo.view ?? 'photo' as const };
    });
    if (photos.every((photo) => issue.photos.some((saved) => saved.id === photo.id))) return { ok: true, issue };
    if (issue.photos.length + photos.filter((photo) => !issue.photos.some((saved) => saved.id === photo.id)).length > MAX_MAINTENANCE_PHOTOS) {
      return { ok: false, error: 'photoLimit' };
    }
    const uploadedKeys: string[] = [];
    try {
      for (const [index, photo] of photos.entries()) {
        if (issue.photos.some((saved) => saved.id === photo.id)) continue;
        uploadedKeys.push(photo.objectKey);
        await this.storage.put(photo.objectKey, input.photos[index]!.bytes, 'image/jpeg');
      }
      const saved = await store.addPhotos(issue.hotelId, issue.id, photos, this.clock.now().toISOString());
      if (saved) {
        await this.storage.delete(uploadedKeys.filter((key) => !saved.photos.some((photo) => photo.objectKey === key))).catch(() => undefined);
        return { ok: true, issue: saved };
      }
      const current = await store.get(issue.hotelId, issue.id);
      await this.storage.delete(uploadedKeys.filter((key) => !current?.photos.some((photo) => photo.objectKey === key))).catch(() => undefined);
      return { ok: false, error: 'photoLimit' };
    } catch {
      try {
        const saved = await store.get(issue.hotelId, issue.id);
        if (saved && photos.every((photo) => saved.photos.some((item) => item.id === photo.id))) {
          await this.storage.delete(uploadedKeys.filter((key) => !saved.photos.some((photo) => photo.objectKey === key))).catch(() => undefined);
          return { ok: true, issue: saved };
        }
        const unreferenced = uploadedKeys.filter((key) => !saved?.photos.some((photo) => photo.objectKey === key));
        await this.storage.delete(unreferenced).catch(() => undefined);
      } catch { /* Keep evidence when the database outcome cannot be established. */ }
      return { ok: false, error: 'storageUnavailable' };
    }
  }

  async listForHousekeeper(hotelSlug: string, member: TeamMember): Promise<HousekeeperMaintenanceIssue[]> {
    if (member.status !== 'active' || member.role !== 'Housekeeper' || !(await this.team.hasPermission(member.role, 'team.permHousekeeping'))) return [];
    const hotel = await this.catalog.getHotel(hotelSlug);
    const assignments = await this.housekeeping.listAssignments(hotelSlug);
    const assignedUnits = new Set(assignments.filter((assignment) => assignment.hotelId === hotel.id && assignment.memberId === member.id)
      .map((assignment) => assignment.unitId));
    if (assignedUnits.size === 0) return [];
    const issues = await this.store.list(hotel.id);
    const examples = (await this.demoStore()?.list(hotel.id)) ?? [];
    return [...issues, ...examples]
      .filter((issue) => issue.reporterId === member.id && assignedUnits.has(issue.unitId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id, unitId, category, description, status, createdAt, demo }) => ({ id, unitId, category, description, status, createdAt, demo }));
  }

  async removePhoto(hotelId: string, issueId: string, photoId: string, member: TeamMember): Promise<MaintenancePhotosResult> {
    if (!(await this.canManageHotel(member, hotelId))) return { ok: false, error: 'forbidden' };
    const issue = await this.getForHotelier(hotelId, issueId, member);
    if (!issue) return { ok: false, error: 'notFound' };
    const photo = issue.photos.find((attachment) => attachment.id === photoId);
    if (!photo) return { ok: true, issue };
    const store = issue.demo ? this.demoStore() : this.store;
    if (!store) return { ok: false, error: 'storageUnavailable' };
    try {
      const saved = await store.removePhoto(hotelId, issueId, photoId, this.clock.now().toISOString());
      if (!saved || saved.photos.some((attachment) => attachment.id === photoId)) return { ok: false, error: 'storageUnavailable' };
      // Drop the reference first so no authenticated read can serve a removed attachment.
      await this.storage.delete([photo.objectKey]).catch(() => { console.warn('Removed maintenance attachment cleanup failed'); });
      return { ok: true, issue: saved };
    } catch { return { ok: false, error: 'storageUnavailable' }; }
  }

  async getForHotelier(hotelId: string, issueId: string, member: TeamMember): Promise<MaintenanceIssue | null> {
    if (!(await this.canManageHotel(member, hotelId))) return null;
    const demo = await this.demoStore()?.get(hotelId, issueId);
    if (demo) return demo;
    return this.store.get(hotelId, issueId);
  }

  async listForHotelier(hotelId: string, member: TeamMember): Promise<MaintenanceIssue[]> {
    if (!(await this.canManageHotel(member, hotelId))) return [];
    const issues = await this.store.list(hotelId);
    const examples = (await this.demoStore()?.list(hotelId)) ?? [];
    return [...issues, ...examples].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateStatus(hotelId: string, issueId: string, status: MaintenanceIssueStatus, member: TeamMember): Promise<MaintenanceIssue | null> {
    if (!(await this.canManageHotel(member, hotelId))) return null;
    const parsed = maintenanceIssueStatusSchema.safeParse(status);
    if (!parsed.success) return null;
    const issue = await this.getForHotelier(hotelId, issueId, member);
    if (!issue || (status === 'Resolved' && issue.replacement?.status === 'Pending')) return null;
    const demoStore = this.demoStore();
    if (demoStore && await demoStore.get(hotelId, issueId)) {
      return demoStore.updateStatus(hotelId, issueId, parsed.data, this.clock.now().toISOString());
    }
    return this.store.updateStatus(hotelId, issueId, parsed.data, this.clock.now().toISOString());
  }

  async requestReplacement(hotelId: string, issueId: string, reason: string, member: TeamMember): Promise<MaintenanceReplacementResult> {
    if (!(await this.canManageHotel(member, hotelId))) return { ok: false, error: 'forbidden' };
    const trimmed = reason.trim();
    if (!trimmed || trimmed.length > MAX_MAINTENANCE_DESCRIPTION) return { ok: false, error: 'invalidInput' };
    const issue = await this.getForHotelier(hotelId, issueId, member);
    if (!issue) return { ok: false, error: 'notFound' };
    if (issue.status === 'Resolved') return { ok: false, error: 'resolved' };
    if (issue.replacement) return { ok: true, issue };
    const candidates = (await this.team.listMembers()).filter((candidate) =>
      candidate.role === 'Hotelier' && candidate.status === 'active' && candidate.hotelIds?.includes(hotelId));
    const recipients = (await Promise.all(candidates.map(async (candidate) =>
      await this.canManageHotel(candidate, hotelId) ? candidate : null))).filter((candidate): candidate is TeamMember => candidate !== null);
    if (!issue.demo && recipients.length === 0) return { ok: false, error: 'noHotelier' };
    const requestedAt = this.clock.now().toISOString();
    const replacement: MaintenanceReplacement = {
      id: crypto.randomUUID(), status: 'Pending', reason: trimmed,
      requestedById: member.id, requestedByName: member.name, requestedAt,
      approvedById: null, approvedByName: null, approvedAt: null,
    };
    const notifications: MaintenanceIssueNotification[] = issue.demo ? [] : recipients.map((recipient) => ({
      id: `${replacement.id}:${recipient.id}`, hotelId, recipientId: recipient.id, issueId,
      title: 'Replacement Approval Required', message: `Room ${issue.roomNumber}: ${trimmed}`,
      createdAt: requestedAt, readAt: null,
    }));
    const store = issue.demo ? this.demoStore() : this.store;
    const updated = await store?.requestReplacement(hotelId, issueId, replacement, notifications);
    return updated?.replacement ? { ok: true, issue: updated } : { ok: false, error: 'resolved' };
  }

  async approveReplacement(hotelId: string, issueId: string, member: TeamMember): Promise<MaintenanceReplacementResult> {
    if (member.role !== 'Hotelier' || !(await this.canManageHotel(member, hotelId))) return { ok: false, error: 'forbidden' };
    const issue = await this.getForHotelier(hotelId, issueId, member);
    if (!issue) return { ok: false, error: 'notFound' };
    if (!issue.replacement) return { ok: false, error: 'notRequested' };
    if (issue.replacement.status === 'Approved') return { ok: true, issue };
    const store = issue.demo ? this.demoStore() : this.store;
    const updated = await store?.approveReplacement(hotelId, issueId, member.id, member.name, this.clock.now().toISOString());
    return updated?.replacement?.status === 'Approved' ? { ok: true, issue: updated } : { ok: false, error: 'notFound' };
  }

  async readPhoto(hotelId: string, issueId: string, photoId: string, member: TeamMember) {
    if (!(await this.canManageHotel(member, hotelId))) return null;
    const issue = await this.getForHotelier(hotelId, issueId, member);
    const photo = issue?.photos.find((candidate) => candidate.id === photoId);
    if (!photo) return null;
    return this.storage.get(photo.objectKey);
  }

  async listNotifications(hotelId: string, member: TeamMember) {
    if (!(await this.canManageHotel(member, hotelId))) return [];
    return this.store.listNotifications(hotelId, member.id);
  }

  async markIssueNotificationsRead(hotelId: string, issueId: string, member: TeamMember): Promise<void> {
    if (!(await this.canManageHotel(member, hotelId))) return;
    if (await this.demoStore()?.get(hotelId, issueId)) return;
    await this.store.markNotificationsRead(hotelId, member.id, issueId, this.clock.now().toISOString());
  }
}
