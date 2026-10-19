'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bars3Icon,
  BuildingOffice2Icon,
  CameraIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronUpDownIcon,
  CheckIcon,
  DocumentTextIcon,
  HomeIcon,
  UserCircleIcon,
  ShoppingBagIcon,
  XMarkIcon,
  PhotoIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { Menu } from '@base-ui/react/menu';
import { useAdminBadges } from './admin-badges';
import { AdminThemeToggle } from './admin-theme-toggle';
import { signOutAction } from '@/app/(auth)/admin/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { Modal } from '@/components/site/modal';
import { toast } from './toast';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import type { TeamPermissionKey } from '@/lib/domain/schemas';

export interface HotelOption {
  slug: string;
  name: string;
  location: string;
}

interface NavItem {
  href: string;
  label: AdminTranslationKey;
  icon: typeof HomeIcon;
  permission: TeamPermissionKey;
  maintenanceOnly?: boolean;
}

interface NavGroup {
  heading: AdminTranslationKey;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    heading: 'nav.content',
    items: [
      { href: '/admin/content', label: 'nav.rooms', icon: DocumentTextIcon, permission: 'team.permEditContent' },
      { href: '/admin/content/add-ons', label: 'nav.services', icon: ShoppingBagIcon, permission: 'team.permEditContent' },
      { href: '/admin/content/hotel', label: 'nav.hotelSettings', icon: BuildingOffice2Icon, permission: 'team.permEditContent' },
      { href: '/admin/media', label: 'mediaLib.title', icon: PhotoIcon, permission: 'team.permEditContent' },
      { href: '/admin/content/spinner/markup', label: 'markup.title', icon: PencilSquareIcon, permission: 'team.permEditContent' },
    ],
  },
  {
    heading: 'nav.management',
    items: [
      { href: '/admin/settings', label: 'cms.settings', icon: Cog6ToothIcon, permission: 'team.permBrandDomain' },
    ],
  },
];

/**
 * Kept out of `groups` on purpose: it renders in `AdminFeaturedNav`, its own
 * block below the scrolling list rather than one more row inside it — see
 * that component. The orbit is the product's own promise ("see the stay"),
 * not another CMS screen — `DESIGN_SYSTEM.md › Rules` 1 and 4.
 */
const featuredItem: Pick<NavItem, 'href' | 'label' | 'permission'> = {
  href: '/admin/content/spinner', label: 'nav.orbit', permission: 'team.permEditContent',
};

const itemClass =
  'flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors duration-200 ease-out';

