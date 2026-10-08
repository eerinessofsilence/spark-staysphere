'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Preloader } from './preloader';

const NavigationContext = React.createContext({
  pending: false,
  start: React.startTransition,
});

export function PreloaderNavigationProvider({ children }: { children: React.ReactNode }) {
  const [pending, start] = React.useTransition();
  const value = React.useMemo(() => ({ pending, start }), [pending, start]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function NavigationPreloader({ label, className }: { label: string; className?: string }) {
  const { pending } = React.useContext(NavigationContext);
  return <Preloader active={pending} label={label} className={className} />;
}

/** Track the actual route transition, including refreshes of the current URL. */
export function usePreloaderRouter() {
  const router = useRouter();
  const { start } = React.useContext(NavigationContext);
  return React.useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => start(() => router.push(...args)),
    replace: (...args: Parameters<typeof router.replace>) => start(() => router.replace(...args)),
    refresh: () => start(() => router.refresh()),
  }), [router, start]);
}

export function PreloaderLink({ onClick, href, ...props }: React.ComponentProps<typeof Link>) {
  const router = usePreloaderRouter();
  return <Link {...props} href={href} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || (props.target && props.target !== '_self') || (props.download != null && props.download !== false)
      || typeof href !== 'string' || !href.startsWith('/')) return;
    event.preventDefault();
    const options = { scroll: props.scroll };
    if (props.replace) router.replace(href, options);
    else router.push(href, options);
  }} />;
}
