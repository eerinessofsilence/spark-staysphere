import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("admin-tour.seen.v1", "1"));
});

test("uploads multiple hotel photos and saves their order", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/content/hotel");
  const save = page.getByRole("button", { name: "Save hotel details", exact: true });
  await expect(save).toBeEnabled();
  const input = page.locator('input[name="aboutPhotos"]');
  const original = JSON.parse(await input.inputValue()) as string[];
  const urls = async () => JSON.parse(await input.inputValue()) as string[];
  let saved = false;
  try {
    await page
      .locator('[data-photo-editor="aboutPhotos"] input[type="file"]')
      .setInputFiles(["public/images/hotel/cove.webp", "public/images/hotel/cove.webp"]);
    await expect.poll(async () => (await urls()).length).toBe(original.length + 2);
    await expect(page.getByText("2 photos uploaded. Save changes to publish them.")).toBeVisible();
    const added = (await urls()).slice(-2);
    expect(added.every((url) => url.startsWith("/media/photos/"))).toBe(true);
    expect(new Set(added).size).toBe(2);
    const response = await page.request.get(added[0]!);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/webp");
    await page
      .getByRole("button", { name: `Show photo ${original.length + 2} earlier`, exact: true })
      .click();
    await expect.poll(async () => (await urls()).at(-2)).toBe(added[1]);
    await save.click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    saved = true;
    await page.reload();
    await expect(save).toBeEnabled();
    expect((await urls()).slice(-2)).toEqual([added[1], added[0]]);
    await expect(page.locator(`img[src="${added[0]}"]`)).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(`img[src="${added[0]}"]`)
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/photo-upload-${test.info().project.name}.png`,
      fullPage: true,
    });
  } finally {
    if (saved) {
      await page.goto("/admin/content/hotel");
      await expect(save).toBeEnabled();
      for (let n = original.length + 2; n > original.length; n -= 1) {
        await page.getByRole("button", { name: `Remove photo ${n}`, exact: true }).click();
      }
      await save.click();
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    }
  }
});

test("selects several library photos and keeps valid files when another upload fails", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/content/hotel");
  await expect(page.getByRole("button", { name: "Save hotel details" })).toBeEnabled();
  const input = page.locator('input[name="aboutPhotos"]');
  const before = (JSON.parse(await input.inputValue()) as string[]).length;
  await page.getByRole("button", { name: "Choose from library", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Choose from library", exact: true });
  const options = dialog.locator('button[aria-pressed="false"]:enabled');
  await options.nth(0).click();
  await options.nth(0).click();
  await dialog.getByRole("button", { name: "Add selected (2)", exact: true }).click();
  await expect.poll(async () => JSON.parse(await input.inputValue()).length).toBe(before + 2);
  await page
    .locator('[data-photo-editor="aboutPhotos"] input[type="file"]')
    .setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo") });
  await expect(page.getByRole("alert")).toContainText("bad.txt");
  expect(JSON.parse(await input.inputValue())).toHaveLength(before + 2);
  await page.locator('[data-photo-editor="aboutPhotos"] input[type="file"]').setInputFiles("public/images/hotel/cove.webp");
  await expect.poll(async () => JSON.parse(await input.inputValue()).length).toBe(before + 3);
  await page.reload(); // Discard this test's unsaved changes.
  await expect.poll(async () => JSON.parse(await input.inputValue()).length).toBe(before);
});
