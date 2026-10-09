'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n/context';
import { pill } from '@/lib/ui';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export default function NotFound() {
  const t = useT();

  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-gutter py-20 text-center"
      >
        <p className="text-display text-6xl text-muted-foreground/50">404</p>
        <h1 className="text-display mt-4 text-4xl sm:text-5xl">{t('error.notFoundTitle')}</h1>
        <p className="mt-4 text-muted-foreground">{t('error.notFoundBody')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/rooms" className={pill('primary')}>
            {t('error.browseRooms')}
          </Link>
          <Link href="/" className={pill('secondary')}>
            {t('error.backToHotel')}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
