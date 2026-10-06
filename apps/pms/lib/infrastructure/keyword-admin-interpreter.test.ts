import { describe, expect, it } from 'vitest';
import { emptyRoomTypeDraft, type AdminDraft } from '../domain/admin-assistant';
import { interpretAdminKeywords } from './keyword-admin-interpreter';

const vocabulary = {
  roomTypes: ['Deluxe Sea View', 'Sea View Room', 'Garden Studio', 'Panorama Suite'],
  addOns: ['Airport transfer', 'Breakfast in the room'],
};

describe('interpretAdminKeywords', () => {
  it('reads a nightly price for the room type it names, preferring the longest matching name', () => {
    const command = interpretAdminKeywords('Set Deluxe Sea View to 320 a night', vocabulary);
    expect(command).toMatchObject({ action: 'set_rate_price', target: 'Deluxe Sea View', price: 320 });
  });

  it('accepts a decimal price with a comma', () => {
    expect(interpretAdminKeywords('change the garden studio rate to 199,50', vocabulary).price).toBe(199.5);
  });

  it('hides and shows a room type', () => {
    expect(interpretAdminKeywords('Hide Garden Studio', vocabulary)).toMatchObject({ action: 'set_room_hidden', target: 'Garden Studio', hidden: true });
    expect(interpretAdminKeywords('show the panorama suite again', vocabulary)).toMatchObject({ action: 'set_room_hidden', target: 'Panorama Suite', hidden: false });
  });

  it('sets an availability override, including clearing it', () => {
    expect(interpretAdminKeywords('Mark Panorama Suite sold out', vocabulary)).toMatchObject({ action: 'set_room_status', target: 'Panorama Suite', status: 'sold_out' });
    expect(interpretAdminKeywords('put the sea view room back on sale', vocabulary)).toMatchObject({ action: 'set_room_status', target: 'Sea View Room', status: 'available' });
    expect(interpretAdminKeywords('clear the override on deluxe sea view', vocabulary)).toMatchObject({ action: 'set_room_status', status: 'auto' });
  });

  it('puts an add-on on or off sale before reading the verb as a room action', () => {
    expect(interpretAdminKeywords('take the airport transfer off sale', vocabulary)).toMatchObject({ action: 'set_add_on_enabled', target: 'Airport transfer', enabled: false });
    expect(interpretAdminKeywords('enable breakfast in the room', vocabulary)).toMatchObject({ action: 'set_add_on_enabled', target: 'Breakfast in the room', enabled: true });
  });

  it('opens a screen', () => {
    expect(interpretAdminKeywords('Open room rates', vocabulary)).toMatchObject({ action: 'navigate', page: 'rates' });
    expect(interpretAdminKeywords('go to the front desk', vocabulary)).toMatchObject({ action: 'navigate', page: 'front-desk' });
    expect(interpretAdminKeywords('show me reservations', vocabulary)).toMatchObject({ action: 'navigate', page: 'reservations' });
  });

  it('passes on the admin’s own words for a target when no catalog name appears whole', () => {
    expect(interpretAdminKeywords('hide sea view', vocabulary)).toMatchObject({ action: 'set_room_hidden', target: 'sea view' });
    expect(interpretAdminKeywords('set the deluxe to 280 per night', vocabulary)).toMatchObject({ action: 'set_rate_price', target: 'deluxe', price: 280 });
  });

  it('leaves the target null when nothing but the request’s own words remain, so the service can ask', () => {
    expect(interpretAdminKeywords('hide it', vocabulary)).toMatchObject({ action: 'set_room_hidden', target: null });
    expect(interpretAdminKeywords('change the rate to 200', vocabulary)).toMatchObject({ action: 'set_rate_price', target: null });
  });

  it('returns unknown, with the phrase, for anything it cannot do', () => {
    expect(interpretAdminKeywords('book a table for two', vocabulary)).toMatchObject({ action: 'unknown', unresolved: ['book a table for two'] });
  });

  describe('creating a room type', () => {
    it('starts one, taking whatever details the request gives, and notices a room being asked for too', () => {
      const command = interpretAdminKeywords('Create a room type and a room for it', vocabulary);
      expect(command).toMatchObject({ action: 'create_room_type', alsoRoom: true });
      expect(command.roomType).toEqual(emptyRoomTypeDraft);

      const detailed = interpretAdminKeywords('add a new room type called "Harbour Loft" on the 3rd floor, 42 m², sleeps 2, king bed, sea view', vocabulary);
      expect(detailed).toMatchObject({
        action: 'create_room_type',
        alsoRoom: false,
        roomType: { name: 'Harbour Loft', floor: 3, areaM2: 42, capacity: 2, bedType: 'king', view: 'sea', description: null },
      });
    });

    it('reads a reply as the answer to the draft’s next open question', () => {
      const draft: AdminDraft = { kind: 'create_room_type', fields: { ...emptyRoomTypeDraft }, thenRoom: false };
      expect(interpretAdminKeywords('Harbour Loft', vocabulary, draft).roomType.name).toBe('Harbour Loft');

      const askedFloor: AdminDraft = { ...draft, fields: { ...emptyRoomTypeDraft, name: 'Harbour Loft', description: 'A loft over the harbour.' } };
      expect(interpretAdminKeywords('ground floor', vocabulary, askedFloor).roomType.floor).toBe(0);
      expect(interpretAdminKeywords('3', vocabulary, askedFloor).roomType.floor).toBe(3);

      const askedBed: AdminDraft = { ...draft, fields: { ...emptyRoomTypeDraft, name: 'x', description: 'y', floor: 1, areaM2: 30, capacity: 2 } };
      expect(interpretAdminKeywords('twin please', vocabulary, askedBed).roomType.bedType).toBe('twin');
    });

    it('keeps a name that mentions a bed or a view whole, and still takes the detail', () => {
      const draft: AdminDraft = { kind: 'create_room_type', fields: { ...emptyRoomTypeDraft }, thenRoom: false };
      const command = interpretAdminKeywords('Garden King Suite', vocabulary, draft);
      expect(command.roomType.name).toBe('Garden King Suite');
      expect(command.roomType).toMatchObject({ bedType: 'king', view: 'garden' });
    });
  });

  describe('adding a room', () => {
    it('reads the type and the number from one request', () => {
      expect(interpretAdminKeywords('add room 305 to Garden Studio', vocabulary)).toMatchObject({ action: 'create_physical_room', target: 'Garden Studio', roomNumber: '305' });
    });

    it('asks for the number when the request has none, and reads the reply as it', () => {
      expect(interpretAdminKeywords('add a room to the panorama suite', vocabulary)).toMatchObject({ action: 'create_physical_room', target: 'Panorama Suite', roomNumber: null });
      const draft: AdminDraft = { kind: 'create_physical_room', roomTypeId: 'room_x', roomTypeName: 'Panorama Suite', suggestedNumber: '702' };
      expect(interpretAdminKeywords('g04', vocabulary, draft)).toMatchObject({ action: 'create_physical_room', roomNumber: 'G04' });
      expect(interpretAdminKeywords('yes', vocabulary, draft)).toMatchObject({ action: 'create_physical_room', roomNumber: null });
    });
  });
});
