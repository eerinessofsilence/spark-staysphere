'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';
import { AdminAssistantPanel } from './admin-assistant-panel';
import { AssistantLauncherVisual } from '@/components/assistant/assistant-launcher-visual';

/**
 * The admin's way into its assistant — the same interactive orb as the
 * guest's (`components/assistant/assistant-launcher.tsx`),
 * so the two read as one feature across both sides of the product. Mounted
 * once, in `AdminShell`, so it is on every back-office screen. Unlike the
 * guest's, it stays put while the chat is open and toggles it: the chat is
 * a window beside the page, not a dialog over it.
 *
 * Lifted below `lg` to clear the CMS forms' docked save bar (`ContentForm`
 * with `dock`, `fixed inset-x-0 bottom-0`), the way the guest launcher
 * lifts above the book bar on a room page.
 *
 * Not on `/admin/communications`: that screen is a chat of its own, its
 * reply box docked in the same corner, and the orb would sit on the send
 * button.
 */
export function AdminAssistantLauncher() {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const t = useAdminT();
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/admin/communications')) return null;

  return (
    <>
      <button
        type="button"
        data-tour="assistant"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t('assistant.close') : t('assistant.title')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'fixed right-3 z-40 flex size-16 scale-100 cursor-pointer items-center justify-center rounded-full bg-transparent p-2 outline-none transition-[scale] duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:right-6 lg:bottom-6',
        )}
      >
        <AssistantLauncherVisual open={open} />
      </button>

      <AdminAssistantPanel open={open} onClose={close} />
    </>
  );
}
