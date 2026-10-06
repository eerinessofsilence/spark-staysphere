import { expect, test } from '@playwright/test';

test('reservations can be filtered, searched and opened with complete stay details', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/bookings');
  await expect(page.getByRole('heading', { level: 1, name: 'Reservations' })).toBeVisible();
  const statusNavigation = page.getByRole('navigation', { name: 'Filter reservations by stay' });
  if (await statusNavigation.count()) await expect(statusNavigation).toBeVisible();
  else await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter by stay dates' })).toBeVisible();

  const firstBooking = page.locator('a[href^="/admin/bookings/"]').first();
  test.skip(await firstBooking.count() === 0, 'No reservations in this demo');
  const href = (await firstBooking.getAttribute('href'))!;
  const reference = href.split('/').at(-1)!;

  const mobileSearch = page.getByRole('button', { name: 'Search reservations' });
  if (await mobileSearch.isVisible()) await mobileSearch.click();
  const search = page.getByRole('searchbox', { name: 'Search by booking number, guest, or email' });
  await search.fill(reference.toLowerCase());
  await search.press('Enter');
  await expect(page.getByRole('row').filter({ hasText: reference })).toHaveCount(1);

  await page.getByRole('link', { name: reference, exact: true }).click();
  const reservation = page.getByRole('region', { name: `Reservation ${reference}`, exact: true });
  await expect(reservation).toBeVisible();
  await expect(reservation.getByText('Arrival time:', { exact: false })).toBeVisible();
  await expect(reservation.getByText('Departure time:', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actions', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Message guest' })).toBeVisible();
});
