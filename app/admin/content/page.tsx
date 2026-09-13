import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import { EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { roomCategory } from '@/lib/domain/room-attributes';
import { formatMoney } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { SectionLabel } from '@/components/site/section-label';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'Content — Hotel admin | SPARK StaySphere 360',
};

/** Content is read fresh from the overlay on every load, never cached. */
export const dynamic = 'force-dynamic';

export default async function ContentOverviewPage() {
  const [{ hotel }, rooms, addOns] = await Promise.all([
    contentService.getHotelContent(),
    contentService.listRoomsContent(),
    contentService.listAddOnsContent(),
  ]);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1200px] px-3 py-8 sm:px-6 lg:py-12">
        <header>
          <SectionLabel>Site content · demo</SectionLabel>
          <h1 className="text-display mt-4 text-5xl sm:text-6xl">Site content</h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Edit what guests see without a deploy. Changes here show up on the site and in the AI
            room finder immediately.
          </p>
        </header>

        <section aria-labelledby="hotel-heading" className="mt-12">
          <h2 id="hotel-heading" className="text-display text-3xl">
            Hotel
          </h2>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-card p-6 shadow-soft">
            <div>
              <p className="text-display text-2xl">{hotel.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hotel.tagline} · {hotel.location}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {hotel.areas.length} areas · {hotel.currency} · {hotel.timezone}
              </p>
            </div>
            <Link href="/admin/content/hotel" className={pill('secondary')}>
              Edit hotel details
            </Link>
          </div>
        </section>

        <section aria-labelledby="rooms-heading" className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="rooms-heading" className="text-display text-3xl">
              Room types
            </h2>
            <Link href="/admin/content/rooms/new" className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              New room type
            </Link>
          </div>

          {rooms.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No room types yet.</p>
          ) : (
            <div className="relative mt-5 overflow-x-auto rounded-[28px] bg-card shadow-soft contain-inline-size">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <caption className="sr-only">Room types editable through the CMS</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>Room type</Th>
                    <Th>Category</Th>
                    <Th>Floor</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b border-border last:border-b-0">
                      <Td>
                        <span className="font-medium">{room.name}</span>
                        <span className="block text-xs text-muted-foreground">{room.slug}</span>
                      </Td>
                      <Td className="text-muted-foreground capitalize">{roomCategory(room)}</Td>
                      <Td className="text-muted-foreground">{room.floor}</Td>
                      <Td>
                        {room.hidden ? (
                          <span className={tag()}>
                            <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                            Hidden
                          </span>
                        ) : (
                          <span className={tag('bg-tint-sage text-tint-sage-ink')}>On the site</span>
                        )}
                      </Td>
                      <Td>
                        <Link href={`/admin/content/rooms/${room.id}`} className="font-medium hover:text-accent-strong">
                          Edit
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="addons-heading" className="mt-12 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="addons-heading" className="text-display text-3xl">
              Add-ons
            </h2>
            <Link href="/admin/content/add-ons/new" className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              New add-on
            </Link>
          </div>

          {addOns.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No add-ons yet.</p>
          ) : (
            <div className="relative mt-5 overflow-x-auto rounded-[28px] bg-card shadow-soft contain-inline-size">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <caption className="sr-only">Add-ons editable through the CMS</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>Add-on</Th>
                    <Th>Category</Th>
                    <Th>Price</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {addOns.map((addOn) => (
                    <tr key={addOn.id} className="border-b border-border last:border-b-0">
                      <Td>
                        <span className="font-medium">
                          {addOn.parentId ? <span className="text-muted-foreground">+ </span> : null}
                          {addOn.name}
                        </span>
                      </Td>
                      <Td className="text-muted-foreground capitalize">{addOn.category}</Td>
                      <Td>{formatMoney(addOn.price, addOn.currency)}</Td>
                      <Td>
                        {addOn.enabled ? (
                          <span className={tag('bg-tint-sage text-tint-sage-ink')}>On sale</span>
                        ) : (
                          <span className={tag()}>Withdrawn</span>
                        )}
                      </Td>
                      <Td>
                        <Link href={`/admin/content/add-ons/${addOn.id}`} className="font-medium hover:text-accent-strong">
                          Edit
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-sm font-normal text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
