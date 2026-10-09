import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`subscription notice text is readable in ${theme} theme`, async ({ page }) => {
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('admin-tour.seen.v1', '1');
      localStorage.setItem('spark.theme', selectedTheme);
    }, theme);
    await page.clock.install();
    await page.goto('/admin');
    await page.clock.setSystemTime(new Date(Date.now() + 40 * 86_400_000));
    await page.clock.runFor(30_001);
    const notice = page.locator('[data-subscription-notice]');
    await expect(notice).toBeVisible();
    const colors = await notice.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      foreground: getComputedStyle(element.querySelector('p')!).color,
      canvas: getComputedStyle(document.body).backgroundColor,
    }));
    const channels = (rgb: string) => rgb.match(/[\d.]+/g)!.map(Number);
    const background = channels(colors.background);
    const canvas = channels(colors.canvas);
    const alpha = background[3] ?? 1;
    const effectiveBackground = background.slice(0, 3).map((value, index) => value * alpha + canvas[index]! * (1 - alpha));
    const luminance = (rgb: number[]) => {
      const linear = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
    };
    const text = luminance(channels(colors.foreground));
    const fill = luminance(effectiveBackground);
    expect((Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(theme === 'dark' ? text > fill : text < fill).toBe(true);
  });
}
