import { expect, it } from 'vitest';
import { filterDocuments } from './document-filters';
import { emptyIdentity } from '@/lib/domain/guest-document';

it('combines name, passport number, document type and status filters', () => {
  const items = [{ guestName: 'Ada Guest', identity: { ...emptyIdentity, firstName: 'Ada', lastName: 'Guest', documentNumber: 'AB123' }, status: 'active' as const, reservationReference: 'REF123' }];
  expect(filterDocuments(items, { query: 'guest ada', status: 'active', type: 'passport' })).toHaveLength(1);
  expect(filterDocuments(items, { query: 'ab123', status: '', type: '' })).toHaveLength(1);
  expect(filterDocuments(items, { query: '', status: 'deleted', type: '' })).toHaveLength(0);
  expect(filterDocuments(items, { query: '', status: '', type: 'id' })).toHaveLength(0);
});
