import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { contentService, guestAppUrl } from '@/lib/application/container';
import type { AddOn } from '@/lib/domain/schemas';
import { lAddOnCategory, lMoney, lPricingUnit } from '@/lib/i18n/format';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { RowActions } from '@/components/admin/content/row-actions';
import { AddOnToggle } from '@/components/admin/room-controls';
import { addOnIcon } from '@/components/rooms/add-on-icon';
import { FilterPills } from '@/components/admin/operations/filter-pills';
import { paginate, Pagination, tablePager } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deleteAddOnAction, setAddOnOnSaleAction } from './[id]/actions';
import { MenuPdfButton, type MenuPdfItem } from '@/components/admin/content/menu-pdf-button';
import { ScanProductButton } from '@/components/admin/content/scan-product-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.services')) };
}

export const dynamic = 'force-dynamic';

/** Columns a phone can do without: what they say is folded into the first cell there. */
const deskOnly = 'hidden sm:table-cell';

const categories = ['service', 'dining'] as const satisfies readonly AddOn['category'][];
type CategoryFilter = 'all' | AddOn['category'];

/**
 * Half the shared `PAGE_SIZE`, because a row here is not an item: a service
 * brings its own extras down with it (a little over two rows per service in
 * the seed catalog), so ten services fill roughly the same screen twenty
 * flat rows do on every other grid.
 */

function parseCategory(value: string | string[] | undefined): CategoryFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return categories.some((category) => category === raw) ? (raw as AddOn['category']) : 'all';
}

