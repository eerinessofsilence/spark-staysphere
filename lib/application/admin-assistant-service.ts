import {
  emptyRoomTypeDraft,
  roomTypeDraftFields,
  type AdminCommandAction,
  type AdminDraft,
  type AdminPage,
  type AdminProposal,
  type RoomTypeDraft,
  type RoomTypeDraftField,
} from '../domain/admin-assistant';
import type { AdminChatTurn, AdminCommand, AdminCommandInterpreter, DemoControlPort } from '../domain/ports';
import { kebabSuggestion } from '../domain/slug';
import { MAX_UTTERANCE_LENGTH } from './assistant-service';
import type { ContentError, ContentService } from './content-service';

/**
 * The admin's own concierge, as a conversation: a typed request ("set the
 * Deluxe Sea View rate to 320", "hide Garden Studio", "create a room type
 * and a room for it", "open room rates") becomes either a question — when
 * something is still needed — or a *proposal*: what would change, from what,
 * to what, which the admin confirms before anything is written. The guest
 * assistant's rule holds here with one more clause: the model interprets
 * language, it never produces inventory, availability, or money, **and it
 * never writes**. `ask` only reads; `apply` is a separate call the panel
 * makes on the admin's click, through the same `ContentService` /
 * `DemoControlPort` mutators every admin form uses, with the same
 * optimistic-concurrency version the form would have sent.
 *
 * The conversation's state is a `draft` the panel holds and sends back with
 * each message (see `lib/domain/admin-assistant.ts`) — the server keeps no
 * session, so this works the same across isolates and reloads.
 *
 * Bound to the CMS's own hotel (`ContentService` is constructed on
 * `DEMO_HOTEL_SLUG`), so a proposal always describes the catalog `apply`
 * will touch — the same scoping `/admin/rates` documents for its writes.
 */

/** Where "open …" lands. Application-owned: the model only ever names a page key. */
export const ADMIN_PAGE_ROUTES: Record<AdminPage, { href: string; label: string }> = {
  dashboard: { href: '/admin', label: 'Dashboard' },
  'front-desk': { href: '/admin/front-desk', label: 'Front Desk' },
  housekeeping: { href: '/admin/housekeeping', label: 'Housekeeping' },
  reservations: { href: '/admin/bookings', label: 'Reservations' },
  services: { href: '/admin/content/add-ons', label: 'Services' },
  rates: { href: '/admin/rates', label: 'Room Rates' },
  accounting: { href: '/admin/accounting', label: 'Accounting' },
  'channel-manager': { href: '/admin/channel-manager', label: 'Channel Manager' },
  rooms: { href: '/admin/content', label: 'Rooms' },
  'hotel-settings': { href: '/admin/content/hotel', label: 'Hotel Settings' },
  orbit: { href: '/admin/content/spinner', label: '360 Orbit' },
  frames: { href: '/admin/content/spinner/frames', label: 'Frames & key angles' },
  markup: { href: '/admin/content/spinner/markup', label: 'Markup' },
};

export interface AdminChatInput {
  utterance: string;
  draft: AdminDraft | null;
  history: AdminChatTurn[];
}

export type AdminAskOutcome =
  | { outcome: 'proposal'; proposal: AdminProposal; unresolved: string[] }
  /** Something is still needed; the draft carries what has been gathered so far. */
  | { outcome: 'question'; draft: AdminDraft; field: RoomTypeDraftField | 'number' }
  | { outcome: 'cancelled' }
  /** The words matched more than one thing; the names are the catalog's, for the panel to offer. */
  | { outcome: 'ambiguous'; target: string; candidates: string[] }
  | { outcome: 'not_found'; target: string }
  /** The action was clear but a value it needs was not — a price, a name. */
  | { outcome: 'incomplete'; action: Exclude<AdminCommandAction, 'unknown' | 'navigate' | 'create_room_type'> }
  | { outcome: 'no_rate'; roomTypeName: string }
  | { outcome: 'unknown'; unresolved: string[] };

export type AdminAskResult = AdminAskOutcome & { usedInterpreter: boolean };

export type AdminApplyResult =
  /** `followUp`: the conversation carries straight on — a room for the type just created. */
  | { ok: true; followUp: AdminDraft | null }
  | { ok: false; reason: 'conflict' | 'not_found' }
  /** In the CMS's own words — the app's copy, never the model's. */
  | { ok: false; reason: 'validation' | 'rule' | 'forbidden'; message: string };

type Match<T> = { kind: 'one'; item: T } | { kind: 'none' } | { kind: 'many'; candidates: T[] };

