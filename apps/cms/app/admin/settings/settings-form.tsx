'use client';
import { useActionState } from 'react';
import { saveBookingLink } from './actions';
import { pill, fieldClass } from '@/lib/ui';

export function BookingLinkForm({ initialUrl }: { initialUrl: string }) {
  const [state, action, pending] = useActionState(saveBookingLink, '');
  return <form action={action} className="grid gap-4">
    <label htmlFor="booking-url" className="text-sm">External booking URL</label>
    <input id="booking-url" name="bookingUrl" type="url" defaultValue={initialUrl} placeholder="https://booking.example.com" className={fieldClass} />
    <p className="text-sm text-muted-foreground">Leave empty to show the room catalog without a booking button. Prices shown in Guest are reference prices; availability is checked by your booking provider.</p>
    {state && <p role="status" className="text-sm">{state}</p>}
    <button type="submit" className={pill('primary')} disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
  </form>;
}
