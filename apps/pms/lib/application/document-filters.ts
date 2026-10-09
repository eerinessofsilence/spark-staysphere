import type { GuestDocument } from '@/lib/domain/guest-document';

export function filterDocuments<T extends Pick<GuestDocument, 'status' | 'identity' | 'reservationReference'> & { guestName: string }>(documents: T[], filters: { query: string; status: string; type: string }): T[] {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return documents.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.type && item.identity.documentType !== filters.type) return false;
    const text = `${item.guestName} ${item.identity.firstName} ${item.identity.lastName} ${item.identity.documentNumber} ${item.reservationReference}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
