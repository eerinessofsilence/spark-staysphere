import { expect, test } from '@playwright/test';

/**
 * The AI room finder, run against the deterministic keyword interpreter —
 * no `OPENAI_API_KEY` is set for this suite, which is itself the coverage
 * for "a keyless `npm run dev` still answers end to end."
 */

const LAUNCHER_LABEL = 'Find a room by voice or description';

/** A click on a server-rendered island is lost until React attaches its listeners; retry until it lands. */
async function actUntil(act: () => Promise<void>, effect: () => Promise<void>) {
  await expect(async () => {
    await act();
    await effect();
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] });
}

test('the launcher is visible and reachable by keyboard', async ({ page }) => {
  await page.goto('/');
  const launcher = page.getByRole('button', { name: LAUNCHER_LABEL });
  await expect(launcher).toBeVisible();

  await launcher.focus();
  await expect(launcher).toBeFocused();
  await actUntil(
    () => page.keyboard.press('Enter'),
    () => expect(page.getByRole('dialog', { name: LAUNCHER_LABEL })).toBeVisible({ timeout: 3_000 }),
  );
});

test('open, type, and get real results whose handoff link carries the interpreted filters', async ({ page }) => {
  await page.goto('/');
  const launcher = page.getByRole('button', { name: LAUNCHER_LABEL });

  await actUntil(
    () => launcher.click(),
    () => expect(page.getByRole('dialog', { name: LAUNCHER_LABEL })).toBeVisible({ timeout: 3_000 }),
  );

  const input = page.getByLabel('Describe the room you want');
  await input.fill('A sea view suite for two');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const status = page.getByRole('dialog', { name: LAUNCHER_LABEL }).getByRole('status');
  await expect(status).toContainText('room types match', { timeout: 10_000 });
  await expect(status).toContainText('sea view');
  await expect(status).toContainText('suite');

  // The model's own filter object, not a fact it wrote: every card underneath
  // is a real, priced `RoomCard`, not text the interpreter produced.
  const seeAll = page.getByRole('link', { name: /See all \d+ rooms/ });
  await expect(seeAll).toBeVisible();
  const href = await seeAll.getAttribute('href');
  expect(href).toContain('view=sea');
  expect(href).toContain('category=suite');
  expect(href).toContain('adults=2');

  await seeAll.click();
  await expect(page).toHaveURL(/\/rooms\?.*view=sea.*category=suite/);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your room' })).toBeVisible();
});

test('an impossible combination explains itself and offers one way out', async ({ page }) => {
  await page.goto('/rooms');
  const launcher = page.getByRole('button', { name: LAUNCHER_LABEL });

  await actUntil(
    () => launcher.click(),
    () => expect(page.getByRole('dialog', { name: LAUNCHER_LABEL })).toBeVisible({ timeout: 3_000 }),
  );

  const input = page.getByLabel('Describe the room you want');
  await input.fill('Something under €10');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const status = page.getByRole('dialog', { name: LAUNCHER_LABEL }).getByRole('status');
  await expect(status).toContainText('No rooms match that combination', { timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Drop the €10 cap$/ })).toBeVisible();
});

test('Escape closes the panel and returns focus to the launcher', async ({ page }) => {
  await page.goto('/trips');
  const launcher = page.getByRole('button', { name: LAUNCHER_LABEL });

  await actUntil(
    () => launcher.click(),
    () => expect(page.getByRole('dialog', { name: LAUNCHER_LABEL })).toBeVisible({ timeout: 3_000 }),
  );

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: LAUNCHER_LABEL })).toBeHidden();
  await expect(launcher).toBeFocused();
});

test('the launcher does not widen the phone layout viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Only meaningful at the phone width');
  await page.goto('/rooms');
  await expect(page.getByRole('button', { name: LAUNCHER_LABEL })).toBeVisible();
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('on a room page at 390px the launcher clears the mobile book bar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Only meaningful where MobileBookBar is shown');
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 45);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);
  const stayQuery = `checkIn=${checkIn.toISOString().slice(0, 10)}&checkOut=${checkOut.toISOString().slice(0, 10)}&adults=2&children=0`;

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);

  const launcher = page.getByRole('button', { name: LAUNCHER_LABEL });
  // The sidebar's own "Book this room" link is still in the DOM below `lg`
  // (only its sticky positioning is desktop-only), so `MobileBookBar`'s copy
  // — the one that actually matters here — is the one rendered after it.
  const bookBar = page.getByRole('link', { name: /Book this room|See rooms/ }).last();
  await expect(launcher).toBeVisible();
  await expect(bookBar).toBeVisible();

  const [launcherBox, bookBarBox] = await Promise.all([launcher.boundingBox(), bookBar.boundingBox()]);
  expect(launcherBox).not.toBeNull();
  expect(bookBarBox).not.toBeNull();
  if (launcherBox && bookBarBox) {
    const overlaps =
      launcherBox.y < bookBarBox.y + bookBarBox.height && launcherBox.y + launcherBox.height > bookBarBox.y;
    expect(overlaps).toBe(false);
  }
});
