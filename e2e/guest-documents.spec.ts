import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

// Entirely synthetic OCR fixture; never use a real identity document in tests or traces.
async function syntheticDocument(page: Page): Promise<Buffer> {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1900; canvas.height = 850;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black'; context.font = '36px monospace';
    const lines = ['TEST FIXTURE - NOT A VALID DOCUMENT', 'Surname: SAMPLE', 'Given names: TEST PERSON', 'Nationality: UTO', 'Issuing Country: UTO', 'Document Number: TEST12345', 'Date of Birth: 1990-01-01', 'Date of issue: 2020-01-01', 'Expiration Date: 2030-01-01'];
    lines.forEach((line, i) => context.fillText(line, 60, 80 + i * 75));
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(data, 'base64');
}

async function availableDates(request: APIRequestContext) {
  const base = 35 + Math.floor(Date.now() / 1000) % 20;
  for (let offset = base; offset < base + 30; offset += 2) {
    const from = new Date(); from.setDate(from.getDate() + offset);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    const stay = { checkIn: from.toISOString().slice(0, 10), checkOut: to.toISOString().slice(0, 10), adults: 2, children: 0 };
    const response = await request.post('/api/quotes', { data: { ...stay, roomSlug: 'deluxe-sea', addOnIds: [] } });
    const value = await response.json();
    if ((value.quote ?? value).available) return stay;
  }
  throw new Error('No available test stay');
}

async function openBooking(page: Page, request: APIRequestContext) {
  const stay = await availableDates(request);
  await page.goto('/admin/front-desk');
  await expect(async () => {
    await page.getByRole('button', { name: 'Add booking', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add booking', exact: true })).toBeVisible({ timeout: 2000 });
  }).toPass();
  const form = page.getByRole('dialog', { name: 'Add booking', exact: true });
  await form.locator('#fd-new-room-type').click();
  await page.getByRole('option', { name: /^Deluxe Sea View/ }).click();
  for (const day of [stay.checkIn, stay.checkOut]) {
    for (let attempt = 0; attempt < 4 && !(await form.locator(`[data-day="${day}"] button`).isVisible()); attempt++) await form.getByRole('button', { name: 'Go to the Next Month' }).click();
    await form.locator(`[data-day="${day}"] button`).click();
  }
  return form;
}

test('scan, review, attach, view and erase only at actual checkout', async ({ page, request }, testInfo) => {
  test.setTimeout(150_000);
  const email = `document-${testInfo.project.name}-${Date.now()}@example.com`;
  const form = await openBooking(page, request);
  await form.getByRole('button', { name: 'Scan Passport' }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan Passport', exact: true });
  await expect(scanner.getByText('Upload photo', { exact: true })).toBeVisible();
  await scanner.locator('input[type=file]').setInputFiles({ name: 'synthetic-document.png', mimeType: 'image/png', buffer: await syntheticDocument(page) });
  await expect(scanner.getByRole('button', { name: 'Use Photo' })).toBeVisible();
  await scanner.getByRole('button', { name: 'Use Photo' }).click();
  await expect(scanner.getByRole('heading', { name: 'Review Guest Information' })).toBeVisible({ timeout: 60_000 });
  // Real local OCR, no mocked recognition response.
  await expect(scanner.getByLabel('Last Name', { exact: true })).toHaveValue('SAMPLE');
  await expect(scanner.getByLabel('Document Number', { exact: true })).toHaveValue('TEST12345');
  await scanner.getByLabel('Document Number', { exact: true }).fill(`TEST${Date.now()}`);
  await scanner.getByLabel('First Name', { exact: true }).fill('Reviewed Test');
  await scanner.getByLabel('Email', { exact: true }).fill(email);
  await scanner.getByLabel('Phone', { exact: true }).fill('+1234567890');
  await page.screenshot({ path: testInfo.outputPath('review.png') });
  await scanner.getByRole('button', { name: 'Confirm', exact: true }).click();
  // Another synthetic fixture may share the document number; explicitly opt for a separate guest.
  if (await scanner.getByRole('heading', { name: 'Possible existing guest' }).isVisible()) await scanner.getByRole('button', { name: 'Create a separate guest' }).click();
  await expect(form.getByText('Document reviewed. It will be saved with the booking.')).toBeVisible();
  await expect(form.getByLabel('First name', { exact: true })).toHaveValue('Reviewed Test');
  await expect(form.getByRole('button', { name: 'Create booking', exact: true })).toBeEnabled();
  await form.getByRole('button', { name: 'Create booking', exact: true }).click();
  await expect(form).toBeHidden({ timeout: 30_000 });
  await page.goto(`/admin/guests/${encodeURIComponent(email)}?tab=documents`);
  await expect(page.getByRole('heading', { name: 'Reviewed Test SAMPLE', exact: true })).toBeVisible();
  const preview = page.getByRole('button', { name: 'Open document preview' });
  await expect(preview).toBeVisible();
  const src = await preview.locator('img').getAttribute('src');
  const before = await request.get(src!);
  expect(before.status()).toBe(200);
  expect(before.headers()['cache-control']).toContain('no-store');
  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get(`http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3100}${src}`)).status()).not.toBe(200);
  await anonymous.close();
  await preview.click();
  await expect(page.getByRole('dialog', { name: 'Document preview', exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: 'Document preview', exact: true }).getByRole('button', { name: 'Close', exact: true }).last().click();
  const bookingLink = page.locator('article').getByRole('link');
  const reference = (await bookingLink.innerText()).trim();
  await bookingLink.click();
  await page.getByRole('button', { name: 'Change the stay’s status' }).click();
  await page.getByRole('menuitem', { name: 'Check in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change the stay’s status' })).toContainText('Checked in');
  await page.getByRole('button', { name: 'Change the stay’s status' }).click();
  await page.getByRole('menuitem', { name: 'Check out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change the stay’s status' })).toContainText('Checked out');
  expect((await request.get(src!)).status()).toBe(404);
  await page.goto(`/admin/guests/${encodeURIComponent(email)}?tab=documents`);
  await expect(page.getByText('Document image deleted', { exact: true })).toBeVisible();
  await expect(page.getByText('Automatically deleted after Check-out', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: reference, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reviewed Test SAMPLE', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('deleted.png') });
});

test('manual Add Booking and existing guest selection remain available; scanner cancellation preserves input', async ({ page, request }, testInfo) => {
  const form = await openBooking(page, request);
  const email = `manual-${testInfo.project.name}-${Date.now()}@example.com`;
  await form.getByLabel('First name', { exact: true }).fill('Manual');
  await form.getByLabel('Last name', { exact: true }).fill('Guest');
  await form.getByLabel('Email', { exact: true }).fill(email);
  await form.getByLabel('Phone', { exact: true }).fill('+1234567890');
  await form.getByRole('button', { name: 'Scan Passport' }).click();
  await page.getByRole('dialog', { name: 'Scan Passport', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form.getByLabel('First name', { exact: true })).toHaveValue('Manual');
  await form.getByRole('button', { name: 'Create booking', exact: true }).click();
  await expect(form).toBeHidden({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Add booking', exact: true }).click();
  await form.getByLabel('Find existing guest').fill(email);
  await form.getByRole('button', { name: `Manual Guest · ${email}` }).click();
  await expect(form.getByLabel('Email', { exact: true })).toHaveValue(email);
  await expect(form.getByLabel('Last name', { exact: true })).toHaveValue('Guest');
});
