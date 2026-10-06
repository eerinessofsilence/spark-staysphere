'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { toast } from './toast';

interface NewBooking {
  reference: string;
  guestName: string;
  createdAt: string;
}

export function playBookingChime(context: AudioContext | null) {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime;
  for (const [offset, frequency] of [[0, 740], [0.14, 988]] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.13, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.25);
  }
}

export function NewBookingNotifier({ hotelSlug, initialReferences }: { hotelSlug: string; initialReferences: string[] }) {
  const t = useAdminT();
  const seen = React.useRef(new Set(initialReferences));
  const audio = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    seen.current = new Set(initialReferences);
    let active = true;
    let checking = false;

    const unlockSound = () => {
      if (!audio.current) {
        const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextConstructor) audio.current = new AudioContextConstructor();
      }
      if (audio.current?.state === 'suspended') void audio.current.resume().catch(() => {});
    };
    document.addEventListener('pointerdown', unlockSound);
    document.addEventListener('keydown', unlockSound);

    const checkForBookings = async () => {
      if (!active || checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const response = await fetch(`/api/admin/booking-notifications?hotel=${encodeURIComponent(hotelSlug)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json() as { bookings?: NewBooking[] };
        const fresh = (result.bookings ?? [])
          .filter((booking) => !seen.current.has(booking.reference))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (fresh.length === 0) return;
        for (const booking of fresh) seen.current.add(booking.reference);
        for (const booking of fresh) {
          toast.action(
            t('booking.newArrivalToast', { guest: booking.guestName, reference: booking.reference }),
            `/admin/bookings/${booking.reference}`,
            t('booking.openNotification'),
          );
        }
        playBookingChime(audio.current);
      } catch {
        // A temporary polling outage must not interrupt the admin page.
      } finally {
        checking = false;
      }
    };

    const timer = window.setInterval(() => void checkForBookings(), 6000);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('pointerdown', unlockSound);
      document.removeEventListener('keydown', unlockSound);
      audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, [hotelSlug, initialReferences, t]);

  return null;
}
