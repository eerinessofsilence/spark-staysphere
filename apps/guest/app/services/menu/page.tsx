import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicDiningMenu } from '@/lib/application/pms-api';
import { DEMO_HOTEL_SLUG } from '@/lib/application/guest-config';
import { lMoney, lPricingUnit } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { hotel } = await getPublicDiningMenu(DEMO_HOTEL_SLUG);
  return { title: `Food & drink menu — ${hotel.name}`, description: `Food and drink at ${hotel.name}.` };
}

export default async function ServicesMenuPage({ searchParams }: PageProps<'/services/menu'>) {
  const params = await searchParams;
  const rawIds = typeof params.ids === 'string' && params.ids.length <= 4000 ? params.ids : '';
  const ids = [...new Set(rawIds.split(',').filter((id) => id.length > 0 && id.length <= 100))].slice(0, 80);
  const { hotel, items } = await getPublicDiningMenu(DEMO_HOTEL_SLUG);
  const selected = ids.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id && !candidate.parentId);
    return item ? [item] : [];
  });

  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page pt-12 sm:pt-20">
        <div className="max-w-3xl">
          <p className="text-base text-muted-foreground">{hotel.name}</p>
          <h1 className="text-display mt-2 text-4xl sm:text-6xl">Food &amp; drink</h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Explore the dishes and drinks selected for this menu. Availability and prices are confirmed when you book.
          </p>
        </div>

        {selected.length ? (
          <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2">
            {selected.map((item) => {
              const extras = items.filter((extra) => extra.parentId === item.id);
              return (
                <article key={item.id} className="overflow-hidden rounded-[18px] border border-border bg-card shadow-soft">
                  {item.photos?.[0] ? (
                    <img src={item.photos[0].url} alt="" className="aspect-[16/9] w-full object-cover" />
                  ) : null}
                  <div className="p-5 sm:p-6">
                    <p className="text-sm text-muted-foreground">Food &amp; drink</p>
                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                      <h2 className="text-display text-2xl">{item.name}</h2>
                      <p className="font-semibold">
                        {lMoney(item.price, item.currency, 'en')} <span className="font-normal text-muted-foreground">{lPricingUnit(item.pricingUnit, 'en')}</span>
                      </p>
                    </div>
                    {item.description ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p> : null}
                    {extras.length ? (
                      <div className="mt-5 border-t border-border pt-4">
                        <p className="text-sm font-medium">Additional choices</p>
                        <ul className="mt-2 space-y-2">
                          {extras.map((extra) => (
                            <li key={extra.id} className="flex justify-between gap-4 text-sm">
                              <span>{extra.name}</span>
                              <span className="shrink-0 text-muted-foreground">{lMoney(extra.price, extra.currency, 'en')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-[18px] border border-border bg-card p-6">
            <p className="text-muted-foreground">This menu is no longer available. Explore the hotel to see what is on offer now.</p>
          </div>
        )}

        <div className="mt-10">
          <Link href="/rooms" className={pill('primary')}>Explore rooms</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
