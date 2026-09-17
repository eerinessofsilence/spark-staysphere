import type { CSSProperties } from 'react';

export const WINDOW_OPTIONS = [7, 14, 30] as const;
export const DEFAULT_WINDOW = 14;
/** A custom range's cap — past this the grid's per-room-type allocation math gets slow to compute on read. */
export const MAX_CUSTOM_WINDOW = 90;

export interface FrontDeskQuery {
  from: string;
  days: number;
  type: string | null;
}

export function frontDeskHref({ from, days, type }: FrontDeskQuery): string {
  const params = new URLSearchParams({ from, days: String(days) });
  if (type) params.set('type', type);
  return `/admin/front-desk?${params.toString()}`;
}

/** A hatch for rooms that can't be sold — the one place a pattern means "unavailable". */
export const unavailablePattern: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in oklab, var(--danger) 18%, transparent) 0 1.5px, transparent 1.5px 6px)',
};

export type StayStatus = 'confirmed' | 'due_in' | 'in_house' | 'due_out' | 'checked_out';

/** Where a stay is relative to today, the way a PMS tape chart colours it. */
export function stayStatus(checkIn: string, checkOut: string, today: string): StayStatus {
  if (checkOut === today) return 'due_out';
  if (checkOut < today) return 'checked_out';
  if (checkIn === today) return 'due_in';
  if (checkIn < today) return 'in_house';
  return 'confirmed';
}

export const stayStatusMeta: Record<StayStatus, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-stay-confirmed text-stay-confirmed-ink' },
  due_in: { label: 'Due in', className: 'bg-stay-due-in text-white' },
  in_house: { label: 'In house', className: 'bg-stay-in-house text-white' },
  due_out: { label: 'Due out', className: 'bg-stay-due-out text-white' },
  checked_out: { label: 'Checked out', className: 'bg-stay-checked-out text-stay-checked-out-ink' },
};

export const stayStatusOrder: StayStatus[] = ['confirmed', 'due_in', 'in_house', 'due_out', 'checked_out'];
