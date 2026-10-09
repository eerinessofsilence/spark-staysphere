import { expect, test, type Page } from '@playwright/test';
import { format } from 'date-fns';
import { createAwaitingBooking } from './booking-fixture';

async function showPaymentFilters(page: Page, mobile: boolean) {
  if (mobile) {
    await page.getByRole('region', { name: 'Payments', exact: true }).getByRole('button', { name: /^Filters/ }).click();
    const panel = page.getByRole('dialog', { name: 'Payment filters', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('opacity', '1');
  }
  return page.getByRole('form', { name: 'Payment filters', exact: true });
}

test('accounting stays usable from narrow phones through desktop widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'This scenario resizes one mobile browser across responsive breakpoints.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/accounting');

  const section = page.getByRole('region', { name: 'Payments', exact: true });
  const tabs = page.getByRole('navigation', { name: 'Accounting', exact: true });
  const mobileFilterButton = section.getByRole('button', { name: /^Filters/ });
  const desktopFilters = page.getByRole('form', { name: 'Payment filters', exact: true });

  for (const width of [320, 390, 768, 1023, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { level: 1, name: 'Accounting', exact: true })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Payments', exact: true })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Invoices', exact: true })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Statistics', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `document overflows at ${width}px`).toBe(width);

    const tabsBox = await tabs.boundingBox();
    expect(tabsBox, 'accounting tabs should have a layout box').not.toBeNull();
    expect(tabsBox!.x).toBeGreaterThanOrEqual(0);
    expect(tabsBox!.x + tabsBox!.width).toBeLessThanOrEqual(width);

    if (width < 1024) {
      await expect(mobileFilterButton).toBeVisible();
      await expect(desktopFilters).toBeHidden();
      await mobileFilterButton.click();
      const panel = page.getByRole('dialog', { name: 'Payment filters', exact: true });
      await expect(panel).toBeVisible();
      await expect(panel.getByLabel('Booking or guest', { exact: true })).toBeVisible();
      await expect(panel.getByRole('combobox', { name: 'Status', exact: true })).toBeVisible();
      await expect(panel.getByRole('combobox', { name: 'Method', exact: true })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Choose booking dates', exact: true })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
      const panelBox = await panel.boundingBox();
      expect(panelBox, 'filter sheet should have a layout box').not.toBeNull();
      expect(panelBox!.x).toBeGreaterThanOrEqual(0);
      expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    } else {
      await expect(mobileFilterButton).toBeHidden();
      await expect(desktopFilters).toBeVisible();
      await expect(desktopFilters.getByLabel('Booking or guest', { exact: true })).toBeVisible();
      await expect(desktopFilters.getByRole('combobox', { name: 'Status', exact: true })).toBeVisible();
      await expect(desktopFilters.getByRole('combobox', { name: 'Method', exact: true })).toBeVisible();
      await expect(desktopFilters.getByRole('button', { name: 'Choose booking dates', exact: true })).toBeVisible();
    }

    const table = section.getByRole('table', { name: 'Bookings and their payment state', exact: true });
    if (await table.count()) {
      await expect(table).toBeVisible();
      if (width < 1024) {
        const tableScroller = table.locator('xpath=..');
        const dimensions = await tableScroller.evaluate((element) => ({ client: element.clientWidth, content: element.scrollWidth }));
        expect(dimensions.content).toBeGreaterThan(dimensions.client);
      }
      if (width >= 640) {
        await expect(page.getByRole('link', { name: 'Show 10 per page', exact: true })).toHaveAttribute('aria-current', 'page');
      }
    }
  }
});

