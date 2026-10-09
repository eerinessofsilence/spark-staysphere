import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const guestPort = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const pmsURL = `http://127.0.0.1:${guestPort + 1}`;
const guestURL = `http://127.0.0.1:${guestPort}`;

async function signInAsOwner(page: Page) {
  await page.goto(`${pmsURL}/admin/sign-in`);
  await page.getByLabel('Email').fill('elena.markou@asteriacove.example');
  await page.getByLabel('Password').fill('staysphere');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/welcome/);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(/\/admin(?:\?|$)/, { timeout: 30_000 });
}

test('PMS-published hotel photos appear in Guest without sharing the admin session', async ({ browser }) => {
  test.setTimeout(120_000);
  const adminContext: BrowserContext = await browser.newContext();
  await adminContext.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const adminPage = await adminContext.newPage();
  let saved = false;
  let original: string[] = [];
  let photoUrls: string[] = [];

  try {
    await signInAsOwner(adminPage);
    await adminPage.goto(`${pmsURL}/admin/content/hotel`);
    const save = adminPage.getByRole('button', { name: 'Save hotel details', exact: true });
    const input = adminPage.locator('input[name="aboutPhotos"]');
    await expect(save).toBeEnabled();
    original = JSON.parse(await input.inputValue()) as string[];
    await adminPage.locator('[data-photo-editor="aboutPhotos"] input[type="file"]')
      .setInputFiles(['../pms/public/images/hotel/cove.webp', '../pms/public/images/hotel/cove.webp']);
    await expect.poll(async () => JSON.parse(await input.inputValue()).length).toBe(original.length + 2);
    photoUrls = (JSON.parse(await input.inputValue()) as string[]).slice(-2);
    await adminPage.getByRole('button', { name: `Show photo ${original.length + 2} earlier`, exact: true }).click();
    saved = true;
    await save.click();
    await expect(adminPage.getByText('Saved', { exact: true })).toBeVisible();

    const guestContext = await browser.newContext();
    try {
      expect(await guestContext.cookies()).toEqual([]);
      const guestPage = await guestContext.newPage();
      await guestPage.goto(`${guestURL}/`);
      const gallery = guestPage.getByRole('group', { name: /^About / });
      await gallery.scrollIntoViewIfNeeded();
      const image = gallery.locator('img').first();
      const galleryName = await gallery.getAttribute('aria-label');
      const publishedPhoto = gallery.getByRole('button', { name: `${galleryName} ${original.length + 1}`, exact: true });
      await expect(async () => {
        if (await publishedPhoto.getAttribute('aria-pressed') !== 'true') await publishedPhoto.click();
        await expect(publishedPhoto).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(image).toHaveAttribute('src', photoUrls[1]!);
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
      await gallery.getByRole('button', { name: 'Next photo', exact: true }).click();
      await expect(image).toHaveAttribute('src', photoUrls[0]!);
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    } finally {
      await guestContext.close();
    }
  } finally {
    if (saved) {
      await adminPage.goto(`${pmsURL}/admin/content/hotel`);
      const save = adminPage.getByRole('button', { name: 'Save hotel details', exact: true });
      await expect(save).toBeEnabled();
      const currentLength = JSON.parse(await adminPage.locator('input[name="aboutPhotos"]').inputValue()).length as number;
      for (let index = currentLength; index > original.length; index -= 1) {
        await adminPage.getByRole('button', { name: `Remove photo ${index}` }).click();
      }
      await save.click();
      await expect(adminPage.getByText('Saved', { exact: true })).toBeVisible();
    }
    await adminContext.close();
  }
});
