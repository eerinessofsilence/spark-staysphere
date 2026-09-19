import Link from 'next/link';
import { AdminLocaleProvider } from '@/lib/i18n/admin/context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT } from '@/lib/i18n/admin/translate';
import { AuthShowcase } from './auth-showcase';

export const dynamic = 'force-dynamic';

/**
 * The back office's front door — `/admin/sign-in` and `/admin/welcome` —
 * lives in this route group rather than under `app/admin/` so that
 * `app/admin/layout.tsx`, which sends anyone without a session here, never
 * wraps these two pages and sends them round in a circle. Same URL prefix,
 * a different tree: no sidebar, no bell.
 *
 * The photo panel (`AuthShowcase`) is the layout's own, not each page's, so
 * it stays put — same rotation — as a team member moves from step 1 to
 * step 2; only the form beside it changes. It is a true edge-to-edge half
 * of the screen, not a card floating in a padded shell: no gap, no
 * rounding, flush top-to-bottom against the form column. It drops out
 * below `lg`, where the form alone, brand mark above it, is the whole
 * screen — the same shape the door had before this panel existed.
 *
 * The language is the same `/admin` cookie the shell reads, so a team member
 * who picked Russian sees the door in Russian too.
 */
export default async function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getAdminLocale();
  const t = adminT(locale);

  return (
    <AdminLocaleProvider locale={locale}>
      <div lang={locale} className="grid min-h-dvh lg:grid-cols-2">
        <AuthShowcase />

        <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-8 sm:py-12">
          <div className="flex w-full max-w-sm flex-1 flex-col justify-center lg:flex-none">
            {/* Below `lg` there is no photo panel, so its own brand mark is
                the only one — from `lg` up, `AuthShowcase` carries it instead
                of repeating it beside the form. */}
            <Link href="/" className="flex min-h-11 items-center self-center rounded-full px-2 lg:hidden">
              <img src="/brand/staysphere-logo-on-light.svg" alt="StaySphere" className="h-7 w-auto dark:hidden" />
              <img src="/brand/staysphere-logo.svg" alt="" aria-hidden="true" className="hidden h-7 w-auto dark:block" />
            </Link>

            {/* `lg:mt-0`: nothing sits above the form once the mobile-only
                brand mark disappears — see the note above. */}
            <main id="main" className="mt-6 lg:mt-0">
              {children}
            </main>

            <p className="mt-6 self-center text-xs text-muted-foreground lg:self-start">
              <Link href="/" className="hover:text-foreground">
                {t('signIn.guestSite')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AdminLocaleProvider>
  );
}