test('accounting tabs open a booking invoice and return to the register', async ({ page, request }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const booking = await createAwaitingBooking(request, testInfo.project.name);
  const reference = booking!.reference;

  await page.goto('/admin/accounting');
  const tabs = page.getByRole('navigation', { name: 'Accounting', exact: true });
  await expect(tabs.getByRole('link', { name: 'Payments', exact: true })).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('link', { name: 'Invoices', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/accounting\/invoices$/);
  await expect(tabs.getByRole('link', { name: 'Invoices', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(/these previews have no fiscal standing/)).toBeVisible();
  const row = page.getByRole('table', { name: 'Invoices', exact: true }).getByRole('row').filter({ hasText: `INV-${reference}` });
  await expect(row).toContainText('Awaiting payment');
  await page.screenshot({ path: testInfo.outputPath('invoices-register.png'), fullPage: false });
  await row.getByRole('link', { name: `View invoice INV-${reference}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Invoice', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toContainText(`INV-${reference}`);
  await expect(dialog).toContainText('Invoice Preview Test');
  await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeVisible();
  await page.evaluate(() => { window.print = () => { document.body.dataset.invoicePrinted = 'true'; }; });
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-invoice-printed', 'true');
  expect(await dialog.locator('#invoice-printable').count()).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('invoice-preview.png'), fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(testInfo.project.name === 'mobile' ? 390 : 1440);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/invoice=/);
  await expect(row).toBeVisible();
  await page.reload();
  await expect(tabs.getByRole('link', { name: 'Invoices', exact: true })).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('link', { name: 'Payments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payments', level: 2, exact: true })).toBeVisible();
});

test('payment filters combine search, status, method and dates and survive reload', async ({ page, request }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const booking = await createAwaitingBooking(request, `filters-${testInfo.project.name}`);
  const mobile = testInfo.project.name === 'mobile';
  await page.goto('/admin/accounting?page=5&pageSize=10&methodPageSize=50');
  const section = page.getByRole('region', { name: 'Payments', exact: true });
  const filters = await showPaymentFilters(page, mobile);
  await filters.getByRole('combobox', { name: 'Status', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Awaiting payment', exact: true })).toBeVisible();
  // Base UI deliberately guards pointer selection briefly when opening a popup.
  await page.waitForTimeout(450);
  await page.getByRole('option', { name: 'Awaiting payment', exact: true }).click();
  await expect(page).toHaveURL(/status=awaiting/);
  await filters.getByRole('combobox', { name: 'Method', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Pay at the hotel', exact: true })).toBeVisible();
  await page.waitForTimeout(450);
  await page.getByRole('option', { name: 'Pay at the hotel', exact: true }).click();
  await expect(page).toHaveURL(/method=pay_at_hotel/);
  await filters.getByRole('button', { name: 'Choose booking dates' }).click();
  const calendar = page.getByRole('dialog', { name: 'Choose booking dates' });
  await expect(calendar).toBeVisible();
  await expect(calendar).toHaveCSS('opacity', '1');
  const date = new Date(`${booking.createdAt.slice(0, 10)}T12:00:00`);
  await calendar.getByRole('button', { name: format(date, 'EEE d MMM'), exact: true }).click();
  await expect(calendar).toBeHidden();
  await expect(page).toHaveURL(/from=/);
  await filters.getByLabel('Booking or guest', { exact: true }).fill(booking.reference.toLowerCase());
  await filters.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=${booking.reference.toLowerCase()}`));
  const url = new URL(page.url());
  expect(url.searchParams.get('page')).toBeNull();
  expect(url.searchParams.get('q')).toBe(booking.reference.toLowerCase());
  expect(url.searchParams.get('method')).toBe('pay_at_hotel');
  expect(url.searchParams.get('from')).toBe(booking.createdAt.slice(0, 10));
  expect(url.searchParams.get('to')).toBe(booking.createdAt.slice(0, 10));
  expect(url.searchParams.get('pageSize')).toBe('10');
  expect(url.searchParams.get('methodPageSize')).toBe('50');
  const table = section.getByRole('table', { name: 'Bookings and their payment state' });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText(booking.reference);
  await expect(table).toContainText('Awaiting payment');
  if (mobile) await expect(page.getByRole('dialog', { name: 'Payment filters', exact: true })).toBeHidden();
  await page.reload();
  await showPaymentFilters(page, mobile);
  await expect(filters.getByRole('combobox', { name: 'Status', exact: true })).toContainText('Awaiting payment');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  if (mobile) {
    const panel = page.getByRole('dialog', { name: 'Payment filters', exact: true });
    await page.screenshot({ path: testInfo.outputPath('payment-filters-panel.png'), fullPage: false });
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(section.getByRole('button', { name: 'Filters · 4', exact: true })).toBeVisible();
  }
  await section.getByRole('heading', { name: 'Payments', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('payment-filters.png'), fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
  if (mobile) await showPaymentFilters(page, mobile);
  await filters.getByRole('link', { name: 'Reset filters', exact: true }).click();
  await expect(page).toHaveURL('/admin/accounting?pageSize=10&methodPageSize=50');
  await showPaymentFilters(page, mobile);
  await expect(filters.getByRole('combobox', { name: 'Status', exact: true })).toContainText('All statuses');
});

test('payment pagination preserves filters and empty results can be reset', async ({ page, request }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  for (let index = 0; index < 11; index += 1) await createAwaitingBooking(request, `pagination-${testInfo.project.name}-${index}`);
  await page.goto('/admin/accounting?status=awaiting&method=pay_at_hotel&from=2020-01-01&to=2030-01-01&pageSize=10&methodPageSize=50');
  const section = page.getByRole('region', { name: 'Payments', exact: true });
  const next = section.getByRole('link', { name: 'Next page', exact: true });
  await expect(next).toHaveAttribute('href', /status=awaiting/);
  await next.click();
  await expect(page).toHaveURL(/page=2/);
  expect(new URL(page.url()).searchParams.get('from')).toBe('2020-01-01');
  const rows = await section.getByRole('table').locator('tbody tr').allTextContents();
  expect(rows.every((row) => row.includes('Awaiting payment') && row.includes('Pay at the hotel'))).toBe(true);
  const filters = await showPaymentFilters(page, testInfo.project.name === 'mobile');
  await filters.getByLabel('Booking or guest', { exact: true }).fill('this-guest-does-not-exist');
  await filters.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(section.getByText('No payments match these filters', { exact: true })).toBeVisible();
  await expect(section.getByRole('table')).toHaveCount(0);
  await section.getByRole('link', { name: 'Reset filters', exact: true }).last().click();
  await expect(page).toHaveURL('/admin/accounting?pageSize=10&methodPageSize=50');
  await expect(section.getByRole('table')).toBeVisible();
  await page.goto('/admin/accounting?from=2026-09-30&to=2026-09-29');
  await expect(section.getByRole('alert')).toContainText('Choose valid booking dates');
  await expect(section.getByRole('table')).toHaveCount(0);
  await section.getByRole('link', { name: 'Reset filters', exact: true }).last().click();
  await expect(page).toHaveURL('/admin/accounting');
});

test('mobile payment filters stay compact, discard drafts and close only the topmost calendar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile sheet interaction');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/accounting?status=awaiting');
  const section = page.getByRole('region', { name: 'Payments', exact: true });
  const trigger = section.getByRole('button', { name: 'Filters · 1', exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.getByRole('form', { name: 'Payment filters' })).toBeHidden();
  const filters = await showPaymentFilters(page, true);
  await filters.getByLabel('Booking or guest', { exact: true }).fill('unapplied draft');
  await page.keyboard.press('Escape');
  const panel = page.getByRole('dialog', { name: 'Payment filters', exact: true });
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL('/admin/accounting?status=awaiting');
  await showPaymentFilters(page, true);
  await expect(filters.getByLabel('Booking or guest', { exact: true })).toHaveValue('');
  await filters.getByRole('button', { name: 'Choose booking dates' }).click();
  const calendar = page.getByRole('dialog', { name: 'Choose booking dates', exact: true });
  await expect(calendar).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(calendar).toBeHidden();
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const box = await panel.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  // The desktop layout remains expanded, with no duplicate visible form or open sheet.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(trigger).toBeHidden();
  await expect(page.getByRole('form', { name: 'Payment filters' })).toBeVisible();
});

test('unknown invoice shows an unavailable state and preserves register pagination', async ({ page }) => {
  await page.goto('/admin/accounting/invoices?page=1&pageSize=10&invoice=NOTFOUND');
  await expect(page.getByRole('alert')).toContainText('This invoice is unavailable');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to invoices', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/accounting\/invoices\?pageSize=10$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(width.document).toBe(width.viewport);
});

test('invoice navigation follows the admin language', async ({ page, request, context, baseURL }) => {
  await createAwaitingBooking(request, 'invoice-language');
  await context.addCookies([{ name: 'admin-locale', value: 'ru', url: `${baseURL}/admin` }]);
  await page.goto('/admin/accounting/invoices');
  const tabs = page.getByRole('navigation', { name: 'Финансы', exact: true });
  await expect(tabs.getByRole('link', { name: 'Счета', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(tabs.getByRole('link', { name: 'Платежи', exact: true })).toBeVisible();
  await expect(page.getByText(/эти документы не имеют фискальной силы/)).toBeVisible();
  await page.getByRole('table', { name: 'Счета', exact: true }).getByRole('link', { name: /^Посмотреть счёт INV-/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Счёт', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Печать', exact: true })).toBeVisible();
});
