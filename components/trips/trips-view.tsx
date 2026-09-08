'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, CalendarIcon, UsersIcon } from '@heroicons/react/24/outline';
import { cancelTrip, claimTrip, loadTrips } from '@/app/trips/actions';
import type { TripSummary } from '@/lib/application/booking-service';
import { formatDateRange, formatGuests, formatMoney, formatNights } from '@/lib/formatting';
import { fieldClass, pill, tag } from '@/lib/ui';
import { readTrips, rememberTrip } from '@/lib/trips-storage';
import { Modal } from '@/components/site/modal';
import { cn } from '@/lib/utils';

/** A cancelled stay still belongs in the list; it just does not read as upcoming. */
const statusLabels: Record<TripSummary['status'], string> = {
  draft: 'Not finished',
  held: 'Held',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

type Tab = 'upcoming' | 'past' | 'cancelled';

const tabLabels: Record<Tab, string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  cancelled: 'Cancelled',
};

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** Cancelled stays leave the calendar entirely — a cancelled trip is not "past". */
function bucketOf(trip: TripSummary, today: string): Tab {
  if (trip.status === 'cancelled') return 'cancelled';
  return trip.checkOut >= today ? 'upcoming' : 'past';
}

export function TripsView({ stayQuery }: { stayQuery: string }) {
  const [trips, setTrips] = React.useState<TripSummary[] | null>(null);
  const [tab, setTab] = React.useState<Tab>('upcoming');
  const [cancelling, setCancelling] = React.useState<TripSummary | null>(null);

  React.useEffect(() => {
    let live = true;
    const references = readTrips();
    if (references.length === 0) {
      setTrips([]);
      return;
    }
    void loadTrips(references).then((found) => {
      if (live) setTrips(found);
    });
    return () => {
      live = false;
    };
  }, []);

  const upsert = (trip: TripSummary) => {
    setTrips((current) => {
      const rest = (current ?? []).filter((entry) => entry.reference !== trip.reference);
      return [...rest, trip].sort((first, second) => first.checkIn.localeCompare(second.checkIn));
    });
  };

  const addTrip = (trip: TripSummary) => {
    rememberTrip(trip.reference);
    upsert(trip);
  };

  if (trips === null) {
    return (
      <p className="mt-10 text-sm text-muted-foreground" role="status">
        Looking up your bookings…
      </p>
    );
  }

  const today = todayIso();
  const counts: Record<Tab, number> = { upcoming: 0, past: 0, cancelled: 0 };
  for (const trip of trips) counts[bucketOf(trip, today)] += 1;
  const shown = trips.filter((trip) => bucketOf(trip, today) === tab);

  return (
    <div className="mt-10">
      {trips.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border p-10 text-center">
          <h2 className="text-display text-3xl">No trips yet</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Bookings you make here are listed on this page. Booked on another device? Find it with
            your reference below.
          </p>
          <Link href={`/rooms?${stayQuery}`} className={pill('primary', 'mt-6')}>
            Browse rooms
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Filter trips"
            className="inline-flex gap-1 rounded-full bg-stone/60 p-1"
          >
            {(Object.keys(tabLabels) as Tab[]).map((key) => {
              const selected = key === tab;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                    selected
                      ? 'bg-card text-foreground shadow-soft'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tabLabels[key]}
                  <span className={cn('text-xs', selected ? 'text-muted-foreground' : 'opacity-70')}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="mt-6 rounded-[28px] border border-dashed border-border p-10 text-center text-muted-foreground">
              {tab === 'upcoming'
                ? 'No stays ahead of you right now.'
                : tab === 'past'
                  ? 'Nothing here yet — stays move across once you have checked out.'
                  : 'Nothing cancelled.'}
            </p>
          ) : (
            <ul className="mt-6 grid gap-3">
              {shown.map((trip) => (
                <li key={trip.reference}>
                  <TripCard trip={trip} onCancel={() => setCancelling(trip)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ClaimForm onFound={addTrip} known={trips.map((entry) => entry.reference)} />

      <CancelDialog
        trip={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={(trip) => {
          upsert(trip);
          setCancelling(null);
          // Follow the stay to where it just went, rather than letting it
          // vanish out of the tab the guest is looking at.
          setTab('cancelled');
        }}
      />
    </div>
  );
}

function TripCard({ trip, onCancel }: { trip: TripSummary; onCancel: () => void }) {
  const cancelled = trip.status === 'cancelled';

  return (
    <article
      className={cn(
        'group relative grid overflow-hidden rounded-[28px] bg-card shadow-soft transition-shadow hover:shadow-soft-lg',
        'sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]',
        cancelled && 'opacity-90',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-stone sm:aspect-auto sm:h-full">
        {trip.photo ? (
          // Taken out of the flow on purpose. Left in it, a portrait cover —
          // a balcony shot, say — resolves its `h-full` against a row whose
          // height is not yet known, falls back to its own tall natural
          // height, and drags the card past its text, leaving a hole under
          // the total. Absolute, the photo measures nothing and the text
          // alone sets how tall the card is.
          <img
            src={trip.photo.url}
            alt={trip.roomName}
            width={trip.photo.width}
            height={trip.photo.height}
            loading="lazy"
            decoding="async"
            className={cn(
              'absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
              cancelled && 'saturate-50',
            )}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-display text-2xl">
              <Link href={`/booking/${trip.reference}`} className="before:absolute before:inset-0">
                {trip.roomName}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Reference{' '}
              <span className="font-semibold tracking-wide text-foreground">{trip.reference}</span>
            </p>
          </div>
          <span
            className={cn(
              tag(),
              trip.status === 'confirmed' && 'text-success',
              cancelled && 'text-danger',
            )}
          >
            {statusLabels[trip.status]}
          </span>
        </div>

        <ul className="flex flex-wrap gap-1.5">
          <li className={tag()}>
            <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {formatDateRange(trip.checkIn, trip.checkOut)} · {formatNights(trip.nights)}
          </li>
          <li className={tag()}>
            <UsersIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {formatGuests(trip.adults, trip.children)}
          </li>
          {trip.addOnCount > 0 ? (
            <li className={tag()}>
              {trip.addOnCount} {trip.addOnCount === 1 ? 'extra' : 'extras'}
            </li>
          ) : null}
        </ul>

        <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            {cancelled ? 'Was' : 'Total paid'}
          </span>
          <span className={cn('text-display text-2xl', cancelled && 'line-through opacity-60')}>
            {formatMoney(trip.total, trip.currency)}
          </span>
        </div>

        {/* Above the stretched link, or the card would swallow the click. */}
        <div className="relative z-10 flex flex-wrap gap-2">
          <Link href={`/booking/${trip.reference}`} className={pill('secondary', 'min-h-10 px-4')}>
            View booking &amp; receipt
          </Link>
          {trip.canCancel ? (
            <button type="button" onClick={onCancel} className={pill('ghost', 'min-h-10 px-4 text-danger hover:bg-danger/10')}>
              Cancel booking
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * Cancelling asks for the email the stay was booked with, the same pair the
 * claim form needs. A reference is what this browser happens to remember;
 * it is not on its own a reason to let anyone at this machine give a
 * stranger's room back to the hotel.
 */
function CancelDialog({
  trip,
  onClose,
  onCancelled,
}: {
  trip: TripSummary | null;
  onClose: () => void;
  onCancelled: (trip: TripSummary) => void;
}) {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (trip) {
      setEmail('');
      setError(null);
    }
  }, [trip]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trip) return;
    setPending(true);
    setError(null);
    const result = await cancelTrip({ reference: trip.reference, email });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCancelled(result.trip);
  };

  return (
    <Modal open={trip !== null} onClose={onClose} title="Cancel booking">
      {trip ? (
        <form onSubmit={submit}>
          <h2 className="text-display text-2xl">Cancel this stay?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {trip.roomName}, {formatDateRange(trip.checkIn, trip.checkOut)} · {trip.reference}. The
            room goes back on sale straight away. Nothing was charged in this demo, so there is
            nothing to refund — and the booking cannot be reinstated afterwards.
          </p>

          <label htmlFor="cancel-email" className="mt-5 mb-1.5 block text-sm text-muted-foreground">
            Email the booking was made with
          </label>
          <input
            id="cancel-email"
            type="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />

          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={pill('secondary', 'min-h-11')}>
              Keep booking
            </button>
            <button
              type="submit"
              disabled={pending}
              className={pill('primary', 'min-h-11 bg-danger text-white hover:bg-danger/90')}
            >
              {pending ? 'Cancelling…' : 'Cancel booking'}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

function ClaimForm({
  onFound,
  known,
}: {
  onFound: (trip: TripSummary) => void;
  known: string[];
}) {
  const [reference, setReference] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await claimTrip({ reference, email });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const already = known.includes(result.trip.reference);
    onFound(result.trip);
    setReference('');
    setEmail('');
    setNotice(already ? 'That trip is already on this list.' : `${result.trip.reference} added.`);
  };

  return (
    <section aria-labelledby="claim-heading" className="mt-12 rounded-[28px] bg-card p-6 shadow-soft sm:p-8">
      <h2 id="claim-heading" className="text-display text-2xl">
        Find a booking
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        Booked on another device? Enter the reference from your confirmation and the email you
        booked with, and the stay joins this list.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="claim-reference" className="mb-1.5 block text-sm text-muted-foreground">
            Reference
          </label>
          <input
            id="claim-reference"
            value={reference}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="AC-3F7K2P"
            onChange={(event) => setReference(event.target.value.toUpperCase())}
            className={cn(fieldClass, 'tracking-wide')}
          />
        </div>
        <div>
          <label htmlFor="claim-email" className="mb-1.5 block text-sm text-muted-foreground">
            Email
          </label>
          <input
            id="claim-email"
            type="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>
        <button type="submit" disabled={pending} className={pill('primary', 'min-h-11')}>
          {pending ? 'Looking…' : 'Find booking'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-3 text-sm font-medium text-success">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