/** The longest matching href wins, so /admin/content/hotel lights its own item and every other /admin/content page lights Rooms. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of [...groups.flatMap((group) => group.items), featuredItem]) {
    const matches = pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(`${item.href}/`)) ||
      (item.href === '/admin/bookings' && (pathname === '/admin/groups' || pathname.startsWith('/admin/groups/')));
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

// A route can remount the sidebar mid-transition; resume from the pill's painted position.
const navIndicatorPositions = new Map<'sidebar' | 'menu', {
  top: number;
  height: number;
  navWidth: number;
  navHeight: number;
}>();

export function AdminNav({ onNavigate, permissions, maintenanceEnabled = false }: { onNavigate?: () => void; permissions: TeamPermissionKey[]; maintenanceEnabled?: boolean }) {
  const active = activeHref(usePathname() ?? '');
  const [activeOverride, setActiveOverride] = React.useState<string | null>(null);
  const selectedHref = activeOverride ?? active;
  const t = useAdminT();
  const badges = useAdminBadges();
  const navRef = React.useRef<HTMLElement>(null);
  const indicatorRef = React.useRef<HTMLSpanElement>(null);
  const surface = onNavigate ? 'menu' : 'sidebar';
  const hasPositionedIndicator = React.useRef(false);
  const [indicator, setIndicator] = React.useState({ top: 0, height: 44, visible: false, animated: false });
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => permissions.includes(item.permission) && (!item.maintenanceOnly || maintenanceEnabled)) })).filter((group) => group.items.length > 0);

  React.useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let frame = 0;
    let restoring = false;

    const updateIndicator = () => {
      if (restoring) return;
      const selected = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!selected) {
        setIndicator((current) => current.visible ? { ...current, visible: false } : current);
        return;
      }

      if (selected.offsetHeight === 0) return;
      // Layout offsets stay stable while the tablet menu scales into view.
      const next = {
        top: selected.offsetTop,
        height: selected.offsetHeight,
        visible: true,
        animated: hasPositionedIndicator.current,
      };
      setIndicator((current) => current.top === next.top && current.height === next.height
        && current.visible === next.visible && current.animated === next.animated ? current : next);
      hasPositionedIndicator.current = true;
    };

    const previous = navIndicatorPositions.get(surface);
    const selected = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!hasPositionedIndicator.current && selected && surface === 'menu') {
      selected.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
    if (!hasPositionedIndicator.current && previous && selected && nav.clientHeight > 0
      && previous.navWidth === nav.clientWidth && previous.navHeight === nav.clientHeight
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIndicator({ top: previous.top, height: previous.height, visible: true, animated: false });
      hasPositionedIndicator.current = true;
      restoring = true;
      // Paint the restored position before enabling the transition to the current route.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          restoring = false;
          updateIndicator();
        });
      });
    } else {
      updateIndicator();
    }
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(nav);
    window.addEventListener('resize', updateIndicator);
    return () => {
      cancelAnimationFrame(frame);
      const pill = indicatorRef.current;
      if (pill && nav.clientHeight > 0 && nav.querySelector('a[aria-current="page"]')) {
        const painted = window.getComputedStyle(pill);
        navIndicatorPositions.set(surface, {
          top: new DOMMatrixReadOnly(painted.transform).m42,
          height: Number.parseFloat(painted.height),
          navWidth: nav.clientWidth,
          navHeight: nav.clientHeight,
        });
      }
      observer.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [selectedHref, surface]);

  React.useEffect(() => {
    setActiveOverride(null);
  }, [active]);

  return (
    <nav ref={navRef} data-tour="nav" aria-label={t('nav.admin')} className="relative grid gap-0.5">
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 right-0 left-0 z-0 rounded-full bg-primary',
          indicator.animated && 'transition-[transform,height,opacity] duration-[420ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
          indicator.visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{ height: indicator.height, transform: `translate3d(0, ${indicator.top}px, 0)` }}
      />
      {visibleGroups.map((group, index) => (
        <div key={group.heading} role="group" aria-labelledby={`admin-nav-${group.heading}`}>
          <h2 id={`admin-nav-${group.heading}`} className={cn('px-3 pb-3 text-xs font-medium uppercase text-muted-foreground', index > 0 && 'pt-4')}>
            {t(group.heading)}
          </h2>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const current = item.href === selectedHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={(event) => {
                      onNavigate?.();
                      if (
                        event.defaultPrevented ||
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey ||
                        item.href === selectedHref
                      ) {
                        return;
                      }
                      setActiveOverride(item.href);
                    }}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      itemClass,
                      'relative z-10 duration-300 ease-in-out',
                      current
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground can-hover:bg-stone can-hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                    {badges[item.href] ? (
                      <span
                        className={cn(
                          'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                          current ? 'bg-primary-foreground text-primary' : 'bg-accent text-accent-foreground',
                        )}
                      >
                        <span className="sr-only">{t('nav.unread', { count: String(badges[item.href]) })}</span>
                        <span aria-hidden="true">{badges[item.href]! > 99 ? '99+' : badges[item.href]}</span>
                      </span>
                    ) : null}
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

/**
 * The 360 Orbit pill, on its own rather than inside `AdminNav`'s scrolling
 * list: the caller docks this below that scroll area — a hairline above it,
 * fixed in place whichever way a long nav list scrolls (see `AdminShell`
 * and `AdminMobileMenu`).
 *
 * Filled always, not only when current: this is the one nav entry that
 * borrows "the primary action" from `DESIGN_SYSTEM.md › Rules` 6 rather than
 * "active states" — the orbit is important enough to find at a glance even
 * from a page that isn't it, the way the rest of the list's plain rows
 * aren't.
 */
