'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  DocumentTextIcon,
  HomeIcon,
  PhotoIcon,
  PuzzlePieceIcon,
  SwatchIcon,
  TableCellsIcon,
  TagIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { iconButton } from '@/lib/ui';
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
      { href: '/admin', label: 'Overview', icon: HomeIcon },
      { href: '/admin/chessboard', label: 'Chessboard', icon: TableCellsIcon },
      { href: '/admin/bookings', label: 'Bookings', icon: CalendarDaysIcon },
      { href: '/admin/rates', label: 'Rates & availability', icon: TagIcon },
    ],
  },
  {
    heading: 'Content',
    items: [
      { href: '/admin/content', label: 'Rooms & add-ons', icon: DocumentTextIcon },
      { href: '/admin/content/hotel', label: 'Hotel & areas', icon: BuildingOffice2Icon },
      { href: '/admin/media', label: 'Media library', icon: PhotoIcon },
    ],
  },
  {
    heading: 'Settings',
    items: [
      { href: '/admin/settings', label: 'Brand & domain', icon: SwatchIcon },
      { href: '/admin/settings/team', label: 'Team & roles', icon: UsersIcon },
      { href: '/admin/integrations', label: 'Integrations', icon: PuzzlePieceIcon },
    ],
  },
];

const itemClass =
  'flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors';

/** The longest matching href wins, so /admin/content/hotel lights its own item, not Rooms & add-ons. */
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
    <nav aria-label="Admin" className="grid gap-5">
      {groups.map((group) => (
        <div key={group.heading} role="group" aria-labelledby={`admin-nav-${group.heading}`}>
          <h2 id={`admin-nav-${group.heading}`} className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">
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
      <img src="/brand/spark-logo-on-light.svg" alt="Spark" className="h-6 w-auto dark:hidden" />
      <img src="/brand/spark-logo.svg" alt="" aria-hidden="true" className="hidden h-6 w-auto dark:block" />
      <span className="text-sm font-medium text-muted-foreground">Admin</span>
    </Link>
  );
}

export function PropertyCard({ hotelName, location }: { hotelName: string; location: string }) {
  return (
    <div className="rounded-2xl bg-stone/60 px-3 py-2.5">
      <p className="truncate text-sm font-medium">{hotelName}</p>
      <p className="truncate text-xs text-muted-foreground">{location}</p>
    </div>
  );
}

export function ViewSiteLink() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      className={cn(itemClass, 'text-muted-foreground hover:bg-stone hover:text-foreground')}
    >
      <ArrowTopRightOnSquareIcon className="size-5 shrink-0" aria-hidden="true" />
      View guest site
    </a>
  );
}

export function DemoAccount() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
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
    </div>
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
          <ViewSiteLink />
          <DemoAccount />
        </div>
      </Modal>
    </>
  );
}
