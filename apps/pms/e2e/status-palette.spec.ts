import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`front desk status bars stay readable in ${theme} mode`, async ({ page }, testInfo) => {
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('admin-tour.seen.v1', '1');
      localStorage.setItem('spark.theme', selectedTheme);
    }, theme);
    await page.goto('/admin/front-desk?days=14');
    await expect(page.locator('[data-stay-status="confirmed"]').first()).toBeVisible();

    const statusColors = await page.locator('[data-stay-status]').evaluateAll((bars) => {
      const colors = new Map<string, { background: string; foreground: string }>();
      for (const bar of bars) {
        const status = bar.getAttribute('data-stay-status');
        if (status && !colors.has(status)) {
          const style = getComputedStyle(bar);
          colors.set(status, { background: style.backgroundColor, foreground: style.color });
        }
      }
      return [...colors.entries()];
    });
    expect(statusColors.length).toBeGreaterThan(1);
    expect(new Set(statusColors.map(([, colors]) => colors.background)).size).toBe(statusColors.length);

    const luminance = (rgb: string) => {
      const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map((part) => {
        const value = Number(part) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    for (const [status, colors] of statusColors) {
      const background = luminance(colors.background);
      const foreground = luminance(colors.foreground);
      const contrast = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
      expect(contrast, `${status} must remain readable in ${theme} mode`).toBeGreaterThanOrEqual(4.5);
    }
    await page.screenshot({ path: testInfo.outputPath(`status-rack-${theme}.png`) });
  });
}

test('order statuses show a coloured mark with a neutral label', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name !== 'desktop', 'The order table is inspected at desktop width.');
  await page.addInitScript(() => {
    localStorage.setItem('admin-tour.seen.v1', '1');
    localStorage.setItem('spark.theme', 'dark');
  });
  await page.goto('/admin/orders?view=all');
  const badge = page.getByRole('button', { name: /Change order status/ }).first().locator('span').first();
  await expect(badge).toBeVisible();
  const colors = await badge.evaluate((element) => ({
    label: getComputedStyle(element).color,
    mark: getComputedStyle(element.querySelector('svg')!).color,
    background: getComputedStyle(element).backgroundColor,
  }));
  expect(colors.mark).not.toBe(colors.label);
  expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
  await badge.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('order-statuses-dark.png') });
});
