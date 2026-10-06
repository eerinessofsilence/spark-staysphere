import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
});

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

async function syntheticPassportPhoto(page: Page): Promise<Buffer> {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1500; canvas.height = 2100;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#776757'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(750, 1050); context.rotate(-0.04);
    context.fillStyle = '#e8e5ce'; context.fillRect(-650, -850, 1300, 1700);
    context.fillStyle = '#292929'; context.font = '32px sans-serif';
    context.fillText('TEST PASSPORT — NOT A VALID DOCUMENT', -590, -760);
    context.fillText('Synthetic cover page', -590, -650);
    context.fillRect(-650, -70, 1300, 3);
    context.fillStyle = '#8c8c79'; context.fillRect(-590, 30, 250, 330);
    context.fillStyle = '#292929'; context.font = '28px sans-serif';
    // Bilingual label layout as on an identity page, no perfect colon-delimited fixture.
    context.fillText('Прізвище / Surname', -300, 70);
    context.fillText('ERIKSSON', -300, 120);
    context.fillText('Ім’я / Given names', -300, 180);
    context.fillText('ANNA MARIA', -300, 230);
    context.fillText('Machine readable identity below', -590, 440);
    context.font = '42px monospace';
    context.fillText('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<', -610, 590);
    context.fillText('L898902C36UTO7408122F1204159ZE184226B<<<<<10', -610, 655);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  });
  return Buffer.from(data, 'base64');
}

async function openScanner(page: Page) {
  await page.goto('/admin/front-desk');
  const add = page.getByRole('button', { name: 'Add booking', exact: true });
  const form = page.getByRole('dialog', { name: 'Add booking', exact: true });
  await expect(async () => {
    if (!(await form.isVisible())) await add.click();
    await expect(form).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await form.getByRole('button', { name: 'Scan Passport' }).click();
  return page.getByRole('dialog', { name: 'Scan Passport', exact: true });
}

test('passport photo fills identity from the MRZ, including without createImageBitmap', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { Object.defineProperty(window, 'createImageBitmap', { value: undefined, configurable: true }); });
  const scanner = await openScanner(page);
  await scanner.locator('input[type=file]').setInputFiles({ name: 'synthetic-passport.jpg', mimeType: 'image/jpeg', buffer: await syntheticPassportPhoto(page) });
  await scanner.getByRole('button', { name: 'Use Photo' }).click();
  await expect(scanner.getByRole('heading', { name: 'Review Guest Information' })).toBeVisible({ timeout: 90_000 });
  await expect(scanner.getByLabel('Last Name', { exact: true })).toHaveValue('ERIKSSON');
  await expect(scanner.getByLabel('First Name', { exact: true })).toHaveValue('ANNA MARIA');
  await expect(scanner.getByLabel('Document Number', { exact: true })).toHaveValue('L898902C3');
  await expect(scanner.getByLabel('Date of Birth', { exact: true })).toHaveValue('1974-08-12');
  await expect(scanner.getByLabel('Expiration Date', { exact: true })).toHaveValue('2012-04-15');
  await expect(scanner.getByLabel('Issuing Country', { exact: true })).toHaveValue('UTO');
  await expect(scanner.getByRole('alert')).toHaveCount(0);
});

test('unavailable recognition shows an explanation above editable review fields', async ({ page }) => {
  const scanner = await openScanner(page);
  await page.route('**/vendor/document-ocr/eng.traineddata.gz', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await scanner.locator('input[type=file]').setInputFiles({ name: 'synthetic-document.png', mimeType: 'image/png', buffer: await syntheticDocument(page) });
  await scanner.getByRole('button', { name: 'Use Photo' }).click();
  const message = scanner.getByRole('alert');
  await expect(message).toContainText('Recognition was unavailable', { timeout: 60_000 });
  await expect(message).toBeInViewport();
  await expect(scanner.getByLabel('First Name', { exact: true })).toBeEditable();
});

test('an unreadable photo explains the empty result at the top of the review', async ({ page }) => {
  test.setTimeout(120_000);
  const scanner = await openScanner(page);
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black'; context.font = '40px sans-serif';
    context.fillText('NO IDENTITY DOCUMENT IN THIS PHOTO', 60, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await scanner.locator('input[type=file]').setInputFiles({ name: 'no-document.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await scanner.getByRole('button', { name: 'Use Photo' }).click();
  const message = scanner.getByRole('alert');
  await expect(message).toContainText('No document details could be read', { timeout: 90_000 });
  await expect(message).toBeInViewport();
  await expect(scanner.getByLabel('First Name', { exact: true })).toHaveValue('');
  await expect(scanner.getByLabel('Document Number', { exact: true })).toHaveValue('');
});

async function availableDates(request: APIRequestContext) {
  const base = 35 + Math.floor(Date.now() / 1000) % 20;
  for (let offset = base; offset < base + 30; offset += 2) {
    const from = new Date(); from.setDate(from.getDate() + offset);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    const stay = { checkIn: from.toISOString().slice(0, 10), checkOut: to.toISOString().slice(0, 10), adults: 2, children: 0 };
    const response = await request.post('/api/quotes', { data: { ...stay, roomSlug: 'deluxe-sea', addOnIds: [] } });
    const value = await response.json();
    if ((value.quote ?? value).available) return { ...stay, roomTypeId: (value.quote ?? value).roomTypeId as string };
  }
  throw new Error('No available test stay');
}

async function openBooking(page: Page, request: APIRequestContext) {
  const stay = await availableDates(request);
  await page.goto('/admin/front-desk');
  const roomName = await page.locator(`[role="group"]:has(a[href="/admin/content/rooms/${stay.roomTypeId}"])`).getAttribute('aria-label');
  expect(roomName).toBeTruthy();
  await expect(async () => {
    await page.getByRole('button', { name: 'Add booking', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add booking', exact: true })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  const form = page.getByRole('dialog', { name: 'Add booking', exact: true });
  await form.locator('#fd-new-room-type').click();
  await page.getByRole('option', { name: roomName!, exact: true }).click();
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
  const preview = page.getByRole('button', { name: 'Open document for Reviewed Test SAMPLE', exact: true });
  await expect(preview).toBeVisible();
  const src = await preview.locator('img').getAttribute('src');
  const before = await request.get(src!);
  expect(before.status()).toBe(200);
  expect(before.headers()['cache-control']).toContain('no-store');
  const anonymous = await page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
  expect((await anonymous.cookies()).length).toBe(0);
  expect((await anonymous.request.get(`http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3100}${src}`, { maxRedirects: 0 })).status()).not.toBe(200);
  await anonymous.close();
  await preview.click();
  const documentModal = page.getByRole('dialog', { name: 'Passport', exact: true });
  await expect(documentModal).toBeVisible();
  const bookingLink = documentModal.locator('a[href^="/admin/bookings/"]');
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
  await expect(page.getByText('Deleted after checkout', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open document for Reviewed Test SAMPLE', exact: true }).click();
  await expect(documentModal.getByText('Deleted', { exact: true })).toBeVisible();
  await expect(documentModal.getByRole('link', { name: reference, exact: true })).toBeVisible();
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