export function AdminFeaturedNav({ onNavigate, permissions }: { onNavigate?: () => void; permissions: TeamPermissionKey[] }) {
  const current = featuredItem.href === activeHref(usePathname() ?? '');
  const t = useAdminT();
  if (!permissions.includes(featuredItem.permission)) return null;

  return (
    <nav data-tour="orbit" aria-label={t('nav.featured')} className="border-t border-border pt-3">
      <Link
        href={featuredItem.href}
        onClick={onNavigate}
        aria-current={current ? 'page' : undefined}
        className={cn(itemClass, 'justify-center bg-primary text-primary-foreground can-hover:bg-primary-hover')}
      >
        <CameraIcon className="size-5 shrink-0" aria-hidden="true" />
        {t(featuredItem.label)}
      </Link>
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
  switchAction,
  onHotelChange,
}: {
  hotelName: string;
  location: string;
  hotels: HotelOption[];
  selectedSlug: string;
  switchAction?: (slug: string) => Promise<void>;
  onHotelChange?: (slug: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const t = useAdminT();
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
      await switchAction?.(slug);
      close();
      onHotelChange?.(slug);
      toast.success(t('property.switched', { name: hotels.find((hotel) => hotel.slug === slug)?.name ?? t('property.that') }));
    });
  }

  return (
    <>
      <button
        type="button"
        data-tour="property"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl bg-stone/60 px-4 py-3 text-left transition-colors hover:bg-stone"
      >
        <span className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{hotelName}</p>
          <p className="truncate text-xs text-muted-foreground">{location}</p>
        </span>
        <ChevronUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <Modal open={open} onClose={close} title={t('property.switch')}>
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          suggestions={hotels.map((hotel) => ({ value: hotel.name, label: hotel.name, detail: hotel.location }))}
          suggestionsLabel={t('property.search')}
          onSuggestionSelect={(item) => setQuery(item.value)}
          placeholder={t('property.search')}
          aria-label={t('property.search')}
        />

        <ul className="mt-4 grid gap-0.5">
          {matches.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              {t('property.none')}
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

export interface AccountMember {
  id: string;
  name: string;
  /** Resolved server-side (`roleLabel` — a built-in role's translation, or a custom one's own name), since the sidebar renders on every page and shouldn't each fetch the role list itself. */
  roleLabel: string;
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

const accountItemClass =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-stone';

/**
 * The signed-in team member, at the foot of the sidebar, and the one menu
 * every product keeps there: the account page, and the way out. Signing
 * out is a server action that clears the session cookie and lands on the
 * sign-in page — the redirect is the action's own, so the menu only has to
 * call it.
 */
export function AccountMenu({ member, onNavigate, accountHref = '/admin/account' }: { member: AccountMember; onNavigate?: () => void; accountHref?: string }) {
  const t = useAdminT();
  const [signingOut, startSignOut] = React.useTransition();

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        openOnHover
        delay={80}
        closeDelay={150}
        aria-label={t('session.menu')}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-stone data-popup-open:bg-stone"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-stone text-xs font-semibold">
          {initialsOf(member.name)}
        </span>
        <span className="min-w-0 text-sm">
          <span className="block truncate font-medium">{member.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{t('account.demo', { role: member.roleLabel })}</span>
        </span>
        <ChevronUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={4} className="z-50 outline-none">
          <Menu.Popup className="min-w-52 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
            <Menu.LinkItem render={<Link href={accountHref} />} closeOnClick onClick={onNavigate} className={accountItemClass}>
              <UserCircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {t('session.account')}
            </Menu.LinkItem>
            <Menu.Item
              disabled={signingOut}
              onClick={() => startSignOut(() => signOutAction())}
              className={accountItemClass}
            >
              <ArrowRightStartOnRectangleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {signingOut ? t('session.signingOut') : t('session.signOut')}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function AdminMobileMenu({
  member,
  permissions,
  maintenanceEnabled = false,
  hotelName,
  location,
  hotels,
  selectedSlug,
}: {
  member: AccountMember;
  permissions: TeamPermissionKey[];
  maintenanceEnabled?: boolean;
  hotelName: string;
  location: string;
  hotels: HotelOption[];
  selectedSlug: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const close = React.useCallback(() => setOpen(false), []);
  /**
   * A tap on a nav row navigates *and* closes the sheet from the same
   * `onClick` — closing on the same tick as the click cuts off `itemClass`'s
   * own `transition-colors` before it has a single frame to run, so the row
   * never visibly goes active before the whole sheet vanishes under it. The
   * route change itself is already under way (`Link` doesn't wait on this
   * handler), so holding the sheet open past one repaint costs nothing but
   * gives the shared active pill time to glide to the tapped row before the
   * close animation `Modal` already runs completes the menu transition.
   */
  const navigate = React.useCallback(() => {
    requestAnimationFrame(() => setTimeout(close, 300));
  }, [close]);
  const t = useAdminT();

  return (
    <>
      <button
        type="button"
        data-tour="menu"
        disabled={!hydrated}
        onClick={() => setOpen(true)}
        aria-label={t('menu.open')}
        className={iconButton('light')}
      >
        <Bars3Icon className="size-5" aria-hidden="true" />
      </button>
      {/* `chrome={false}`: the default body scrolls its children as one
          block, which would carry 360 Orbit and the account row off screen
          with a long nav list. Its header is rebuilt here so only the
          middle scrolls — the same split `AdminShell` gives the desktop
          sidebar, and the reason `chrome={false}`'s own wrapper is a flex
          column rather than a scrolling block — see `modal.tsx`. */}
      <Modal open={open} onClose={close} title={t('menu.title')} chrome={false}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <p className="flex-1 pl-1 text-sm font-medium">{t('menu.title')}</p>
          <button type="button" onClick={close} aria-label={t('menu.close')} className={iconButton('light', 'size-10')}>
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <PropertyCard hotelName={hotelName} location={location} hotels={hotels} selectedSlug={selectedSlug} />
          <div className="mt-4">
            <AdminNav onNavigate={navigate} permissions={permissions} maintenanceEnabled={maintenanceEnabled} />
          </div>
        </div>

        <div className="shrink-0 px-5 pb-5 sm:px-6 sm:pb-6">
          <AdminFeaturedNav onNavigate={navigate} permissions={permissions} />
          <div className="mt-3 grid gap-1 border-t border-border pt-3">
            <AdminThemeToggle labelled />
            <AccountMenu member={member} onNavigate={navigate} />
          </div>
        </div>
      </Modal>
    </>
  );
}
