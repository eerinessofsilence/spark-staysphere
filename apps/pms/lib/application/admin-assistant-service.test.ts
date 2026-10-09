import { beforeEach, describe, expect, it } from 'vitest';
import { addOnDraftSchema, adminProposalSchema, emptyAddOnDraft, emptyRateDraft, emptyRoomTypeDraft, type AdminDraft } from '../domain/admin-assistant';
import { mergeCatalog } from '../domain/catalog-overlay';
import type { AdminCommand, AdminCommandInterpreter, CatalogEntryRecord, MediaLibraryPort } from '../domain/ports';
import type { AddOn, PhysicalRoom, RatePlan, RoomType } from '../domain/schemas';
import { mockCatalogContentPort } from '../infrastructure/catalog-content-mock';
import { keywordAdminInterpreter } from '../infrastructure/keyword-admin-interpreter';
import { demoHotel } from '../infrastructure/mock-data';
import { mockDemoControlPort, mockHotelRepository } from '../infrastructure/mock-hotel-repository';
import { mockSpinnerFrameStoragePort } from '../infrastructure/spinner-frame-storage-mock';
import { mockSpinnerMarkupPort } from '../infrastructure/spinner-markup-mock';
import { AdminAssistantService, matchByName } from './admin-assistant-service';
import { ContentService } from './content-service';

const noopMedia: MediaLibraryPort = { list: () => [], find: () => undefined };

/**
 * The seed repository never shows a CMS write back (that is the durable
 * repository's job), and an `apply` is only worth testing if the next `ask`
 * sees it — so reads here merge the overlay the way production does.
 */
const repository = {
  ...mockHotelRepository,
  async listRooms(hotelId: string) {
    const overlay = (await mockCatalogContentPort.listEntries('room', hotelId)) as CatalogEntryRecord<RoomType>[];
    return mergeCatalog(await mockHotelRepository.listRooms(hotelId), overlay);
  },
  async listRatePlans(roomTypeId: string) {
    const overlay = (await mockCatalogContentPort.listEntries('rate', demoHotel.id)) as CatalogEntryRecord<RatePlan>[];
    return mergeCatalog(await mockHotelRepository.listRatePlans(roomTypeId), overlay.filter((entry) => entry.data.roomTypeId === roomTypeId));
  },
  async listPhysicalRooms(hotelId: string) {
    const overlay = (await mockCatalogContentPort.listEntries('unit', hotelId)) as CatalogEntryRecord<PhysicalRoom>[];
    return mergeCatalog(await mockHotelRepository.listPhysicalRooms(hotelId), overlay);
  },
  async listAddOns(hotelId: string) {
    const overlay = (await mockCatalogContentPort.listEntries('addon', hotelId)) as CatalogEntryRecord<AddOn>[];
    return mergeCatalog(await mockHotelRepository.listAddOns(hotelId), overlay);
  },
};

function makeContent(media: MediaLibraryPort = noopMedia) {
  return new ContentService(
    repository,
    mockCatalogContentPort,
    media,
    mockSpinnerMarkupPort,
    mockSpinnerFrameStoragePort,
    demoHotel.slug,
    { hotel: new Set([demoHotel.id]), room: new Set(), unit: new Set(), rate: new Set(), addon: new Set() },
  );
}

/** An interpreter that answers with exactly the command a test hands it. */
function scripted(command: Partial<AdminCommand>): AdminCommandInterpreter {
  return {
    async interpret() {
      return {
        action: 'unknown',
        target: null,
        price: null,
        hidden: null,
        status: null,
        enabled: null,
        page: null,
        roomType: { ...emptyRoomTypeDraft },
        roomNumber: null,
        rate: { ...emptyRateDraft },
        addOn: { ...emptyAddOnDraft },
        alsoRoom: null,
        unresolved: [],
        ...command,
      };
    },
  };
}

