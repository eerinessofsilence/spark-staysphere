'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BanknotesIcon,
  Bars3Icon,
  ArrowPathRoundedSquareIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChevronUpDownIcon,
  CheckIcon,
  DocumentTextIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  PuzzlePieceIcon,
  ShoppingBagIcon,
  TableCellsIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { setSelectedHotelAction } from '@/app/admin/actions';
import { Modal } from '@/components/site/modal';
import { toast } from './toast';
import { fieldClass, iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

export interface HotelOption {
  slug: string;
  name: string;
  location: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof HomeIcon;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
  /**
   * Set off from the menu by a hairline and its own visible lead-in, rather
   * than sitting in the run of plain rows: the orbit is the product's own
   * promise ("see the stay"), not another CMS screen — see
   * `DESIGN_SYSTEM.md › Rules` 1 and 4.
   */
  featured?: boolean;
}

const groups: NavGroup[] = [
  {
    heading: 'Operations',
    items: [
      { href: '/admin', label: 'Dashboard', icon: HomeIcon },
      { href: '/admin/front-desk', label: 'Front Desk', icon: TableCellsIcon },
      { href: '/admin/bookings', label: 'Reservations', icon: CalendarDaysIcon },
      { href: '/admin/content/add-ons', label: 'Services', icon: ShoppingBagIcon },
      { href: '/admin/rates', label: 'Room Rates', icon: TagIcon },
      { href: '/admin/accounting', label: 'Accounting', icon: BanknotesIcon },
      { href: '/admin/channel-manager', label: 'Channel Manager', icon: PuzzlePieceIcon },
    ],
  },
  {
    heading: 'Content',
    items: [
      { href: '/admin/content', label: 'Rooms', icon: DocumentTextIcon },
      { href: '/admin/content/hotel', label: 'Hotel Settings', icon: BuildingOffice2Icon },
    ],
  },
  {
    heading: 'Immersive',
    featured: true,
    items: [{ href: '/admin/content/spinner', label: '360 Orbit', icon: ArrowPathRoundedSquareIcon }],
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
        <div
          key={group.heading}
          role="group"
          aria-labelledby={`admin-nav-${group.heading}`}
          className={cn(group.featured && 'mt-2 border-t border-border pt-3')}
        >
          <h2
            id={`admin-nav-${group.heading}`}
            className={cn(
              group.featured ? 'mb-1 flex items-center gap-2 px-3 text-xs text-muted-foreground' : 'sr-only',
            )}
          >
            {group.featured ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
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
                      group.featured && 'border',
                      current
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : group.featured
                          ? 'border-border text-foreground hover:bg-stone'
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

export function PropertyCard({
  hotelName,
  location,
  hotels,
  selectedSlug,
}: {
  hotelName: string;
  location: string;
  hotels: HotelOption[];
  selectedSlug: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const close = React.useCallback(() => setOpen(false), []);
  const matches = hotels.filter((hotel) => hotel.name.toLowerCase().includes(query.trim().toLowerCase()));

  function switchTo(slug: string) {
    if (slug === selectedSlug) {
      close();
      return;
    }
    startTransition(async () => {
      // The action's own revalidatePath calls refresh whatever admin page is
      // already open — an explicit router.refresh() here raced it and left
      // the sidebar showing the previous hotel.
      await setSelectedHotelAction(slug);
      close();
      toast.success(`Switched to ${hotels.find((hotel) => hotel.slug === slug)?.name ?? 'that property'}.`);
    });
  }

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
            matches.map((hotel) => (
              <li key={hotel.slug}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => switchTo(hotel.slug)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-stone disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{hotel.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hotel.location}</span>
                  </span>
                  {hotel.slug === selectedSlug ? (
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

export function AdminMobileMenu({
  hotelName,
  location,
  hotels,
  selectedSlug,
}: {
  hotelName: string;
  location: string;
  hotels: HotelOption[];
  selectedSlug: string;
}) {
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
        <PropertyCard hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} />
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