const CANCEL = /^\s*(no|nope|cancel|stop|never ?mind|forget it|leave it|drop it)\b/i;
const AFFIRMATIVE = /^\s*(yes|yes please|yep|yeah|ok|okay|sure|fine|that one|go ahead|do it)\b/i;

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantWords(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((word) => word.length >= 3);
}

/**
 * The admin's words against the catalog's names: an exact name first, then a
 * name that contains the words (or the words that contain a name), then any
 * name that has every significant word the admin used, in any order. All of
 * them, not most: one shared word like "room" or "loft" would otherwise make
 * a name nobody has ("Lighthouse Loft") look like a near-miss for half the
 * catalog. A tie stays a tie — the panel asks, rather than the service
 * guessing between "Deluxe Sea View" and "Sea View Room".
 */
export function matchByName<T extends { name: string }>(target: string, items: T[]): Match<T> {
  const wanted = normalise(target);
  if (!wanted) return { kind: 'none' };

  const exact = items.filter((item) => normalise(item.name) === wanted);
  if (exact.length === 1) return { kind: 'one', item: exact[0]! };
  if (exact.length > 1) return { kind: 'many', candidates: exact };

  const containing = items.filter((item) => {
    const name = normalise(item.name);
    return name.includes(wanted) || wanted.includes(name);
  });
  if (containing.length === 1) return { kind: 'one', item: containing[0]! };
  if (containing.length > 1) return { kind: 'many', candidates: containing };

  const words = significantWords(target);
  if (words.length === 0) return { kind: 'none' };
  const covering = items.filter((item) => {
    const own = new Set(significantWords(item.name));
    return words.every((word) => own.has(word));
  });
  if (covering.length === 1) return { kind: 'one', item: covering[0]! };
  if (covering.length > 1) return { kind: 'many', candidates: covering };
  return { kind: 'none' };
}

function failure(error: ContentError): AdminApplyResult {
  switch (error.kind) {
    case 'conflict':
      return { ok: false, reason: 'conflict' };
    case 'not_found':
      return { ok: false, reason: 'not_found' };
    case 'validation': {
      const first = Object.values(error.fieldErrors).flat()[0];
      return { ok: false, reason: 'validation', message: first ?? 'That value is not something the catalog accepts.' };
    }
    case 'rule':
      return { ok: false, reason: 'rule', message: error.message };
    case 'forbidden':
      return { ok: false, reason: 'forbidden', message: error.message };
  }
}

/** A number the field can take, or null so it is asked again — a "floor" of 2.5 or a size of 0 is not an answer. */
function validRoomTypeValue(field: RoomTypeDraftField, value: RoomTypeDraft[RoomTypeDraftField]): boolean {
  if (value === null) return false;
  switch (field) {
    case 'floor':
      return Number.isInteger(value) && (value as number) >= 0;
    case 'capacity':
      return Number.isInteger(value) && (value as number) > 0;
    case 'areaM2':
      return (value as number) > 0;
    case 'name':
    case 'description':
      return typeof value === 'string' && value.trim().length > 0;
    default:
      return true;
  }
}

/** What the interpreter gave for this message, over what the draft already had; nothing invalid gets in. */
function mergeRoomType(base: RoomTypeDraft, incoming: RoomTypeDraft): RoomTypeDraft {
  const merged: RoomTypeDraft = { ...base };
  for (const field of roomTypeDraftFields) {
    const value = incoming[field];
    if (value !== null && validRoomTypeValue(field, value)) merged[field] = value as never;
  }
  return merged;
}

export class AdminAssistantService {
  constructor(
    private readonly content: ContentService,
    private readonly demoControl: DemoControlPort,
    private readonly interpreter: AdminCommandInterpreter,
  ) {}

  async ask(input: AdminChatInput): Promise<AdminAskResult> {
    const utterance = input.utterance.trim().slice(0, MAX_UTTERANCE_LENGTH);
    if (!utterance) return { outcome: 'unknown', unresolved: [], usedInterpreter: false };
    if (input.draft && CANCEL.test(utterance)) return { outcome: 'cancelled', usedInterpreter: false };

    const [roomTypes, addOns] = await Promise.all([this.content.listRoomsContent(), this.content.listAddOnsContent()]);
    const command = await this.interpreter.interpret({
      utterance,
      vocabulary: { roomTypes: roomTypes.map((room) => room.name), addOns: addOns.map((addOn) => addOn.name) },
      draft: input.draft,
      history: input.history,
    });

    const outcome = await this.resolve(command, utterance, input.draft, roomTypes, addOns);
    return { ...outcome, usedInterpreter: true };
  }

