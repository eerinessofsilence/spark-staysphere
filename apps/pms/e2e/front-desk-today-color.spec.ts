import { expect, test } from '@playwright/test';

test('confirmed stays use a quiet readable color in the dark rack', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('admin-tour.seen.v1', '1');
    localStorage.setItem('spark.theme', 'dark');
  });
  await page.goto('/admin/front-desk');
  await expect(page.locator('html')).toHaveClass(/dark/);
  const confirmed = page.locator('[data-stay-status="confirmed"]').first();
  await expect(confirmed).toBeVisible();
  const colors = await confirmed.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    foreground: getComputedStyle(element).color,
  }));
  const luminance = (rgb: string) => {
    const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const background = luminance(colors.background);
  const foreground = luminance(colors.foreground);
  expect(background).toBeLessThan(0.08);
  expect((foreground + 0.05) / (background + 0.05)).toBeGreaterThanOrEqual(4.5);
});

test('dark front desk today column matches the room-rates tint', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('admin-tour.seen.v1', '1');
    localStorage.setItem('spark.theme', 'dark');
  });
  await page.goto('/admin/front-desk');
  await expect(page.locator('html')).toHaveClass(/dark/);
  const availability = page.locator('[data-today-availability="true"]').first();
  const night = page.locator('[data-today-night="true"]').first();
  await expect(availability).toBeVisible();
  await expect(night).toBeVisible();
  const availabilityColor = await availability.evaluate((element) => getComputedStyle(element).backgroundColor);
  const nightColor = await night.evaluate((element) => getComputedStyle(element).backgroundColor);

  await page.goto('/admin/rates?days=7');
  const rate = page.locator('[data-rate-price][data-rate-today="true"]').first();
  await expect(rate).toBeVisible();
  const rateColor = await rate.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(availabilityColor).toBe(rateColor);
  expect(nightColor).toBe(rateColor);
});

test('free booking cells use the same dark tint as the rates grid', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name !== 'desktop', 'Hover is a mouse-only state.');
  await page.addInitScript(() => {
    localStorage.setItem('admin-tour.seen.v1', '1');
    localStorage.setItem('spark.theme', 'dark');
  });
  await page.goto('/admin/front-desk');
  await expect(page.locator('html')).toHaveClass(/dark/);
  const freeNight = page.locator('[data-night-index][title]:not([data-today-night])').first();
  await expect(freeNight).toBeVisible();
  await freeNight.hover();
  const background = await freeNight.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.goto('/admin/rates?days=7');
  const rate = page.locator('[data-rate-price][data-rate-today="true"]').first();
  await expect(rate).toBeVisible();
  const rateColor = await rate.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toBe(rateColor);
});
