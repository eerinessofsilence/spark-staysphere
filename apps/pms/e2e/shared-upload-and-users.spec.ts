import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("admin-tour.seen.v1", "1"));
});

test("offers separate create and invite forms, with server-side duplicate validation", async ({
  page,
}) => {
  await page.goto("/admin/settings/team");
  await expect(page.getByRole("button", { name: "Invite teammate", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create user", exact: true });
  await expect(dialog.getByText(/shared admin password/)).toBeVisible();
  await dialog.getByLabel("Full name").fill("Duplicate test");
  await dialog.getByLabel("Email", { exact: true }).fill("ELENA.MARKOU@asteriacove.example");
  await dialog.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toContainText(/already/i);
  await page.screenshot({
    path: `/tmp/create-user-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("uses the same uploader on all photo editing surfaces", async ({ page }) => {
  for (const path of [
    "/admin/media",
    "/admin/content/rooms/new",
    "/admin/content/add-ons/new",
    "/admin/content/hotel",
    "/admin/content/spinner/frames",
  ]) {
    await page.goto(path);
    const zone = page.getByTestId("upload-dropzone").first();
    await expect(zone).toBeVisible();
    await expect(zone.getByText("Drop photos here or choose files", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
  await expect(page.getByRole("alert")).toContainText("JPEG");
  await page.goto("/admin/content/hotel");
  const editor = page.locator('[data-photo-editor="logoUrl"]');
  await expect(editor.getByTestId("upload-dropzone")).toBeVisible();
  await expect(editor.locator('input[type="file"]')).not.toHaveAttribute("multiple");
  await editor.locator('input[type="file"]').setInputFiles("public/images/hotel/cove.webp");
  await expect(editor.getByRole("status")).toContainText("1 photos uploaded. Save changes to publish them.");
  await expect(editor.locator('input[type="hidden"]')).toHaveValue(/^\/media\/photos\//);
  await page.screenshot({
    path: `/tmp/shared-uploader-${test.info().project.name}.png`,
    fullPage: true,
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload(); // Discard the selected test photo without saving.
});
