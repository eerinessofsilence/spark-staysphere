'use client';

import * as React from 'react';
import { quoteStay } from '@/app/rooms/actions';
import { buildQuery } from '@/lib/application/search-params';
import type { Quote, StayCriteria } from '@/lib/domain/schemas';

/**
 * The room page's reference estimate. Services are added and dropped here rather than
 * by navigating to the same route with a different `addOn` query: a navigation
 * puts the whole page behind `loading.tsx`, and a guest who taps "+" halfway
 * down the page gets it torn down and rebuilt from the top — on a phone, with
 * no scroll anchoring, that reads as being thrown back to the top of the page.
 *
 * The selection still lives in the URL so a shared link reproduces it, but
 * `replaceState` changes the address without reloading the gallery.
 *
 * The server estimates from CMS reference prices. Booking and availability
 * belong to the hotel's external booking engine.
 */
interface RoomPricingValue {
  bookingUrl?: string;
  quote: Quote;
  /** The guest's selection, shown before the server has finished repricing. */
  selected: string[];
  repricing: boolean;
  setAddOns: (next: string[]) => void;
}

const RoomPricingContext = React.createContext<RoomPricingValue | null>(null);

export function useRoomPricing(): RoomPricingValue {
  const value = React.useContext(RoomPricingContext);
  if (!value) throw new Error('useRoomPricing must be used inside <RoomPricing>');
  return value;
}

interface RoomPricingProps {
  bookingUrl?: string;
  roomSlug: string;
  criteria: StayCriteria;
  /** The quote the server rendered this page with. */
  quote: Quote;
  children: React.ReactNode;
}

export function RoomPricing({ roomSlug, criteria, quote: serverQuote, children, bookingUrl }: RoomPricingProps) {
  const [quote, setQuote] = React.useState(serverQuote);
  const [selected, setSelected] = React.useState(serverQuote.addOnIds);
  const [repricing, setRepricing] = React.useState(false);
  /** Only the newest reprice may land — answers can come back out of order. */
  const latestRequest = React.useRef(0);

  // A real navigation — new dates, or back to this page — re-renders the page
  // on the server, and that render is the truth again.
  const serverState = `${criteria.checkIn}|${criteria.checkOut}|${criteria.adults}|${criteria.children}|${serverQuote.addOnIds.join(',')}`;
  const lastServerState = React.useRef(serverState);
  if (lastServerState.current !== serverState) {
    lastServerState.current = serverState;
    latestRequest.current += 1;
    setQuote(serverQuote);
    setSelected(serverQuote.addOnIds);
    setRepricing(false);
  }

  const setAddOns = React.useCallback(
    (next: string[]) => {
      setSelected(next);
      setRepricing(true);
      const request = (latestRequest.current += 1);
      const roomNumber = new URLSearchParams(window.location.search).get('room');
      const query = buildQuery({ criteria, addOnIds: next, ...(roomNumber ? { roomNumber } : {}) });
      window.history.replaceState(window.history.state, '', `?${query}`);
      void quoteStay({
        roomSlug,
        checkIn: criteria.checkIn,
        checkOut: criteria.checkOut,
        adults: criteria.adults,
        children: criteria.children,
        addOnIds: next,
      }).then((result) => {
        if (request !== latestRequest.current) return;
        setRepricing(false);
        // A refused quote leaves the last good one on screen; the selection
        // the guest made is what the next attempt re-sends.
        if (result.ok) setQuote(result.quote);
      }).catch(() => {
        if (request === latestRequest.current) setRepricing(false);
      });
    },
    [criteria, roomSlug],
  );

  const value = React.useMemo(
    () => ({ quote, selected, repricing, setAddOns, bookingUrl }),
    [quote, selected, repricing, setAddOns, bookingUrl],
  );

  return <RoomPricingContext.Provider value={value}>{children}</RoomPricingContext.Provider>;
}
