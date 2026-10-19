import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Catalog, CatalogRoom } from '@/lib/application/cms-api';
import type { Hotel } from '@/lib/domain/schemas';
import { coverPhoto } from '@/lib/domain/room-attributes';
import { pill, tag } from '@/lib/ui';

export function CatalogShell({ hotel, children }: { hotel: Hotel; children: ReactNode }) {
  return <>
    <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
    <header className="container-page flex flex-wrap items-center justify-between gap-4 py-6">
      <Link href="/" className="flex items-center gap-3 text-lg font-semibold">{hotel.logo && <img src={hotel.logo.url} alt="" width={48} height={48} className="size-12 object-contain" />}{hotel.name}</Link>
      <nav aria-label="Hotel" className="flex flex-wrap items-center gap-3">
        <Link href="/rooms" className={pill('secondary')}>Rooms</Link>
        <Link href="/services/menu" className={pill('secondary')}>Services</Link>
        {hotel.bookingUrl && <a href={hotel.bookingUrl} className={pill('primary')} rel="external">Book with the hotel ↗</a>}
      </nav>
    </header>
    <main id="main">{children}</main>
    <footer className="container-page mt-20 border-t border-border py-8 text-sm text-muted-foreground">{hotel.name} · {hotel.location}</footer>
  </>;
}
export function ReferencePrice({ room, hotel }: { room: CatalogRoom; hotel: Hotel }) {
  if (room.referencePrice === null) return null;
  return <p className="mt-3 text-lg font-semibold">From {new Intl.NumberFormat('en', { style: 'currency', currency: hotel.currency, maximumFractionDigits: 0 }).format(room.referencePrice)} <span className="text-sm font-normal text-muted-foreground">/ night · reference price</span></p>;
}
export function RoomCards({ rooms, hotel }: { rooms: CatalogRoom[]; hotel: Hotel }) {
  if (!rooms.length) return <p className="mt-6 text-muted-foreground">No rooms match these filters.</p>;
  return <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {rooms.map((room) => {
      const photo = coverPhoto(room);
      return <article key={room.id} className="overflow-hidden rounded-3xl bg-card shadow-soft">
        <Link href={`/rooms/${room.slug}`} className="block h-full focus-visible:outline-2 focus-visible:outline-accent">
          {photo && <img src={photo.url} alt={room.name} width={photo.width} height={photo.height} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
          <div className="p-5"><h3 className="text-display text-2xl">{room.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{room.areaM2} m² · Up to {room.capacity} guests · {room.view} view</p>
            <ReferencePrice room={room} hotel={hotel} /><span className="mt-4 inline-flex min-h-11 items-center font-medium">Explore room →</span>
          </div>
        </Link>
      </article>;
    })}
  </div>;
}
export function PhysicalRooms({ catalog, roomTypeId }: { catalog: Catalog; roomTypeId?: string }) {
  const rooms = new Map(catalog.rooms.map((room) => [room.id, room]));
  const units = catalog.units.filter((unit) => !roomTypeId || unit.roomTypeId === roomTypeId);
  const floors = [...new Set(units.map((unit) => unit.floor))].sort((a, b) => b - a);
  if (!floors.length) return null;
  return <section aria-labelledby="floors-heading" className="mt-12">
    <h2 id="floors-heading" className="text-display text-3xl">Find your room</h2>
    <p className="mt-2 text-sm text-muted-foreground">Explore the rooms by floor. Availability is checked on the hotel's booking website.</p>
    <div className="mt-5 grid gap-4">{floors.map((floor) => <div key={floor} className="rounded-3xl bg-card p-5 shadow-soft">
      <h3 className="font-semibold">{floor === 0 ? 'Ground floor' : `Floor ${floor}`}</h3>
      <div className="mt-3 flex flex-wrap gap-2">{units.filter((unit) => unit.floor === floor).sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true })).map((unit) => {
        const room = rooms.get(unit.roomTypeId);
        return room && <Link key={unit.id} href={`/rooms/${room.slug}?unit=${encodeURIComponent(unit.number)}`} className={pill('secondary')}>Room {unit.number} · {room.name}</Link>;
      })}</div>
    </div>)}</div>
  </section>;
}
export function Services({ catalog }: { catalog: Catalog }) {
  return <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{catalog.addOns.map((service) => <article key={service.id} className="overflow-hidden rounded-3xl bg-card shadow-soft">
    {service.photos?.[0] && <img src={service.photos[0].url} alt={service.name} width={service.photos[0].width} height={service.photos[0].height} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
    <div className="p-5"><span className={tag()}>{service.category === 'dining' ? 'Dining' : 'Service'}</span><h2 className="text-display mt-3 text-2xl">{service.name}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
      <p className="mt-4 font-semibold">{new Intl.NumberFormat('en', { style: 'currency', currency: service.currency }).format(service.price)} <span className="text-sm font-normal text-muted-foreground">{service.pricingUnit.replaceAll('_', ' ')}</span></p>
    </div>
  </article>)}</div>;
}
