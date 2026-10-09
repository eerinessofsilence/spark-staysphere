import type { MaintenanceIssue, MaintenanceIssueNotification, MaintenanceIssueStore } from '../domain/maintenance-issue';
import { demoHotels, demoPhysicalRooms } from './mock-data';

/** Local demo examples; status edits stay in this process and never send notifications. */
const examples: Array<Pick<MaintenanceIssue, 'category' | 'status' | 'description' | 'reporterName'> & { hoursAgo: number; photo: string }> = [
  { category: 'Air Conditioning', status: 'Open', description: 'The air conditioner runs without cooling the room. The lower louver is broken and water is dripping down the wall. Repair needed: inspect the cooling and drainage system, replace the damaged louver, and check for leaks before returning the unit to service.', reporterName: 'Nina Petrou', hoursAgo: 1, photo: 'air-conditioning-demo' },
  { category: 'Plumbing', status: 'Open', description: 'Water leaks from the drain-pipe joint under the bathroom sink whenever the tap runs. The cabinet floor is wet. Repair needed: repair the leaking joint, replace its seal if necessary, and test the drain with running water.', reporterName: 'Maria Christou', hoursAgo: 3, photo: 'sink-leak-demo' },
  { category: 'Electrical', status: 'In Progress', description: 'The bedside reading lamp does not turn on when the switch is pressed. Repair in progress: the technician is checking the lamp and switch to identify the faulty component. Verify normal operation before closing the issue.', reporterName: 'Nina Petrou', hoursAgo: 5, photo: 'reading-light-demo' },
  { category: 'Furniture', status: 'Open', description: 'The wardrobe door is sagging because the upper hinge is loose and a screw has backed out. Repair needed: secure or replace the damaged hinge fixing, align the door, and check that it opens and closes smoothly.', reporterName: 'Anna Nicolaou', hoursAgo: 7, photo: 'wardrobe-hinge-demo' },
  { category: 'Bathroom', status: 'In Progress', description: 'The shower drains slowly and standing water covers the tiled floor after use. Repair in progress: maintenance is clearing the blocked drain. Check drainage with the shower running and confirm that no water remains on the floor.', reporterName: 'Maria Christou', hoursAgo: 11, photo: 'shower-drain-demo' },
  { category: 'TV / Internet', status: 'Open', description: 'The television switches on but shows a no-signal message instead of channels. Repair needed: inspect the signal connection and receiver, restore the channel feed, and verify picture and sound.', reporterName: 'Nina Petrou', hoursAgo: 18, photo: 'tv-signal-demo' },
  { category: 'Other', status: 'In Progress', description: 'The balcony-door handle is misaligned and its mounting plate is loose, making the door difficult to close. Repair in progress: maintenance is securing the handle and adjusting the latch. Confirm that the door closes and locks properly.', reporterName: 'Anna Nicolaou', hoursAgo: 24, photo: 'balcony-handle-demo' },
  { category: 'Air Conditioning', status: 'Resolved', description: 'Reported problem: weak airflow and poor cooling. Repair completed: the air-conditioner filter was cleaned and refitted. Airflow and cooling were checked and are back to normal. The attached photo shows the clean filter after servicing.', reporterName: 'Maria Christou', hoursAgo: 30, photo: 'ac-filter-demo' },
  { category: 'Plumbing', status: 'Resolved', description: 'Reported problem: the shower hose leaked at its connection. Repair completed: the damaged hose was replaced and both connections were secured. The shower was tested with running water and no leaks were found. The photo shows the replacement hose.', reporterName: 'Nina Petrou', hoursAgo: 40, photo: 'shower-hose-demo' },
  { category: 'Electrical', status: 'Open', description: 'The socket next to the desk has a loose, cracked faceplate and does not supply power. It has been taken out of use. Repair needed: a qualified electrician must inspect the socket, replace damaged parts, and confirm it is safe before use.', reporterName: 'Anna Nicolaou', hoursAgo: 50, photo: 'socket-demo' },
  { category: 'Furniture', status: 'In Progress', description: 'The luggage rack wobbles because a hinge is loose and one support strap is detached. It has been removed from guest use. Repair in progress: maintenance is repairing the hinge and replacing the strap. Check stability before putting it back in the room.', reporterName: 'Nina Petrou', hoursAgo: 66, photo: 'luggage-rack-demo' },
  { category: 'TV / Internet', status: 'Resolved', description: 'Reported problem: the room Wi-Fi connection repeatedly dropped. Repair completed: the faulty access point was replaced. Connection and coverage were checked in the room and are stable. The attached photo shows the new access point operating.', reporterName: 'Maria Christou', hoursAgo: 80, photo: 'wifi-access-point-demo' },
];
const seededAt = Date.now();
const seededIssues: MaintenanceIssue[] = demoHotels.flatMap((hotel, hotelIndex) =>
  demoPhysicalRooms.filter((room) => room.hotelId === hotel.id).slice(0, examples.length).map((room, index) => {
    const example = examples[index]!;
    const id = `${(0xd3e00000 + hotelIndex).toString(16)}-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    const createdAt = new Date(seededAt - example.hoursAgo * 3_600_000).toISOString();
    return {
      id, hotelId: hotel.id, unitId: room.id, roomNumber: room.number,
      category: example.category, status: example.status, description: example.description,
      reporterId: example.reporterName === 'Nina Petrou' ? 'housekeeper-demo' : `demo-maintenance-reporter-${example.reporterName}`,
      reporterName: example.reporterName,
      createdAt, updatedAt: createdAt, idempotencyKey: id, photos: [], demo: true,
      demoPhotoUrls: [`/images/maintenance/${example.photo}.png`],
    };
  }),
);
const issues = new Map(seededIssues.map((issue) => [issue.id, issue]));
const notifications = new Map<string, MaintenanceIssueNotification>();

export const mockMaintenanceIssueStore: MaintenanceIssueStore = {
  async removePhoto(hotelId, issueId, photoId, updatedAt) {
    const issue = issues.get(issueId);
    if (!issue || issue.hotelId !== hotelId) return null;
    const updated = { ...issue, photos: issue.photos.filter((photo) => photo.id !== photoId), updatedAt };
    issues.set(issueId, updated); return updated;
  },
  async findByIdempotencyKey(hotelId, reporterId, key) {
    return [...issues.values()].find((issue) => issue.hotelId === hotelId && issue.reporterId === reporterId && issue.idempotencyKey === key) ?? null;
  },
  async create({ issue, notifications: newNotifications }) {
    const existing = [...issues.values()].find((item) => item?.hotelId === issue.hotelId && item.reporterId === issue.reporterId && item.idempotencyKey === issue.idempotencyKey);
    if (existing) return { issue: existing, created: false };
    issues.set(issue.id, issue);
    for (const notification of newNotifications) notifications.set(notification.id, notification);
    return { issue, created: true };
  },
  async get(hotelId, issueId) {
    const issue = issues.get(issueId);
    return issue?.hotelId === hotelId ? issue : null;
  },
  async list(hotelId, limit) {
    return [...issues.values()].filter((issue) => issue.hotelId === hotelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },
  async updateStatus(hotelId, issueId, status, updatedAt) {
    const current = issues.get(issueId);
    if (!current || current.hotelId !== hotelId || (status === 'Resolved' && current.replacement?.status === 'Pending')) return null;
    const updated = { ...current, status, updatedAt };
    issues.set(issueId, updated);
    return updated;
  },
  async addPhotos(hotelId, issueId, photos, updatedAt) {
    const current = issues.get(issueId);
    if (!current || current.hotelId !== hotelId) return null;
    const added = photos.filter((photo) => !current.photos.some((saved) => saved.id === photo.id));
    if (current.photos.length + added.length > 5) return null;
    const updated = { ...current, photos: [...current.photos, ...added], updatedAt };
    issues.set(issueId, updated);
    return updated;
  },
  async requestReplacement(hotelId, issueId, replacement, newNotifications) {
    const current = issues.get(issueId);
    if (!current || current.hotelId !== hotelId || current.status === 'Resolved') return null;
    if (current.replacement) return current;
    const updated = { ...current, replacement, updatedAt: replacement.requestedAt };
    issues.set(issueId, updated);
    for (const notification of newNotifications) notifications.set(notification.id, notification);
    return updated;
  },
  async approveReplacement(hotelId, issueId, approverId, approverName, approvedAt) {
    const current = issues.get(issueId);
    if (!current || current.hotelId !== hotelId || !current.replacement) return null;
    if (current.replacement.status === 'Approved') return current;
    const updated: MaintenanceIssue = { ...current, updatedAt: approvedAt,
      replacement: { ...current.replacement, status: 'Approved', approvedById: approverId, approvedByName: approverName, approvedAt } };
    issues.set(issueId, updated);
    return updated;
  },
  async listNotifications(hotelId, recipientId, limit = 30) {
    return [...notifications.values()].filter((item) => item.hotelId === hotelId && item.recipientId === recipientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },
  async markNotificationsRead(hotelId, recipientId, issueId, readAt) {
    for (const [id, item] of notifications) {
      if (item.hotelId === hotelId && item.recipientId === recipientId && item.issueId === issueId && !item.readAt) {
        notifications.set(id, { ...item, readAt });
      }
    }
  },
};
