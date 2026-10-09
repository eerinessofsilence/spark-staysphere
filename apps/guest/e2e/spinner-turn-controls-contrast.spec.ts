import { expect, test } from './test';

test('spinner turn arrows stay white on the dark control pill', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spark.theme', 'dark'));
  await page.goto('/?frame=23');

  const controls = page.getByRole('group', { name: /drag or use the arrow keys to spin/ });
  await expect(controls).toBeVisible();

  for (const name of ['Turn left', 'Turn right']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
});