function hrefFor(category: CategoryFilter, page?: number): string {
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (page && page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/admin/content/add-ons?${search}` : '/admin/content/add-ons';
}

/**
 * Everything a guest can add to a stay — services and the kitchen's dishes —
 * as its own sidebar item rather than a third tab under Rooms. The route stays
 * `/admin/content/add-ons`: the entity is still an add-on everywhere below.
 *
 * One grid, the same as every other admin list: the category is a filter and
 * a column, not a second table stacked under the first, so the page pages
 * instead of growing without end. A page is 20 *top-level* add-ons — an
 * extra rides along under the one it belongs to, since it is offered inside
 * that service rather than on its own, and splitting a parent from its
 * extras across two pages would say otherwise.
 */
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, locale] = await Promise.all([searchParams, getAdminLocale()]);
  const t = adminT(locale);
  const removed = typeof params.removed === 'string' ? params.removed : null;
  const category = parseCategory(params.category);
  const pager = tablePager(params, '/admin/content/add-ons');

  const [addOns, { hotel }] = await Promise.all([
    contentService.listAddOnsContent(),
    contentService.getHotelContent(),
  ]);
  const topLevel = addOns.filter((addOn) => !addOn.parentId);
  // By service, not by row: an extra is offered inside its parent rather than
  // sold on its own, so it isn't a second thing "on sale" — matching what the
  // filter pills and the pager below already count.
  const counts: Record<CategoryFilter, number> = {
    all: topLevel.length,
    service: topLevel.filter((addOn) => addOn.category === 'service').length,
    dining: topLevel.filter((addOn) => addOn.category === 'dining').length,
  };

  // Services before food and drink, catalog order within each: one grid, but
  // a category still arrives in one run rather than interleaved, which is the
  // one thing the two stacked tables this replaced did well.
  const visible = (category === 'all' ? topLevel : topLevel.filter((addOn) => addOn.category === category))
    .slice()
    .sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
  const { pageItems, page: currentPage, totalPages } = paginate(visible, pager.page, pager.pageSize);
  // Extras belong to their parent service and are managed from that service's
  // detail page. Keep the overview grid focused on the services themselves.
  const rows = pageItems;
  const onSaleItems = addOns.filter((addOn) => addOn.enabled && addOn.category === 'dining');
  const menuItems: MenuPdfItem[] = onSaleItems
    .filter((addOn) => !addOn.parentId)
    .map((item) => ({
      id: item.id,
      category: item.category,
      categoryLabel: lAddOnCategory(item.category, locale),
      name: item.name,
      description: item.description,
      photo: item.photos?.[0]?.url ?? null,
      price: lMoney(item.price, item.currency, locale),
      unit: lPricingUnit(item.pricingUnit, locale),
      extras: onSaleItems
        .filter((extra) => extra.parentId === item.id)
        .map((extra) => ({
          name: extra.name,
          description: extra.description,
          price: lMoney(extra.price, extra.currency, locale),
          unit: lPricingUnit(extra.pricingUnit, locale),
        })),
    }));
  // The removed name is set in bold inside the sentence, so the template is split around it.
  const [removedBefore, removedAfter] = t('addOns.removed').split('{name}');

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.services')}
        actions={
          <>
            <MenuPdfButton
              hotelName={hotel.name}
              items={menuItems}
              guestBaseUrl={guestAppUrl('/') ?? undefined}
              copy={{
                title: t('addOns.pdfTitle'),
                subtitle: t('addOns.pdfSubtitle'),
                extras: t('addOns.pdfExtras'),
                page: t('addOns.pdfPage'),
                qrPrompt: t('addOns.pdfQrPrompt'),
              }}
            />
            <ScanProductButton />
            <Link href="/admin/content/add-ons/new" className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              {t('addOns.add')}
            </Link>
          </>
        }
      />

      {removed ? (
        <p role="status" className="mt-6 flex items-center gap-3 rounded-3xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle weight="fill" className="size-5 shrink-0 text-success" aria-hidden="true" />
          <span>
            {removedBefore}
            <span className="font-medium">{removed}</span>
            {removedAfter}
          </span>
        </p>
      ) : null}

      {addOns.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('addOns.empty')}</p>
      ) : (
        <>
          <div className="mt-4">
            <FilterPills
              label={t('addOns.filterByCategory')}
              sheetTitle={t('addOns.filterTitle')}
              options={(['all', ...categories] as CategoryFilter[]).map((option) => ({
                key: option,
                label: option === 'all' ? t('addOns.all') : lAddOnCategory(option, locale),
                count: counts[option],
                href: hrefFor(option),
                current: option === category,
              }))}
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('addOns.caption')} className="sm:min-w-[44rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('addOns.thAddOn')}</Th>
                  <Th className={deskOnly}>{t('addOns.thCategory')}</Th>
                  <Th>{t('addOns.thPrice')}</Th>
                  <Th>{t('addOns.thOnSale')}</Th>
                  <Th className="w-14">
                    <span className="sr-only">{t('addOns.thActions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((addOn) => {
                  const href = `/admin/content/add-ons/${addOn.id}`;
                  const photo = addOn.photos?.[0]?.url ?? null;
                  const ServiceIcon = !photo && !addOn.parentId && addOn.category === 'service' ? addOnIcon(addOn.name) : null;
                  const hasVisual = Boolean(photo || ServiceIcon);
                  return (
                    <tr
                      key={addOn.id}
                      className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                    >
                      <Td className={cn(addOn.parentId && 'border-l-2 border-l-border/70')}>
                        {/* Stretched: the row opens the add-on's own page from anywhere
                            in it — the switch and row menu sit at a higher stacking level
                            so their own clicks still reach them. */}
                        <Link
                          href={href}
                          className={cn(
                            'hover:text-accent-strong before:absolute before:inset-0',
                            hasVisual ? 'flex items-center gap-2.5' : 'block',
                            addOn.parentId ? 'pl-4 sm:pl-6' : 'font-medium',
                          )}
                        >
                          {photo ? (
                            <img
                              src={photo}
                              alt=""
                              className="admin-grid-photo"
                            />
                          ) : ServiceIcon ? (
                            <ServiceIcon className="size-5 shrink-0 text-muted-foreground" weight="fill" aria-hidden="true" />
                          ) : null}
                          {addOn.parentId ? (
                            <span className="text-muted-foreground" aria-hidden="true">
                              +{' '}
                            </span>
                          ) : null}
                          {addOn.name}
                        </Link>
                        {/* The category column is desk-only, so on a phone a top-level
                            row carries its category under the name instead. An extra
                            never repeats it: it is already under its parent. */}
                        {addOn.parentId ? null : (
                          <span className={cn('mt-0.5 block text-xs text-muted-foreground sm:hidden', photo ? 'pl-[3.375rem]' : ServiceIcon ? 'pl-7' : null)}>
                            {lAddOnCategory(addOn.category, locale)}
                          </span>
                        )}
                      </Td>
                      <Td className={cn(deskOnly, 'text-muted-foreground')}>
                        {addOn.parentId ? null : lAddOnCategory(addOn.category, locale)}
                      </Td>
                      <Td className="tabular-nums">
                        <span className="whitespace-nowrap">{lMoney(addOn.price, addOn.currency, locale)}</span>{' '}
                        <span className="block text-xs text-muted-foreground sm:inline sm:text-sm">
                          {lPricingUnit(addOn.pricingUnit, locale)}
                        </span>
                      </Td>
                      <Td className="relative z-10">
                        {/* The 44px switch target sits on the row's text line, not below it. */}
                        <div className="-my-2.5">
                          <AddOnToggle addOnId={addOn.id} addOnName={addOn.name} enabled={addOn.enabled} action={setAddOnOnSaleAction} />
                        </div>
                      </Td>
                      <Td className="relative z-10 text-right">
                        <RowActions
                          id={addOn.id}
                          version={addOn.version}
                          label={addOn.name}
                          editHref={href}
                          deleteAction={deleteAddOnAction}
                          confirmMessage={t('addOns.confirmRemove', { name: addOn.name })}
                          deleteBlockedReason={
                            contentService.isSeedEntry('addon', addOn.id)
                              ? t('addOns.seedEntry')
                              : addOns.some((child) => child.parentId === addOn.id)
                                ? t('addOns.removeExtrasFirst')
                                : undefined
                          }
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={visible.length}
              pageSize={pager.pageSize}
              hrefFor={pager.hrefFor}
              pageSizeHrefFor={pager.pageSizeHrefFor}
            />
          </div>
        </>
      )}
    </AdminPage>
  );
}
