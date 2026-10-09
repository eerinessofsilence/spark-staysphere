import { expect, test } from '@playwright/test';
import { format } from 'date-fns';

test('room rate groups collapse and expand without losing their price rows', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  for (const path of ['/admin/rates?days=7', '/admin/rates/room_garden-studio?days=7']) {
    await page.goto(path);
    const room = page.locator('[data-rate-room]').first();
    const summary = room.locator('summary');
    const price = room.locator('[data-rate-plan]').first();
    await expect(room).toHaveAttribute('open', '');
    await expect(price).toBeVisible();
    await summary.click();
    await expect(room).not.toHaveAttribute('open');
    await expect(price).toBeHidden();
    await summary.click();
    await expect(room).toHaveAttribute('open', '');
    await expect(price).toBeVisible();
  }
});

test('room detail shows one heading aligned with nightly availability', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates/room_garden-studio?days=7');
  const room = page.locator('[data-rate-room]');
  await expect(room.locator('summary')).toContainText('Garden Studio');
  await expect(room.locator('summary [data-room-quota-label]')).toContainText('Garden Studio');
  await expect(room.locator('summary [data-rate-today="true"]')).toHaveCount(1);
  await expect(room.locator('[data-room-quota-label]')).toHaveCount(1);
  await expect(room.locator('[data-room-quota-label] > a')).toHaveCount(0);
});

test('today stays highlighted from the date header through the rate rows', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const today = format(new Date(), 'yyyy-MM-dd');
  await page.goto(`/admin/rates/room_garden-studio?from=${today}&days=7`);

  const grid = page.locator('[data-rates-grid]');
  await expect(grid.locator('[data-rates-header] [data-rate-today="true"]')).toHaveAttribute('aria-current', 'date');
  await expect(grid.locator('[data-room-quota-row] [data-rate-today="true"]')).toHaveCount(1);
  await expect(grid.locator('[data-rate-plan]').first().locator('[data-rate-today="true"]')).toHaveCount(1);
  await expect(grid.locator('[data-rates-header] [data-rate-today="true"]')).toHaveClass(/bg-accent/);
  await expect(grid.locator('[data-rates-header] [data-rate-today="true"] + div')).not.toHaveAttribute('data-rate-today', 'true');
});

test('room quota stays visible without status dropdowns', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const today = format(new Date(), 'yyyy-MM-dd');

  for (const path of [`/admin/rates?from=${today}&days=7`, `/admin/rates/room_garden-studio?from=${today}&days=14`]) {
    await page.goto(path);
    const row = page.locator('[data-room-quota-row]').first();
    await expect(row).toBeVisible();
    const label = row.locator('[data-room-quota-label]');
    await expect(label.locator('[data-slot="select-trigger"]')).toHaveCount(0);
    await expect(row.locator('[data-rate-today="true"]')).toHaveCount(1);
  }
});

test('room rates overview shows each plan price under every date', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates?days=7');

  const advice = page.getByRole('region', { name: 'AI rate review' });
  await expect(advice).toBeVisible();
  await expect(advice).toContainText('prices stay unchanged');

  const rows = page.locator('[data-rate-plan]');
  await expect(rows.first()).toBeVisible();

  const first = rows.first();
  const prices = first.locator('[data-rate-price] > button > span[aria-hidden="true"]:first-child');
  await expect(prices).toHaveCount(7);
  const values = await prices.allTextContents();
  expect(values.every((value) => /^\d+(?:\.\d+)?$/.test(value.trim()))).toBe(true);

  const detail = first.getByRole('link');
  await expect(detail).toHaveAttribute('href', /\/admin\/rates\/[^?]+\?from=/);
  await detail.click();
  await expect(page).toHaveURL(/\/admin\/rates\/[^?]+\?from=/);
});

test('date header stays visible while scrolling rates and follows horizontal date scroll', async ({ page, isMobile }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates?days=14');

  const grid = page.locator('[data-rates-grid]');
  const header = grid.locator('[data-rates-header]');
  const body = grid.locator('[data-rates-body]');
  await expect(grid).toBeVisible();
  // The grid is server-rendered before its scroll-sync handler hydrates.
  await expect(grid.locator('[data-rate-price] button').first()).toBeEnabled();

  await grid.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY + 350));
  await expect.poll(() => header.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(isMobile ? 80 : 0);

  await body.evaluate((element) => { element.scrollLeft = 100; });
  await expect.poll(() => grid.locator('[data-rates-header-scroll]').evaluate((element) => Math.round(element.scrollLeft))).toBe(100);
  await grid.locator('[data-rates-header-scroll]').evaluate((element) => { element.scrollLeft = 40; });
  await expect.poll(() => body.evaluate((element) => Math.round(element.scrollLeft))).toBe(40);
});