  private async resolve(
    command: AdminCommand,
    utterance: string,
    draft: AdminDraft | null,
    roomTypes: Awaited<ReturnType<ContentService['listRoomsContent']>>,
    addOns: Awaited<ReturnType<ContentService['listAddOnsContent']>>,
  ): Promise<AdminAskOutcome> {
    // Mid-conversation, the reply feeds the open draft — unless the
    // interpreter read it as a different request, in which case that wins
    // and the draft is dropped, the way a person would change the subject.
    if (draft?.kind === 'create_room_type' && (command.action === 'create_room_type' || command.action === 'unknown')) {
      return this.roomTypeStep(mergeRoomType(draft.fields, command.roomType), draft.thenRoom);
    }
    if (draft?.kind === 'create_physical_room' && (command.action === 'create_physical_room' || command.action === 'unknown')) {
      const number = command.roomNumber ?? (AFFIRMATIVE.test(utterance) ? draft.suggestedNumber : null);
      if (!number) return { outcome: 'question', draft, field: 'number' };
      return {
        outcome: 'proposal',
        proposal: { kind: 'create_physical_room', roomTypeId: draft.roomTypeId, roomTypeName: draft.roomTypeName, number: number.toUpperCase() },
        unresolved: [],
      };
    }

    switch (command.action) {
      case 'navigate': {
        if (!command.page) return { outcome: 'unknown', unresolved: command.unresolved };
        const route = ADMIN_PAGE_ROUTES[command.page];
        return {
          outcome: 'proposal',
          proposal: { kind: 'navigate', page: command.page, href: route.href, label: route.label },
          unresolved: command.unresolved,
        };
      }

      case 'create_room_type':
        return this.roomTypeStep(mergeRoomType(emptyRoomTypeDraft, command.roomType), command.alsoRoom ?? false);

      case 'create_physical_room': {
        const room = this.pick('create_physical_room', command.target, roomTypes);
        if ('outcome' in room) return room;
        if (command.roomNumber) {
          return {
            outcome: 'proposal',
            proposal: { kind: 'create_physical_room', roomTypeId: room.id, roomTypeName: room.name, number: command.roomNumber.toUpperCase() },
            unresolved: command.unresolved,
          };
        }
        const suggestions = await this.content.suggestRoomNumbers();
        return {
          outcome: 'question',
          draft: { kind: 'create_physical_room', roomTypeId: room.id, roomTypeName: room.name, suggestedNumber: suggestions[room.id] ?? null },
          field: 'number',
        };
      }

      case 'set_rate_price': {
        if (command.price === null || !(command.price > 0)) return { outcome: 'incomplete', action: 'set_rate_price' };
        const room = this.pick('set_rate_price', command.target, roomTypes);
        if ('outcome' in room) return room;
        const rates = await this.content.listRatesContent(room.id);
        // The base rate: the cheapest, which is the one the rates screen edits inline too.
        const rate = [...rates].sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0];
        if (!rate) return { outcome: 'no_rate', roomTypeName: room.name };
        return {
          outcome: 'proposal',
          proposal: {
            kind: 'set_rate_price',
            roomTypeId: room.id,
            roomTypeName: room.name,
            rateId: rate.id,
            rateName: rate.name,
            currency: rate.currency,
            from: rate.nightlyPrice,
            to: command.price,
            version: rate.version,
          },
          unresolved: command.unresolved,
        };
      }

      case 'set_room_hidden': {
        if (command.hidden === null) return { outcome: 'incomplete', action: 'set_room_hidden' };
        const room = this.pick('set_room_hidden', command.target, roomTypes);
        if ('outcome' in room) return room;
        return {
          outcome: 'proposal',
          proposal: { kind: 'set_room_hidden', roomTypeId: room.id, roomTypeName: room.name, hidden: command.hidden, version: room.version },
          unresolved: command.unresolved,
        };
      }

      case 'set_room_status': {
        if (command.status === null) return { outcome: 'incomplete', action: 'set_room_status' };
        const room = this.pick('set_room_status', command.target, roomTypes);
        if ('outcome' in room) return room;
        const current = await this.demoControl.getRoomStatusOverride(room.id);
        return {
          outcome: 'proposal',
          proposal: {
            kind: 'set_room_status',
            roomTypeId: room.id,
            roomTypeName: room.name,
            status: command.status === 'auto' ? null : command.status,
            current,
          },
          unresolved: command.unresolved,
        };
      }

      case 'set_add_on_enabled': {
        if (command.enabled === null) return { outcome: 'incomplete', action: 'set_add_on_enabled' };
        const addOn = this.pick('set_add_on_enabled', command.target, addOns);
        if ('outcome' in addOn) return addOn;
        return {
          outcome: 'proposal',
          proposal: { kind: 'set_add_on_enabled', addOnId: addOn.id, addOnName: addOn.name, enabled: command.enabled },
          unresolved: command.unresolved,
        };
      }

      case 'unknown':
        return { outcome: 'unknown', unresolved: command.unresolved };
    }
  }

  /** The next question a new room type still needs answered — or, with everything known, the proposal. */
  private roomTypeStep(fields: RoomTypeDraft, thenRoom: boolean): AdminAskOutcome {
    const missing = roomTypeDraftFields.find((field) => fields[field] === null);
    if (missing) return { outcome: 'question', draft: { kind: 'create_room_type', fields, thenRoom }, field: missing };

    const name = fields.name!.trim();
    return {
      outcome: 'proposal',
      proposal: {
        kind: 'create_room_type',
        input: {
          name,
          slug: kebabSuggestion(name),
          description: fields.description!.trim(),
          floor: fields.floor!,
          areaM2: fields.areaM2!,
          capacity: fields.capacity!,
          bedType: fields.bedType!,
          view: fields.view!,
        },
        thenRoom,
      },
      unresolved: [],
    };
  }

  /** A named target, or the outcome that explains why there is not one. */
  private pick<T extends { name: string }>(
    action: Exclude<AdminCommandAction, 'unknown' | 'navigate' | 'create_room_type'>,
    target: string | null,
    items: T[],
  ): T | AdminAskOutcome {
    if (!target) return { outcome: 'incomplete', action };
    const match = matchByName(target, items);
    switch (match.kind) {
      case 'one':
        return match.item;
      case 'many':
        return { outcome: 'ambiguous', target, candidates: match.candidates.map((item) => item.name) };
      case 'none':
        return { outcome: 'not_found', target };
    }
  }

  /**
   * Writes what a proposal describes, through the same mutators the admin
   * forms use and with the version the proposal was read at — a change made
   * in between comes back as a conflict, exactly as it would from the form.
   */
  async apply(proposal: AdminProposal): Promise<AdminApplyResult> {
    switch (proposal.kind) {
      case 'navigate':
        return { ok: true, followUp: null };

      case 'set_rate_price': {
        const rate = (await this.content.listRatesContent(proposal.roomTypeId)).find((candidate) => candidate.id === proposal.rateId);
        if (!rate) return { ok: false, reason: 'not_found' };
        const result = await this.content.updateRate(
          proposal.rateId,
          {
            name: rate.name,
            nightlyPrice: proposal.to,
            otaComparisonPrice: rate.otaComparisonPrice,
            breakfastIncluded: rate.breakfastIncluded,
            includedServices: rate.includedServices,
            cancellationPolicy: rate.cancellationPolicy,
          },
          proposal.version,
          proposal.roomTypeId,
        );
        return result.ok ? { ok: true, followUp: null } : failure(result.error);
      }

      case 'set_room_hidden': {
        const result = await this.content.setRoomHidden(proposal.roomTypeId, proposal.hidden, proposal.version);
        return result.ok ? { ok: true, followUp: null } : failure(result.error);
      }

      case 'set_room_status':
        await this.demoControl.setRoomStatusOverride(proposal.roomTypeId, proposal.status);
        return { ok: true, followUp: null };

      case 'set_add_on_enabled': {
        const result = await this.content.setAddOnEnabled(proposal.addOnId, proposal.enabled);
        return result.ok ? { ok: true, followUp: null } : failure(result.error);
      }

      case 'create_room_type': {
        // Created hidden, without amenities, hotel facilities, or photos:
        // those are added on the type's own CMS page, and
        // `setRoomHidden(false)` insists on at least a photo.
        const result = await this.content.createRoom({ ...proposal.input, amenities: [], facilities: [], media: [] });
        if (!result.ok) return failure(result.error);
        if (!proposal.thenRoom) return { ok: true, followUp: null };
        const suggestions = await this.content.suggestRoomNumbers();
        return {
          ok: true,
          followUp: {
            kind: 'create_physical_room',
            roomTypeId: result.value.id,
            roomTypeName: proposal.input.name,
            suggestedNumber: suggestions[result.value.id] ?? null,
          },
        };
      }

      case 'create_physical_room': {
        const result = await this.content.createPhysicalRoom({ roomTypeId: proposal.roomTypeId, number: proposal.number });
        return result.ok ? { ok: true, followUp: null } : failure(result.error);
      }
    }
  }
}
