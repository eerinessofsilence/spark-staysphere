import { addDays, parseISO } from 'date-fns';
import type { RoomSearchInterpreter } from '../domain/ports';
import { roomCategories } from '../domain/room-attributes';
import type { RoomOffer, StayCriteria } from '../domain/schemas';
import {
  CatalogService,
  defaultRoomFilters,
  type CatalogFacets,
  type RoomFilters,
} from './catalog-service';
import {
  buildQuery,
  clampAdults,
  clampChildren,
  isIsoDate,
  roomBedTypes,
  roomViews,
  toIsoDate,
} from './search-params';

/** Server-side ceiling; the panel also caps the textarea, but the API is the boundary that matters. */
export const MAX_UTTERANCE_LENGTH = 400;

export type AssistantErrorCode = 'invalid_request' | 'interpreter_unavailable' | 'transcription_unavailable';

/** A failure the panel is expected to render as its `error`/`no key` state, not a crash. */
export class AssistantError extends Error {
  constructor(
    readonly code: AssistantErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

export interface AssistantAskInput {
  hotelSlug: string;
  /** The guest's own words. Empty re-runs `criteria`/`filters` with no interpretation — how a
   * removed chip re-searches without a model call. */
  utterance: string;
  criteria: StayCriteria;
  filters: RoomFilters;
}

export interface AssistantRelaxation {
  /** "Drop the €400 cap" — the one constraint whose removal alone returns results. */
  label: string;
  filters: RoomFilters;
  query: string;
}

export interface AssistantAskResult {
  criteria: StayCriteria;
  filters: RoomFilters;
  offers: RoomOffer[];
  totalRooms: number;
  availableRooms: number;
  /** Phrases the interpreter understood but the catalog has no filter for. Empty for a bare re-search. */
  unresolved: string[];
  /** The handoff link into `/rooms`, carrying the interpreted stay and filters. */
  query: string;
  /** Present only when the search came back empty, so the panel can offer one way out. */
  relaxation: AssistantRelaxation | null;
  /** True once results are keyed to something the guest actually said or chose. */
  usedInterpreter: boolean;
}

/**
 * Merges the model's `checkIn`/`checkOut` onto the guest's current stay
 * without ever producing a past date or a non-positive range — the one place
 * `AssistantService` is allowed to touch dates, since every other rule in
 * this function borrows `clampAdults`/`clampChildren`/`isIsoDate` from
 * `search-params.ts` rather than restating them.
 */
function sanitiseCriteria(
  intentCriteria: Partial<StayCriteria>,
  current: StayCriteria,
  today: string,
): StayCriteria {
  const checkIn =
    isIsoDate(intentCriteria.checkIn) && intentCriteria.checkIn >= today
      ? intentCriteria.checkIn
      : current.checkIn;
  const checkOutCandidate =
    isIsoDate(intentCriteria.checkOut) && intentCriteria.checkOut >= today
      ? intentCriteria.checkOut
      : current.checkOut;
  const checkOut = checkOutCandidate > checkIn ? checkOutCandidate : toIsoDate(addDays(parseISO(checkIn), 1));

  return {
    checkIn,
    checkOut,
    adults: typeof intentCriteria.adults === 'number' ? clampAdults(intentCriteria.adults) : current.adults,
    children:
      typeof intentCriteria.children === 'number' ? clampChildren(intentCriteria.children) : current.children,
  };
}

/**
 * Intersects every enum and every amenity the model produced against the
 * catalog's own vocabulary before it ever reaches `CatalogService.search`.
 * A hallucinated view, bed type, category or amenity is dropped here, not
 * shown, and not queried — the guarantee `CLAUDE.md` and the assistant brief
 * both ask for.
 */
function sanitiseFilters(
  intentFilters: Partial<RoomFilters>,
  current: RoomFilters,
  facets: CatalogFacets,
): RoomFilters {
  const amenitySet = new Set(facets.amenities);
  const categorySet = new Set(roomCategories);

  return {
    ...current,
    minPrice: typeof intentFilters.minPrice === 'number' ? Math.max(0, intentFilters.minPrice) : current.minPrice,
    maxPrice: typeof intentFilters.maxPrice === 'number' ? Math.max(0, intentFilters.maxPrice) : current.maxPrice,
    views: intentFilters.views?.length
      ? intentFilters.views.filter((view) => roomViews.includes(view))
      : current.views,
    bedTypes: intentFilters.bedTypes?.length
      ? intentFilters.bedTypes.filter((bed) => roomBedTypes.includes(bed))
      : current.bedTypes,
    categories: intentFilters.categories?.length
      ? intentFilters.categories.filter((category) => categorySet.has(category))
      : current.categories,
    amenities: intentFilters.amenities?.length
      ? intentFilters.amenities.filter((amenity) => amenitySet.has(amenity))
      : current.amenities,
  };
}

/** One label per relaxable filter, in the order they are tried. */
function relaxationCandidates(filters: RoomFilters): { label: string; next: RoomFilters }[] {
  const candidates: { label: string; next: RoomFilters }[] = [];
  if (filters.maxPrice !== null) {
    candidates.push({ label: `Drop the €${filters.maxPrice} cap`, next: { ...filters, maxPrice: null } });
  }
  if (filters.views.length) {
    candidates.push({ label: 'Include every view', next: { ...filters, views: [] } });
  }
  if (filters.bedTypes.length) {
    candidates.push({ label: 'Include every bed type', next: { ...filters, bedTypes: [] } });
  }
  if (filters.categories.length) {
    candidates.push({ label: 'Include every room type', next: { ...filters, categories: [] } });
  }
  if (filters.amenities.length) {
    candidates.push({
      label: filters.amenities.length === 1 ? `Drop "${filters.amenities[0]}"` : 'Drop the amenity filters',
      next: { ...filters, amenities: [] },
    });
  }
  if (filters.minArea !== null) {
    candidates.push({ label: 'Drop the minimum size', next: { ...filters, minArea: null } });
  }
  if (filters.minFloor !== null) {
    candidates.push({ label: 'Include lower floors', next: { ...filters, minFloor: null } });
  }
  if (!filters.includeSoldOut) {
    candidates.push({ label: 'Include fully booked rooms', next: { ...filters, includeSoldOut: true } });
  }
  return candidates;
}

export class AssistantService {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly interpreter: RoomSearchInterpreter,
  ) {}

  async ask(input: AssistantAskInput): Promise<AssistantAskResult> {
    const utterance = input.utterance.trim().slice(0, MAX_UTTERANCE_LENGTH);

    // 1. Facets: an unfiltered search is the only place `CatalogFacets` comes
    // from, and it is the entire vocabulary the interpreter — and the
    // sanitiser after it — are allowed to use.
    const facetsResult = await this.catalogService.search(
      input.hotelSlug,
      input.criteria,
      defaultRoomFilters,
    );

    let criteria = input.criteria;
    let filters = input.filters;
    let unresolved: string[] = [];
    let usedInterpreter = false;

    if (utterance) {
      const today = toIsoDate(new Date());
      const intent = await this.interpreter.interpret({
        utterance,
        today,
        current: input.criteria,
        facets: facetsResult.facets,
      });

      criteria = sanitiseCriteria(intent.criteria, input.criteria, today);
      filters = sanitiseFilters(intent.filters, input.filters, facetsResult.facets);
      unresolved = intent.unresolved;
      usedInterpreter = true;
    }

    const result = await this.catalogService.search(input.hotelSlug, criteria, filters);
    const relaxation = result.offers.length === 0 ? await this.findRelaxation(input.hotelSlug, criteria, filters) : null;

    return {
      criteria,
      filters,
      offers: result.offers,
      totalRooms: result.totalRooms,
      availableRooms: result.availableRooms,
      unresolved,
      query: buildQuery({ criteria, filters }),
      relaxation,
      usedInterpreter,
    };
  }

  /** Tries dropping one active filter at a time; the first that unblocks results is offered. */
  private async findRelaxation(
    hotelSlug: string,
    criteria: StayCriteria,
    filters: RoomFilters,
  ): Promise<AssistantRelaxation | null> {
    for (const candidate of relaxationCandidates(filters)) {
      const result = await this.catalogService.search(hotelSlug, criteria, candidate.next);
      if (result.offers.length > 0) {
        return {
          label: candidate.label,
          filters: candidate.next,
          query: buildQuery({ criteria, filters: candidate.next }),
        };
      }
    }
    return null;
  }
}
