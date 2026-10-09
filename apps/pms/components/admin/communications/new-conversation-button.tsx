'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { startConversationAction } from '@/app/admin/communications/actions';
import type { ConversationChannel } from '@/lib/domain/ports';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { Field, Select } from '@/components/admin/content/fields';
import { channelKey } from './conversation-list';
import { SearchInput } from '@/components/ui/search-input';

const CHANNELS: ConversationChannel[] = ['chat', 'email', 'whatsapp', 'sms'];

export interface BookingOption {
  reference: string;
  label: string;
  guestName: string;
  email: string;
}

/** A thread the desk opens itself: pick the guest by booking, say which channel, land in the thread. */
export function NewConversationButton({ bookings, hotelSlug, compact = false }: { bookings: BookingOption[]; hotelSlug: string; compact?: boolean }) {
  const t = useAdminT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  const [guestQuery, setGuestQuery] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [bookingReference, setBookingReference] = React.useState('');
  const guests = Array.from(new Map(bookings.map((booking) => [booking.email.toLowerCase(), booking])).values());
  const guestBookings = bookings.filter((booking) => booking.email.toLowerCase() === guestEmail);

  function launch() {
    setGuestQuery('');
    setGuestEmail('');
    setBookingReference('');
    setOpen(true);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingReference || !guestEmail) return;
    const data = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await startConversationAction(bookingReference, String(data.get('channel') ?? 'chat'), hotelSlug);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      router.push(`/admin/communications/${result.id}?hotel=${encodeURIComponent(hotelSlug)}`);
    });
  }

  return (
    <>
      {compact ? (
        <button type="button" onClick={launch} aria-label={t('comms.newThread')} title={t('comms.newThread')} className={iconButton('dark', 'size-10')}>
          <PlusIcon className="size-5" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={launch} className={pill('primary')}>
          <PlusIcon className="size-4" aria-hidden="true" />
          {t('comms.newThread')}
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t('comms.start.title')}>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('comms.noBookings')}</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">{t('comms.start.body')}</p>
            <Field id="comms-guest" name="guest" label={t('comms.start.guest')}>
              <SearchInput id="comms-guest" autoFocus value={guestQuery} disabled={saving}
                placeholder={t('comms.start.guestPlaceholder')}
                onChange={(event) => { setGuestQuery(event.target.value); setGuestEmail(''); setBookingReference(''); }}
                suggestions={guests.map((guest) => ({ value: guest.email.toLowerCase(), label: guest.guestName, detail: guest.email }))}
                onSuggestionSelect={(item) => {
                  setGuestQuery(item.label);
                  setGuestEmail(item.value);
                  setBookingReference(bookings.find((booking) => booking.email.toLowerCase() === item.value)?.reference ?? '');
                }} />
            </Field>
            {guestEmail ? (
            <Field id="comms-booking" name="booking" label={t('comms.start.booking')}>
              <Select id="comms-booking" name="booking" value={bookingReference} onChange={setBookingReference} disabled={saving || guestBookings.length === 1} required>
                {guestBookings.map((booking) => (
                  <option key={booking.reference} value={booking.reference}>{booking.label}</option>
                ))}
              </Select>
            </Field>
            ) : null}
            <Field id="comms-channel" name="channel" label={t('comms.start.channel')}>
              <Select id="comms-channel" name="channel" defaultValue="chat" required>
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>{t(channelKey(channel))}</option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={pill('secondary')}>
                {t('frontDesk.cancel')}
              </button>
              <button type="submit" disabled={saving || !bookingReference} className={pill('primary')}>
                {saving ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                {t('comms.start.create')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
