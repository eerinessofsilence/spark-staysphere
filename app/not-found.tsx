import Link from 'next/link';
import { pill } from '@/lib/ui';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center"
      >
        <p className="text-display text-6xl text-muted-foreground/50">404</p>
        <h1 className="text-display mt-4 text-4xl sm:text-5xl">We could not find that page</h1>
        <p className="mt-4 text-muted-foreground">
          The room or booking you followed does not exist. Demo bookings are held in memory and are
          lost when the server restarts.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/rooms" className={pill('primary')}>
            Browse rooms
          </Link>
          <Link href="/" className={pill('secondary')}>
            Back to the hotel
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
