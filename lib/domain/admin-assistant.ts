import { z } from 'zod';
import type { AdminCommand } from './ports';
import { currencySchema, roomStatusSchema, roomTypeSchema } from './schemas';

/**
 * Everything the admin assistant can be asked to do. Deliberately short: each
 * one maps to a mutator `content-service.ts` or the `DemoControlPort` already
 * has, so the assistant never gains a write path of its own — see
 * TECH.md › "AI concierge" › "Admin assistant".
 */
export const adminCommandActions = [
  'set_rate_price',
  'set_room_hidden',
  'set_room_status',
  'set_add_on_enabled',
  'create_room_type',
  'create_physical_room',
  'navigate',
  'unknown',
] as const;
export type AdminCommandAction = (typeof adminCommandActions)[number];

/** The screens "open …" can land on. Keys, not hrefs: the route map is the application's, not the model's. */
export const adminPages = [
  'dashboard',
  'front-desk',
  'reservations',
  'services',
  'rates',
  'accounting',
  'channel-manager',
  'rooms',
  'hotel-settings',
  'orbit',
  'frames',
  'markup',
] as const;
export type AdminPage = (typeof adminPages)[number];

/**
 * What a new room type needs before it can be created, in the order the
 * assistant asks for them when the admin has not said. Amenities and photos
 * are not here on purpose: a type is created hidden, and those are added on
 * its own CMS page before it is shown — see `ContentService.setRoomHidden`.
 */
export const roomTypeDraftFields = ['name', 'description', 'floor', 'areaM2', 'capacity', 'bedType', 'view'] as const;
export type RoomTypeDraftField = (typeof roomTypeDraftFields)[number];

/** Every field nullable: "not said yet". Filled in over a conversation, one answer at a time or all at once. */
export const roomTypeDraftSchema = z.object({
  name: z.string().nullable(),
  description: z.string().nullable(),
  floor: z.number().nullable(),
  areaM2: z.number().nullable(),
  capacity: z.number().nullable(),
  bedType: roomTypeSchema.shape.bedType.nullable(),
  view: roomTypeSchema.shape.view.nullable(),
});
export type RoomTypeDraft = z.infer<typeof roomTypeDraftSchema>;

export const emptyRoomTypeDraft: RoomTypeDraft = {
  name: null,
  description: null,
  floor: null,
  areaM2: null,
  capacity: null,
  bedType: null,
  view: null,
};

/**
 * The wire contract for the OpenAI interpreter. Every field is required and
 * nullable rather than optional, for the same reason `assistant.ts` does it:
 * OpenAI's strict Structured Outputs mode requires every property in
 * `required`, so "the admin didn't say" is spelled `null`, not a missing key.
 * `target` is copied as the admin said it — the application resolves it
 * against the live catalog; the model never sees, and never emits, an id.
 */
export const adminCommandWireSchema = z.object({
  action: z.enum(adminCommandActions),
  /** The room type or add-on the admin named, verbatim. */
  target: z.string().nullable(),
  price: z.number().nullable(),
  hidden: z.boolean().nullable(),
  status: z.union([roomStatusSchema, z.literal('auto')]).nullable(),
  enabled: z.boolean().nullable(),
  page: z.enum(adminPages).nullable(),
  /** For `create_room_type`: whatever the request gave, the rest null. */
  roomType: roomTypeDraftSchema,
  /** For `create_physical_room`: the number as the admin said it. */
  roomNumber: z.string().nullable(),
  /** The admin asked for a room type *and* a room for it in one breath. */
  alsoRoom: z.boolean().nullable(),
  /** Phrases the model understood but the actions above cannot express. */
  unresolved: z.array(z.string()),
});

export type AdminCommandWire = z.infer<typeof adminCommandWireSchema>;

/** Same derivation as `assistantIntentJsonSchema`: one Zod source for both directions. */
export function adminCommandJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(adminCommandWireSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** The wire shape is already the domain shape — kept as a function so the two can diverge later without touching callers. */
export function toAdminCommand(wire: AdminCommandWire): AdminCommand {
  return wire;
}

/**
 * Where a conversation stands between two messages: the thing being set up
 * and what has been said about it so far. Held by the panel and sent back
 * with the next message, so the server keeps no session — and parsed on the
 * way in, since by then it is a client-supplied value.
 */
export const adminDraftSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('create_room_type'),
    fields: roomTypeDraftSchema,
    /** Go straight on to a room for it once it exists. */
    thenRoom: z.boolean(),
  }),
  z.object({
    kind: z.literal('create_physical_room'),
    roomTypeId: z.string().min(1),
    roomTypeName: z.string(),
    /** The next free number on the type's floor, offered so "yes" is an answer. */
    suggestedNumber: z.string().nullable(),
  }),
]);
export type AdminDraft = z.infer<typeof adminDraftSchema>;

/**
 * What the assistant proposes to change, shown to the admin before anything
 * is written and sent back verbatim to apply. Parsed on the way back in
 * (`adminProposalSchema`) because it round-trips through the browser: a
 * proposal is a client-supplied value by the time `apply` sees it.
 */
export const adminProposalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('set_rate_price'),
    roomTypeId: z.string().min(1),
    roomTypeName: z.string(),
    rateId: z.string().min(1),
    rateName: z.string(),
    currency: currencySchema,
    from: z.number(),
    to: z.number().positive(),
    version: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('set_room_hidden'),
    roomTypeId: z.string().min(1),
    roomTypeName: z.string(),
    hidden: z.boolean(),
    version: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('set_room_status'),
    roomTypeId: z.string().min(1),
    roomTypeName: z.string(),
    /** `null` clears the override — back to what availability itself says. */
    status: roomStatusSchema.nullable(),
    current: roomStatusSchema.nullable(),
  }),
  z.object({
    kind: z.literal('set_add_on_enabled'),
    addOnId: z.string().min(1),
    addOnName: z.string(),
    enabled: z.boolean(),
  }),
  z.object({
    kind: z.literal('create_room_type'),
    input: z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().min(1),
      floor: z.number().int().nonnegative(),
      areaM2: z.number().positive(),
      capacity: z.number().int().positive(),
      bedType: roomTypeSchema.shape.bedType,
      view: roomTypeSchema.shape.view,
    }),
    thenRoom: z.boolean(),
  }),
  z.object({
    kind: z.literal('create_physical_room'),
    roomTypeId: z.string().min(1),
    roomTypeName: z.string(),
    number: z.string().min(1),
  }),
  z.object({
    kind: z.literal('navigate'),
    page: z.enum(adminPages),
    href: z.string().startsWith('/admin'),
    label: z.string(),
  }),
]);

export type AdminProposal = z.infer<typeof adminProposalSchema>;
