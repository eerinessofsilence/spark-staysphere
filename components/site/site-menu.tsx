'use client';

import * as React from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  Bars3Icon,
  BuildingOffice2Icon,
  Cog6ToothIcon,
  BriefcaseIcon,
  Squares2X2Icon,
  ArrowRightEndOnRectangleIcon,
  UserIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AuthDialog, type AuthMode } from '@/components/site/auth-dialog';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { useOverlayTransition } from '@/components/site/use-overlay-transition';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * The header's one menu, in the shape the large travel sites settled on: a
 * pill holding a burger and an avatar, opening account first and the site's
 * own pages under it.
 *
 * A phone gets the sheet every other overlay in the product rises as. A
 * desk gets a proper anchored dropdown instead — the shape a menu takes
 * there, not a centred dialog with the whole page dimmed behind it for five
 * rows of links. Same content, same component; only where it lands differs.
 */

interface SiteMenuProps {
  /** Carries the current stay, so leaving the page never drops the dates. */
  stayQuery?: string;
}

const PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 12;

export function SiteMenu({ stayQuery }: SiteMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode | null>(null);
  const { rendered, visible } = useOverlayTransition(open);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const suffix = stayQuery ? `?${stayQuery}` : '';

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const track = () => setAnchor(triggerRef.current?.getBoundingClientRect() ?? null);
    track();
    window.addEventListener('resize', track);
    window.addEventListener('scroll', track, true);
    return () => {
      window.removeEventListener('resize', track);
      window.removeEventListener('scroll', track, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!rendered) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, rendered]);

  const startAuth = (mode: AuthMode) => {
    setOpen(false);
    setAuthMode(mode);
  };

  const navigate = () => setOpen(false);

  const panel = (
    <div className="text-foreground">
      {/* Dims the page behind the sheet only — the anchored desk panel sits
          on the page the way any other dropdown does, nothing behind it
          pushed back. */}
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-ink/20 transition-opacity duration-200 sm:hidden',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Menu"
        className={cn(
          'fixed inset-x-3 bottom-3 z-50 flex max-h-[85dvh] flex-col overflow-y-auto rounded-[28px] border border-border bg-card shadow-soft-lg',
          'sm:inset-auto sm:top-(--panel-top) sm:right-(--panel-right) sm:w-(--panel-width) sm:max-w-[calc(100vw-2rem)] sm:overflow-visible sm:rounded-3xl',
          'transition-[opacity,translate] duration-200 ease-out',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0 sm:translate-y-0',
        )}
        style={
          anchor
            ? ({
                '--panel-top': `${anchor.bottom + 8}px`,
                '--panel-right': `${Math.min(
                  Math.max(VIEWPORT_MARGIN, window.innerWidth - anchor.right),
                  Math.max(VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
                )}px`,
                '--panel-width': `${PANEL_WIDTH}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:hidden">
          <span className="text-sm font-medium">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className={iconButton('light', 'size-10')}
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-3 sm:p-3">
          <div className="grid gap-1">
            <MenuButton icon={UserPlusIcon} onClick={() => startAuth('signup')} strong>
              Sign up
            </MenuButton>
            <MenuButton icon={ArrowRightEndOnRectangleIcon} onClick={() => startAuth('signin')} strong>
              Log in
            </MenuButton>
          </div>

          <div className="my-3 border-t border-border" />

          <nav aria-label="Site" className="grid gap-1">
            <MenuLink icon={BuildingOffice2Icon} href={`/${suffix}`} onNavigate={navigate}>
              The hotel
            </MenuLink>
            <MenuLink icon={Squares2X2Icon} href={`/rooms${suffix}`} onNavigate={navigate}>
              All rooms
            </MenuLink>
            <MenuLink icon={BriefcaseIcon} href={`/trips${suffix}`} onNavigate={navigate}>
              My trips
            </MenuLink>
            {/* The stay is a guest's, not the desk's: admin opens without it. */}
            <MenuLink icon={Cog6ToothIcon} href="/admin" onNavigate={navigate}>
              Hotel admin
            </MenuLink>
          </nav>

          <div className="my-3 border-t border-border" />

          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Menu and account"
        className="inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full border border-border bg-card py-1 pr-1 pl-3.5 transition-colors hover:shadow-soft"
      >
        <Bars3Icon className="size-5" aria-hidden="true" />
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
          <UserIcon className="size-4" />
        </span>
      </button>

      {mounted && rendered ? createPortal(panel, document.body) : null}

      <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} />
    </>
  );
}

const rowClass =
  'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left text-[15px] transition-colors hover:bg-stone/60';

/**
 * Heroicons, drawn at the row's own weight rather than filled: these mark what
 * a row does, they are not the subject of it. Muted at rest so the words stay
 * the thing being read, and inked on hover along with the row's own fill.
 */
type RowIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

function RowMark({ icon: Icon }: { icon: RowIcon }) {
  return (
    <Icon
      className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
      aria-hidden="true"
    />
  );
}

function MenuButton({
  children,
  icon,
  onClick,
  strong,
}: {
  children: React.ReactNode;
  icon: RowIcon;
  onClick: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(rowClass, 'group cursor-pointer', strong && 'font-medium')}
    >
      <RowMark icon={icon} />
      {children}
    </button>
  );
}

function MenuLink({
  href,
  children,
  icon,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  icon: RowIcon;
  onNavigate: () => void;
}) {
  return (
    <Link href={href} onClick={onNavigate} className={cn(rowClass, 'group')}>
      <RowMark icon={icon} />
      {children}
    </Link>
  );
}
