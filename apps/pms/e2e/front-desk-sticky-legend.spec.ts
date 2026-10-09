import { expect, test } from '@playwright/test';

test('front desk dates stay at the top and status legend stays at the bottom', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The mobile legend lives in the filters sheet.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/front-desk?days=30');

  const calendar = page.locator('#front-desk-calendar');
  const sticky = calendar.locator('[data-front-desk-sticky]');
  const legend = calendar.locator('[data-front-desk-legend]');
  const headerScroll = calendar.locator('[data-front-desk-header-scroll]');
  const body = calendar.locator('[data-front-desk-body]');
  await expect(calendar).toHaveAttribute('data-front-desk-interactive', 'true');
  await expect(legend).toBeVisible();
  await expect(body).toBeVisible();

  await calendar.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY + 350));
  await expect.poll(() => sticky.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(testInfo.project.name === 'tablet' ? 80 : 0);
  await expect.poll(() => legend.evaluate((element) => Math.round(element.getBoundingClientRect().bottom))).toBe(page.viewportSize()!.height);
  const positions = await sticky.evaluate((element) => {
    const dates = element.querySelector('[data-front-desk-header-scroll]')!.getBoundingClientRect();
    return { datesBottom: Math.round(dates.bottom) };
  });
  expect(await legend.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeGreaterThan(positions.datesBottom);

  const widths = await body.evaluate((element) => ({ client: element.clientWidth, content: element.scrollWidth }));
  expect(widths.content, JSON.stringify(widths)).toBeGreaterThan(widths.client + 100);
  await body.evaluate((element) => { element.scrollLeft = 100; });
  await expect.poll(() => headerScroll.evaluate((element) => Math.round(element.scrollLeft))).toBe(100);
  await headerScroll.evaluate((element) => { element.scrollLeft = 40; });
  await expect.poll(() => body.evaluate((element) => Math.round(element.scrollLeft))).toBe(40);
});
