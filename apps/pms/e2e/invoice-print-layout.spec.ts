import { expect, test } from '@playwright/test';
import { createAwaitingBooking } from './booking-fixture';

test('branded invoice is readable on mobile and prints without the surrounding page', async ({ page, request }, testInfo) => {
  await createAwaitingBooking(request, 'invoice-print');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/accounting/invoices');
  const invoiceLink = page.getByRole('link', { name: /^View invoice INV-/ }).first();
  await expect(invoiceLink).toBeVisible();
  await invoiceLink.click();
  const dialog = page.getByRole('dialog', { name: 'Invoice', exact: true });
  await expect(dialog).toBeVisible();
  const invoice = dialog.locator('#invoice-printable');
  await expect(invoice.getByRole('img', { name: 'StaySphere', exact: true })).toBeVisible();
  await expect(invoice.getByRole('table', { name: 'Description', exact: true })).toBeVisible();
  await expect(invoice.locator('.invoice-total')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(testInfo.project.name === 'mobile' ? 390 : 1440);
  await page.screenshot({ path: testInfo.outputPath('invoice-screen.png') });

  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 794, height: 1123 });
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeHidden();
  await expect(invoice.getByRole('table', { name: 'Description', exact: true })).toBeVisible();
  const box = await invoice.boundingBox();
  expect(box!.y).toBe(0);
  expect(box!.height).toBeLessThan(1123);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(1123);
  await page.screenshot({ path: testInfo.outputPath('invoice-print.png'), fullPage: true });
});
