'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/site/modal';
import { pill } from '@/lib/ui';

/**
 * Which forms on the page hold edits nobody has saved.
 *
 * `beforeunload` only guards a reload or a closed tab. A link inside the admin — the breadcrumb,
 * the sidebar, the phone menu — is a client-side navigation that never fires it, so the guard
 * catches those clicks itself and asks before the edits are thrown away.
 */
const dirtyForms = new Set<string>();

export function useUnsavedChanges(formId: string, dirty: boolean): void {
  React.useEffect(() => {
    if (dirty) dirtyForms.add(formId);
    else dirtyForms.delete(formId);
  }, [formId, dirty]);

  React.useEffect(
    () => () => {
      dirtyForms.delete(formId);
    },
    [formId],
  );
}

/** For a deliberate "throw my edits away" — the guard must not then ask about them again. */
export function discardUnsavedChanges(): void {
  dirtyForms.clear();
}

export function UnsavedChangesGuard() {
  const router = useRouter();
  const [destination, setDestination] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (dirtyForms.size === 0 || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // A jump to a section of this same page loses nothing.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // Capture phase, so this runs before the link's own client-side navigation does.
      event.preventDefault();
      event.stopPropagation();
      setDestination(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const stay = React.useCallback(() => setDestination(null), []);

  const leave = () => {
    const href = destination;
    discardUnsavedChanges();
    setDestination(null);
    if (href) router.push(href);
  };

  return (
    <Modal open={destination !== null} onClose={stay} title="Leave without saving?">
      <p className="text-sm">
        Changes on this page haven&apos;t been saved. If you leave now, they&apos;re lost.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={stay} className={pill('primary')}>
          Stay on this page
        </button>
        <button type="button" onClick={leave} className={pill('secondary')}>
          Leave without saving
        </button>
      </div>
    </Modal>
  );
}