describe('matchByName', () => {
  const items = [{ name: 'Deluxe Sea View' }, { name: 'Sea View Room' }, { name: 'Garden Studio' }];

  it('takes an exact name, case and punctuation aside', () => {
    expect(matchByName('garden studio!', items)).toEqual({ kind: 'one', item: { name: 'Garden Studio' } });
  });

  it('takes the one name the words are part of', () => {
    expect(matchByName('deluxe', items)).toEqual({ kind: 'one', item: { name: 'Deluxe Sea View' } });
  });

  it('refuses to guess between names that share the words', () => {
    const match = matchByName('sea view', items);
    expect(match.kind).toBe('many');
    if (match.kind === 'many') expect(match.candidates.map((item) => item.name)).toEqual(['Deluxe Sea View', 'Sea View Room']);
  });

  it('finds nothing for words no name has', () => {
    expect(matchByName('penthouse', items)).toEqual({ kind: 'none' });
  });
});

describe('AdminAssistantService', () => {
  let content: ContentService;

  beforeEach(async () => {
    content = makeContent();
    await content.resetContent();
    await mockDemoControlPort.reset();
  });

  it('proposes a rate change with the current price and the version it read, and applies it', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const [room] = await content.listRoomsContent();
    const rates = await content.listRatesContent(room!.id);
    const base = [...rates].sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0]!;

    const asked = await service.ask({ draft: null, history: [], utterance: `set ${room!.name} to 999 a night` });
    expect(asked.outcome).toBe('proposal');
    if (asked.outcome !== 'proposal') return;
    expect(asked.proposal).toMatchObject({
      kind: 'set_rate_price',
      roomTypeId: room!.id,
      rateId: base.id,
      from: base.nightlyPrice,
      to: 999,
      version: base.version,
    });

    expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
    const after = (await content.listRatesContent(room!.id)).find((rate) => rate.id === base.id)!;
    expect(after.nightlyPrice).toBe(999);
    expect(after.name).toBe(base.name);
  });

  it('reports a conflict when the rate changed between the proposal and the apply', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const [room] = await content.listRoomsContent();
    const asked = await service.ask({ draft: null, history: [], utterance: `set ${room!.name} to 500 a night` });
    if (asked.outcome !== 'proposal' || asked.proposal.kind !== 'set_rate_price') throw new Error('expected a rate proposal');

    // Someone else saves first.
    await service.apply({ ...asked.proposal, to: 450 });

    expect(await service.apply(asked.proposal)).toEqual({ ok: false, reason: 'conflict' });
  });

  it('proposes hiding a room type and applies it', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const [room] = await content.listRoomsContent();
    const asked = await service.ask({ draft: null, history: [], utterance: `hide ${room!.name}` });
    expect(asked.outcome).toBe('proposal');
    if (asked.outcome !== 'proposal') return;
    expect(asked.proposal).toMatchObject({ kind: 'set_room_hidden', roomTypeId: room!.id, hidden: true });

    expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
    expect((await content.getRoomContent(room!.id))!.hidden).toBe(true);
  });

  it('proposes an availability override with what is currently set, and applies it through the demo control', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const [room] = await content.listRoomsContent();
    const asked = await service.ask({ draft: null, history: [], utterance: `mark ${room!.name} sold out` });
    if (asked.outcome !== 'proposal') throw new Error('expected a proposal');
    expect(asked.proposal).toMatchObject({ kind: 'set_room_status', roomTypeId: room!.id, status: 'sold_out', current: null });

    expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
    expect(await mockDemoControlPort.getRoomStatusOverride(room!.id)).toBe('sold_out');

    const again = await service.ask({ draft: null, history: [], utterance: `clear the override on ${room!.name}` });
    if (again.outcome !== 'proposal') throw new Error('expected a proposal');
    expect(again.proposal).toMatchObject({ kind: 'set_room_status', status: null, current: 'sold_out' });
  });

  it('takes an add-on off sale', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const [addOn] = await content.listAddOnsContent();
    const asked = await service.ask({ draft: null, history: [], utterance: `take ${addOn!.name} off sale` });
    if (asked.outcome !== 'proposal') throw new Error('expected a proposal');
    expect(asked.proposal).toMatchObject({ kind: 'set_add_on_enabled', addOnId: addOn!.id, enabled: false });

    expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
    expect((await content.getAddOnContent(addOn!.id))!.enabled).toBe(false);
  });

  it('turns a page into a navigation proposal with the application’s own route', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const asked = await service.ask({ draft: null, history: [], utterance: 'open room rates' });
    expect(asked).toMatchObject({ outcome: 'proposal', proposal: { kind: 'navigate', page: 'rates', href: '/admin/rates' } });
  });

  it('asks which one when the words fit more than one room type', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, scripted({ action: 'set_room_hidden', target: 'sea view', hidden: true }));
    const asked = await service.ask({ draft: null, history: [], utterance: 'hide the sea view' });
    expect(asked.outcome).toBe('ambiguous');
    if (asked.outcome === 'ambiguous') expect(asked.candidates.length).toBeGreaterThan(1);
  });

  it('says so when nothing in the catalog matches, and when a value is missing', async () => {
    const [room] = await content.listRoomsContent();
    const missing = new AdminAssistantService(content, mockDemoControlPort, scripted({ action: 'set_room_hidden', target: 'Lighthouse Loft', hidden: true }));
    expect(await missing.ask({ draft: null, history: [], utterance: 'hide lighthouse loft' })).toMatchObject({ outcome: 'not_found', target: 'Lighthouse Loft' });

    const noPrice = new AdminAssistantService(content, mockDemoControlPort, scripted({ action: 'set_rate_price', target: room!.name, price: null }));
    expect(await noPrice.ask({ draft: null, history: [], utterance: 'change the rate' })).toMatchObject({ outcome: 'incomplete', action: 'set_rate_price' });
  });

  it('never invents a room the model names — an id in `target` resolves like any other words', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, scripted({ action: 'set_room_hidden', target: 'room-9999', hidden: true }));
    expect(await service.ask({ draft: null, history: [], utterance: 'hide room-9999' })).toMatchObject({ outcome: 'not_found' });
  });

  describe('creating a room type, as a conversation', () => {
    it('asks for each thing it still needs, in order, then proposes, creates it hidden, and carries on to a room for it', async () => {
      const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
      const turns: string[] = [];
      let draft: AdminDraft | null = null;
      let last = await service.ask({ utterance: 'create a room type and a room for it', draft, history: [] });

      for (const answer of ['Harbour Loft', 'A loft over the harbour, all glass.', '3', '42 m²', 'sleeps 2', 'king', 'sea']) {
        expect(last.outcome).toBe('question');
        if (last.outcome !== 'question') return;
        turns.push(last.field);
        draft = last.draft;
        last = await service.ask({ utterance: answer, draft, history: [] });
      }
      expect(turns).toEqual(['name', 'description', 'floor', 'areaM2', 'capacity', 'bedType', 'view']);

      expect(last.outcome).toBe('proposal');
      if (last.outcome !== 'proposal' || last.proposal.kind !== 'create_room_type') throw new Error('expected a room-type proposal');
      expect(last.proposal).toMatchObject({
        thenRoom: true,
        input: { name: 'Harbour Loft', slug: 'harbour-loft', floor: 3, areaM2: 42, capacity: 2, bedType: 'king', view: 'sea' },
      });

      const applied = await service.apply(last.proposal);
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      const followUp = applied.followUp;
      expect(followUp).toMatchObject({ kind: 'create_physical_room', roomTypeName: 'Harbour Loft' });
      if (followUp?.kind !== 'create_physical_room') return;
      const created = (await content.listRoomsContent()).find((room) => room.slug === 'harbour-loft');
      expect(created).toMatchObject({ name: 'Harbour Loft', hidden: true, floor: 3 });

      // "yes" takes the suggested number; the room lands under the new type.
      const asked = await service.ask({ utterance: 'yes', draft: followUp, history: [] });
      expect(asked.outcome).toBe('proposal');
      if (asked.outcome !== 'proposal' || asked.proposal.kind !== 'create_physical_room') throw new Error('expected a room proposal');
      const { number } = asked.proposal;
      expect(number).toBe(followUp.suggestedNumber);
      expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
      const rooms = await content.listPhysicalRoomsContent();
      expect(rooms.some((room) => room.roomTypeId === created!.id && room.number === number)).toBe(true);
    });

    it('takes every detail given in one breath and only asks for the rest', async () => {
      const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
      const first = await service.ask({ utterance: 'new room type called "Cove Studio" on the ground floor, 28 m², sleeps 2, queen bed, pool view', draft: null, history: [] });
      expect(first).toMatchObject({ outcome: 'question', field: 'description' });
    });

    it('asks a numeric question again when the answer is not a usable number', async () => {
      const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
      const draft: AdminDraft = { kind: 'create_room_type', fields: { ...emptyRoomTypeDraft, name: 'x', description: 'y' }, thenRoom: false };
      const result = await service.ask({ utterance: 'somewhere high up', draft, history: [] });
      expect(result).toMatchObject({ outcome: 'question', field: 'floor' });
    });

    it('drops the draft on "cancel"', async () => {
      const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
      const draft: AdminDraft = { kind: 'create_room_type', fields: { ...emptyRoomTypeDraft, name: 'x' }, thenRoom: false };
      expect(await service.ask({ utterance: 'cancel', draft, history: [] })).toMatchObject({ outcome: 'cancelled' });
    });

    it('refuses a second room type at the same page address, in the CMS’s own words', async () => {
      const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
      const [existing] = await content.listRoomsContent();
      const proposal = {
        kind: 'create_room_type' as const,
        input: { name: existing!.name, slug: existing!.slug, description: 'dup', floor: 1, areaM2: 20, capacity: 2, bedType: 'king' as const, view: 'sea' as const },
        thenRoom: false,
      };
      expect(await service.apply(proposal)).toMatchObject({ ok: false, reason: 'validation', message: 'That page address is already in use.' });
    });
  });

  it('adds a room to an existing type from one request, with the number as said', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const [room] = await content.listRoomsContent();
    const asked = await service.ask({ utterance: `add room ${room!.floor}91 to ${room!.name}`, draft: null, history: [] });
    expect(asked).toMatchObject({ outcome: 'proposal', proposal: { kind: 'create_physical_room', roomTypeId: room!.id, number: `${room!.floor}91` } });
  });

  it('creates a new rate only after all its commercial terms are confirmed', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const [room] = await content.listRoomsContent();
    let draft: AdminDraft | null = null;
    let asked = await service.ask({ utterance: 'create a rate', draft, history: [] });
    for (const answer of [room!.name, 'Flexible direct', '275', 'yes', 'Free cancellation until 18:00']) {
      expect(asked.outcome).toBe('question');
      if (asked.outcome !== 'question') return;
      draft = asked.draft;
      asked = await service.ask({ utterance: answer, draft, history: [] });
    }
    expect(asked).toMatchObject({ outcome: 'proposal', proposal: { kind: 'create_rate', roomTypeId: room!.id, input: { name: 'Flexible direct', nightlyPrice: 275, breakfastIncluded: true } } });
    if (asked.outcome !== 'proposal' || asked.proposal.kind !== 'create_rate') return;
    expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
    expect((await content.listRatesContent(room!.id)).some((rate) => rate.name === 'Flexible direct' && rate.nightlyPrice === 275)).toBe(true);
  });

  it('creates a service after showing its complete proposal', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    let draft: AdminDraft | null = null;
    let asked = await service.ask({ utterance: 'create a service', draft, history: [] });
    for (const answer of ['Airport transfer', 'Private transfer from the airport.', 'service', '60', 'per stay']) {
      expect(asked.outcome).toBe('question');
      if (asked.outcome !== 'question') return;
      draft = asked.draft;
      asked = await service.ask({ utterance: answer, draft, history: [] });
    }
    expect(asked).toMatchObject({ outcome: 'question', field: 'photos' });
    if (asked.outcome !== 'question' || asked.draft.kind !== 'create_add_on') return;
    asked = service.reviewAddOn({ ...asked.draft.fields, photos: [] });
    expect(asked).toMatchObject({ outcome: 'question', field: 'enabled' });
    if (asked.outcome !== 'question') return;
    asked = await service.ask({ utterance: 'on sale', draft: asked.draft, history: [] });
    expect(asked).toMatchObject({ outcome: 'proposal', proposal: { kind: 'create_add_on', input: { name: 'Airport transfer', category: 'service', price: 60, pricingUnit: 'per_stay', photos: [], enabled: true } } });
    if (asked.outcome !== 'proposal' || asked.proposal.kind !== 'create_add_on') return;
    expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
    expect((await content.listAddOnsContent()).some((addOn) => addOn.name === 'Airport transfer' && addOn.enabled)).toBe(true);
  });

  it('saves selected photos in cover order and respects the hidden choice only after apply', async () => {
    const assets = ['cover', 'detail'].map((name) => ({ url: `/images/${name}.webp`, filename: `${name}.webp`, folder: 'services', width: 1200, height: 800, bytes: 1024 }));
    const media: MediaLibraryPort = { list: () => assets, find: (url) => assets.find((asset) => asset.url === url) };
    const serviceContent = makeContent(media);
    const service = new AdminAssistantService(serviceContent, mockDemoControlPort, keywordAdminInterpreter);
    const before = (await serviceContent.listAddOnsContent()).length;
    const fields = { name: 'Private tour', description: 'Two-hour guided tour.', category: 'service' as const, price: 80, pricingUnit: 'per_guest' as const, photos: assets.map((asset) => asset.url), enabled: null };
    const step = service.reviewAddOn(fields);
    expect(step).toMatchObject({ outcome: 'question', field: 'enabled' });
    if (step.outcome !== 'question') return;
    const asked = await service.ask({ utterance: 'hidden', draft: step.draft, history: [] });
    expect(asked.outcome).toBe('proposal');
    if (asked.outcome !== 'proposal') return;
    expect((await serviceContent.listAddOnsContent()).length).toBe(before);
    expect(await service.apply(asked.proposal)).toEqual({ ok: true, followUp: null });
    const saved = (await serviceContent.listAddOnsContent()).find((item) => item.name === fields.name)!;
    expect(saved.enabled).toBe(false);
    expect(saved.photos?.map((photo) => photo.url)).toEqual(fields.photos);
    expect(saved.photos?.[0]?.width).toBe(1200);
  });

  it('rejects unknown photos at apply without creating the service', async () => {
    const service = new AdminAssistantService(content, mockDemoControlPort, keywordAdminInterpreter);
    const before = (await content.listAddOnsContent()).length;
    const result = await service.apply({ kind: 'create_add_on', input: { name: 'Tour', description: 'Guided tour', category: 'service', price: 10, pricingUnit: 'per_stay', photos: ['/images/missing.webp'], enabled: true } });
    expect(result).toMatchObject({ ok: false, reason: 'validation' });
    expect((await content.listAddOnsContent()).length).toBe(before);
  });

  it('does not accept invented media from the interpreter or skip the photo question with text', async () => {
    const fields = { ...emptyAddOnDraft, name: 'Tour', description: 'Guided tour', category: 'service' as const, price: 10, pricingUnit: 'per_stay' as const, photos: ['/images/invented.webp'], enabled: true };
    const service = new AdminAssistantService(content, mockDemoControlPort, scripted({ action: 'create_add_on', addOn: fields }));
    const result = await service.ask({ utterance: 'create a service', draft: null, history: [] });
    expect(result).toMatchObject({ outcome: 'question', field: 'photos', draft: { fields: { photos: null } } });
    if (result.outcome !== 'question') return;
    expect(await service.ask({ utterance: 'yes', draft: result.draft, history: [] })).toMatchObject({ outcome: 'question', field: 'photos', usedInterpreter: false });
  });

  it('validates required service details and the photo limit at the wizard boundary', () => {
    expect(addOnDraftSchema.safeParse({ ...emptyAddOnDraft, name: '  ' }).success).toBe(false);
    expect(addOnDraftSchema.safeParse({ ...emptyAddOnDraft, price: 0 }).success).toBe(false);
    const input = { name: 'Tour', description: 'Guided tour', category: 'service', price: 10, pricingUnit: 'per_stay', photos: Array(31).fill('/images/photo.webp'), enabled: true };
    expect(adminProposalSchema.safeParse({ kind: 'create_add_on', input }).success).toBe(false);
  });
});
