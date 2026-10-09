'use client';

import { useEffect, useRef } from 'react';
import { selectHotelAction } from './action';

export function AutoSelectHotel({ hotelId, label }: { hotelId: string; label: string }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => form.current?.requestSubmit(), []);
  return <form ref={form} action={selectHotelAction} className="mx-auto grid min-h-48 place-items-center text-sm text-muted-foreground">
    <input type="hidden" name="hotelId" value={hotelId} />
    <button type="submit">{label}</button>
  </form>;
}
