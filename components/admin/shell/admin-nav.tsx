'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BanknotesIcon,
  Bars3Icon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChevronUpDownIcon,
  CheckIcon,
  DocumentTextIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  TableCellsIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { fieldClass, iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof HomeIcon;
}

const groups: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Operations',
    items: [
      { href: '/admin', label: 'Dashboard', icon: HomeIcon },
      { href: '/admin/front-desk', label: 'Front Desk', icon: TableCellsIcon },
      { href: '/admin/bookings', label: 'Reservations', icon: CalendarDaysIcon },
      { href: '/admin/content/add-ons', label: 'Services', icon: ShoppingBagIcon },
      { href: '/admin/rates', label: 'Room Rates', icon: TagIcon },
      { href: '/admin/accounting', label: 'Accounting', icon: BanknotesIcon },
    ],
  },
  {
    heading: 'Content',
    items: [
      { href: '/admin/content', label: 'Rooms', icon: DocumentTextIcon },
      { href: '/admin/content/hotel', label: 'Hotel Settings', icon: BuildingOffice2Icon },
    ],
  },
];

const itemClass =
  'flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors';

/** The longest matching href wins, so /admin/content/hotel lights its own item and every other /admin/content page lights Rooms. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of groups.flatMap((group) => group.items)) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const active = activeHref(usePathname() ?? '');

  return (
    <nav aria-label="Admin" className="grid gap-0.5">
      {groups.map((group) => (
        <div key={group.heading} role="group" aria-labelledby={`admin-nav-${group.heading}`}>
          <h2 id={`admin-nav-${group.heading}`} className="sr-only">
            {group.heading}
          </h2>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const current = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      itemClass,
                      current
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-stone hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminBrand() {
  return (
    <Link href="/admin" className="flex min-h-11 items-center gap-2 rounded-full px-2">
      <img src="/brand/staysphere-logo-on-light.svg" alt="StaySphere" className="h-6 w-auto dark:hidden" />
      <img src="/brand/staysphere-logo.svg" alt="" aria-hidden="true" className="hidden h-6 w-auto dark:block" />
    </Link>
  );
}

export function PropertyCard({ hotelName, location }: { hotelName: string; location: string }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  // The demo backend only ever serves one property. The rest are display-only
  // rows so the switcher reads like a real portfolio picker — wiring an
  // actual switch in means listing real hotels here once the backend can.
  const properties = [
    { name: hotelName, location, active: true },
    { name: 'Marlow House', location: 'Lisbon, Portugal', active: false },
    { name: 'Nordkapp Fjord Lodge', location: 'Tromsø, Norway', active: false },
    { name: 'Villa Serrano', location: 'Palma de Mallorca, Spain', active: false },
    { name: 'The Locke & Vine', location: 'Austin, United States', active: false },
    { name: 'Kiri Bay Retreat', location: 'Queenstown, New Zealand', active: false },
  ];
  const close = React.useCallback(() => setOpen(false), []);
  const matches = properties.filter((property) =>
    property.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl bg-stone/60 px-4 py-3 text-left transition-colors hover:bg-stone"
      >
        <span className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{hotelName}</p>
          <p className="truncate text-xs text-muted-foreground">{location}</p>
        </span>
        <ChevronUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <Modal open={open} onClose={close} title="Switch property">
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hotels"
            aria-label="Search hotels"
            className={cn(fieldClass, 'pl-10')}
          />
        </div>

        <ul className="mt-4 grid gap-0.5">
          {matches.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              No hotels found.
            </li>
          ) : (
            matches.map((property) => (
              <li key={property.name}>
                <button
                  type="button"
                  onClick={close}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-stone"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{property.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{property.location}</span>
                  </span>
                  {property.active ? (
                    <CheckIcon className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </Modal>
    </>
  );
}

export function DemoAccount({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/admin/account"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-stone"
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-stone text-xs font-semibold"
      >
        EM
      </span>
      <span className="min-w-0 text-sm">
        <span className="block truncate font-medium">Elena Markou</span>
        <span className="block truncate text-xs text-muted-foreground">Owner · demo account</span>
      </span>
    </Link>
  );
}

export function AdminMobileMenu({ hotelName, location }: { hotelName: string; location: string }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        className={iconButton('light')}
      >
        <Bars3Icon className="size-5" aria-hidden="true" />
      </button>
      <Modal open={open} onClose={close} title="Admin menu">
        <PropertyCard hotelName={hotelName} location={location} />
        <div className="mt-4">
          <AdminNav onNavigate={close} />
        </div>
        <div className="mt-4 grid gap-1 border-t border-border pt-3">
          <DemoAccount onNavigate={close} />
        </div>
      </Modal>
    </>
  );
}
