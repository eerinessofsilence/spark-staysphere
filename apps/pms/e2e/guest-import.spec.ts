import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

function spreadsheet(rows: unknown[][], type: "xls" | "xlsx" = "xls") {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([["First name", "Last name", "Email", "Phone"], ...rows]),
    "Guests",
  );
  return {
    name: `guests.${type}`,
    mimeType: "application/octet-stream",
    buffer: XLSX.write(book, { type: "buffer", bookType: type }) as Buffer,
  };
}

async function openGuests(page: Page) {
  await page.addInitScript(() => localStorage.setItem("admin-tour.seen.v1", "1"));
  await page.goto("/admin/guests");
  await expect(page.getByRole("button", { name: "Import guests", exact: true })).toBeEnabled();
}

test("XLS preview selects guests before importing and real persistence survives reload", async ({
  page,
}, testInfo) => {
  await openGuests(page);
  const email = `import-qa-${testInfo.project.name}-${Date.now()}@example.com`;
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/admin/guests/import", async (route) => {
    requests += 1;
    expect(route.request().postDataJSON().rows).toHaveLength(1);
    expect(route.request().postDataJSON().rows[0].guest.email).toBe(email);
    await gate;
    await route.continue();
  });
  const file = spreadsheet([
    ["Import QA", "Selected", email, "+1234567890"],
    ["Import QA", "Excluded", `excluded-${email}`, "+1234567891"],
    ["Invalid", "Phone", "invalid@example.com", "123"],
    ["Duplicate", "Email", email, "+1234567890"],
  ]);
  await page.getByLabel("Import guests", { exact: true }).setInputFiles(file);
  const review = page.getByRole("dialog", { name: "Review guests" });
  await expect(review).toBeVisible();
  expect(requests).toBe(0);
  await expect(
    review.getByRole("checkbox", { name: "Import Invalid Phone", exact: true }),
  ).toBeDisabled();
  await expect(
    review.getByRole("checkbox", { name: "Import Duplicate Email", exact: true }),
  ).toBeDisabled();
  await review.getByRole("checkbox", { name: "Import Import QA Excluded", exact: true }).uncheck();
  await expect(review.getByText("1 of 4 guests selected")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("guest-import-review.png") });
  await review.getByRole("button", { name: "Continue · 1", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Importing guests…" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Importing guests…" })).toBeVisible();
  release();
  const result = page.getByRole("dialog", { name: "Import complete", exact: true });
  await expect(result.getByText("Added: 1. Already on file: 0. Not imported: 0.")).toBeVisible();
  expect(requests).toBe(1);
  await result
    .getByRole("button", { name: "Done", exact: true })
    .filter({ hasText: "Done" })
    .click();
  await page.goto(`/admin/guests?q=${encodeURIComponent(email)}`);
  await expect(page.getByRole("link", { name: "Import QA Selected" })).toBeVisible();
  await expect(page.getByText(`excluded-${email}`, { exact: true })).toHaveCount(0);
});

test("empty, corrupt files and cancelling preview do not send imports", async ({ page }) => {
  await openGuests(page);
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/admin/guests/import")) requests += 1;
  });
  const input = page.locator('input[type="file"][accept=".xls,.xlsx"]');
  await input.setInputFiles(spreadsheet([]));
  await expect(page.getByText("This spreadsheet has no guest rows.")).toBeVisible();
  await input.setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a workbook"),
  });
  await expect(
    page.getByText("Could not read this file. Choose an XLS or XLSX spreadsheet."),
  ).toBeVisible();
  await input.setInputFiles(spreadsheet([["Test", "Cancel", "cancel@example.com", "+1234567890"]]));
  await page.getByRole("checkbox", { name: "Select all valid guests", exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "Continue · 0", exact: true })).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requests).toBe(0);
});

test("interrupted import shows failure and permits retry without losing the selection", async ({
  page,
}) => {
  await openGuests(page);
  let requests = 0;
  await page.route("**/api/admin/guests/import", async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, json: { error: "failed" } });
      return;
    }
    await route.fulfill({ json: { results: [{ rowNumber: 2, status: "imported" }] } });
  });
  await page
    .getByLabel("Import guests", { exact: true })
    .setInputFiles(spreadsheet([["Test", "Retry", "retry@example.com", "+1234567890"]], "xlsx"));
  await page.getByRole("button", { name: "Continue · 1", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "No guests imported" })).toBeVisible();
  await expect(page.getByText("Added: 0. Already on file: 0. Not imported: 1.")).toBeVisible();
  await page.getByRole("button", { name: "Review remaining guests" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Import Test Retry", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Continue · 1", exact: true }).click();
  await expect(page.getByText("Added: 1. Already on file: 0. Not imported: 0.")).toBeVisible();
});

test("selection across pages is imported in batches with partial-result reporting", async ({
  page,
}) => {
  await openGuests(page);
  const batches: number[][] = [];
  await page.route("**/api/admin/guests/import", async (route) => {
    const rows = route.request().postDataJSON().rows as { rowNumber: number }[];
    batches.push(rows.map((row) => row.rowNumber));
    await route.fulfill({
      json: {
        results: rows.map((row) => ({
          rowNumber: row.rowNumber,
          status: row.rowNumber === 52 ? "failed" : "imported",
        })),
      },
    });
  });
  await page
    .getByLabel("Import guests", { exact: true })
    .setInputFiles(
      spreadsheet(
        Array.from({ length: 52 }, (_, index) => [
          `Guest${index}`,
          "Batch",
          `batch-${index}@example.com`,
          "+1234567890",
        ]),
      ),
    );
  await page.getByRole("checkbox", { name: "Import Guest0 Batch", exact: true }).uncheck();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("51 of 52 guests selected")).toBeVisible();
  await page.getByRole("button", { name: "Continue · 51", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Import completed with issues" })).toBeVisible();
  await expect(page.getByText("Added: 50. Already on file: 0. Not imported: 1.")).toBeVisible();
  expect(batches.map((batch) => batch.length)).toEqual([50, 1]);
  expect(batches.flat()).not.toContain(2);
});