test('an inactive room opens when clicking the empty right side of its full-width header', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/content/rooms/room_garden-studio');
  await expect(page.getByRole('button', { name: 'Save room', exact: true })).toBeEnabled();
  const hide = page.getByRole('button', { name: 'Hide from the site', exact: true });
  await expect(hide.or(page.getByRole('button', { name: 'Show on the site', exact: true }))).toBeVisible();
  const wasVisible = await hide.isVisible();
  if (wasVisible) {
    await hide.click();
    await expect(page.getByRole('button', { name: 'Show on the site', exact: true })).toBeEnabled();
  }
  try {
  await page.goto('/admin/rates?days=7');
  const room = page.locator('[data-inactive-rate-room]').first();
  const summary = room.locator('summary');
  await expect(summary).toBeVisible();
  await summary.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = await summary.boundingBox();
  const bodyBox = await page.locator('[data-rates-body]').boundingBox();
  expect(box).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  const clickX = Math.min(bodyBox!.x + bodyBox!.width - 16, page.viewportSize()!.width - 24, box!.x + box!.width - 24);
  expect(clickX - box!.x).toBeGreaterThan(320);
  expect(await summary.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), { x: clickX, y: box!.y + box!.height / 2 })).toBe(true);
  await page.mouse.click(clickX, box!.y + box!.height / 2);
  await expect(room).toHaveAttribute('open', '');
  await page.mouse.click(clickX, box!.y + box!.height / 2);
  await expect(room).not.toHaveAttribute('open');
  } finally {
    if (wasVisible) {
      await page.goto('/admin/content/rooms/room_garden-studio');
      await expect(page.getByRole('button', { name: 'Save room', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Show on the site', exact: true }).click();
      await expect(hide).toBeEnabled();
    }
  }
});

test('holiday rate review shows inventory and keeps pricing a deliberate action', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates?tab=holidays&from=2026-10-28&days=7');

  await expect(page.getByRole('navigation', { name: 'Room Rates' }).getByRole('link', { name: 'Holidays' })).toHaveAttribute('aria-current', 'page');
  const review = page.getByRole('region', { name: 'Holiday rate review' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('Ohi Day');
  await expect(review).toContainText(/rooms available|rooms are configured/);
  await expect(review).toContainText('simulated demo demand');
  await expect(review.getByRole('link', { name: 'Review rate' }).first()).toBeVisible();
  await expect(page.locator('[data-rate-plan]')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Room Rates' }).getByRole('link', { name: 'Base room rates' }).click();
  await expect(page).toHaveURL(/\/admin\/rates\?from=2026-10-28&days=7/);
  await expect(page.locator('[data-rate-plan]').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Holiday rate review' })).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Room Rates' }).getByRole('link', { name: 'Holidays' }).click();
  await expect(page).toHaveURL(/tab=holidays&from=2026-10-28&days=7/);
  await expect(page.getByRole('region', { name: 'Holiday rate review' })).toBeVisible();
});

test('a dated room rate can be edited directly in the overview and cancelled without saving', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates?from=2026-10-28&days=7');

  const dateCell = page.locator('[data-rate-plan] [data-rate-price][data-date="2026-10-28"]').first();
  const originalPrice = await dateCell.getByRole('button').innerText();
  const originalHeight = await dateCell.evaluate((element) => element.getBoundingClientRect().height);
  await dateCell.getByRole('button').click();
  const dialog = page.getByRole('dialog', { name: /Test Rate QA on|per night/ });
  await expect(dialog.getByRole('spinbutton')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(await dateCell.evaluate((element) => element.getBoundingClientRect().height)).toBe(originalHeight);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(dateCell.getByRole('button')).toHaveText(originalPrice.trim());
  await expect(page).toHaveURL(/\/admin\/rates\?from=2026-10-28&days=7/);
});

test('a range of nightly prices opens one review dialog without saving', async ({ page, isMobile }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates?from=2026-10-28&days=7');
  const row = page.locator('[data-rate-plan]').first();
  await expect(row).toBeVisible();
  const first = row.locator('[data-rate-price]').nth(0).getByRole('button');
  const third = row.locator('[data-rate-price]').nth(2).getByRole('button');
  await expect(first).toBeEnabled();

  if (isMobile) {
    await row.getByRole('button', { name: 'Select period' }).click();
    await first.click();
    await third.click();
  } else {
    await first.scrollIntoViewIfNeeded();
    const start = await first.boundingBox();
    const end = await third.boundingBox();
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
    await page.mouse.down();
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 8 });
    await page.mouse.up();
  }

  const dialog = page.getByRole('dialog', { name: 'Update selected prices' });
  await expect(dialog).toBeVisible();
  if (isMobile) {
    const viewport = page.viewportSize()!;
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  }
  await expect(dialog).toContainText('3 nights');
  await expect(dialog.getByRole('spinbutton', { name: 'New nightly price' })).toBeVisible();
  await expect(row.locator('[data-range-selected="true"]')).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row.locator('[data-range-selected="true"]')).toHaveCount(0);
});

test('mobile notification sheet fits within the viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates?days=7');
  const bell = page.locator('button[data-tour="bell"]:visible');
  await expect(bell).toBeEnabled();
  await bell.click();
  const sheet = page.getByRole('dialog', { name: 'Notifications' });
  await expect(sheet).toBeVisible();
  const viewport = page.viewportSize()!;
  const bounds = await sheet.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
});
