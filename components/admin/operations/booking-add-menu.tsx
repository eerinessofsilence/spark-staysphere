'use client';

import * as React from 'react';
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { AddBookingDialog, type BookableRoomType } from '@/components/admin/front-desk/add-booking-button';
import { CreateGroupDialog } from './create-group-button';

/** One header action for the two reservation creation flows. */
export function BookingAddMenu({ roomTypes, today }: { roomTypes: BookableRoomType[]; today: string }) {
  const t = useAdminT();
  const [mounted, setMounted] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<'booking' | 'group' | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const bookingRef = React.useRef<HTMLButtonElement>(null);
  const groupRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [menuOpen]);

  const choose = (kind: 'booking' | 'group') => {
    setMenuOpen(false);
    setDialog(kind);
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
    }
    if (menuOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const items = [bookingRef.current, groupRef.current].filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
  };

  return (
    <>
      <div
        ref={rootRef}
        className="relative z-30"
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setMenuOpen(true); }}
        onPointerLeave={(event) => { if (event.pointerType === 'mouse') setMenuOpen(false); }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}
        onKeyDown={onMenuKeyDown}
      >
        <button
          ref={triggerRef}
          type="button"
          className={pill('primary')}
          disabled={!mounted}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => {
            if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setMenuOpen(true);
            else setMenuOpen((open) => !open);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              const focusLast = event.key === 'ArrowUp';
              setMenuOpen(true);
              requestAnimationFrame(() => {
                const first = bookingRef.current?.disabled ? groupRef.current : bookingRef.current;
                (focusLast ? groupRef.current : first)?.focus();
              });
            }
          }}
        >
          <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
          {t('ops.add')}
          <ChevronDownIcon className="size-4 shrink-0" aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div className="absolute top-full right-0 z-50 min-w-56 pt-2">
            <div id={menuId} role="menu" aria-label={t('ops.add')} className="rounded-[18px] border border-border bg-card p-1.5 shadow-soft">
              <button
                ref={bookingRef}
                type="button"
                role="menuitem"
                disabled={roomTypes.length === 0}
                onClick={() => choose('booking')}
                className={pill('ghost', 'w-full justify-start px-4')}
              >
                {t('frontDesk.addBooking')}
              </button>
              <button
                ref={groupRef}
                type="button"
                role="menuitem"
                onClick={() => choose('group')}
                className={pill('ghost', 'w-full justify-start px-4')}
              >
                {t('ops.addGroupBooking')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <AddBookingDialog roomTypes={roomTypes} today={today} open={dialog === 'booking'} onClose={() => setDialog(null)} />
      <CreateGroupDialog open={dialog === 'group'} onClose={() => setDialog(null)} label={t('ops.addGroupBooking')} />
    </>
  );
}
