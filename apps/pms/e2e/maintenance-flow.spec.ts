import { expect, test, type BrowserContext } from '@playwright/test';

const hotelUrl = 'http://localhost:3100';

async function signIn(context: BrowserContext, email: string, destination: RegExp) {
  const page = await context.newPage();
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('staysphere');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(destination);
  return page;
}

test('maintenance report, replacement approval and resolution cross role boundaries', async ({ page, browser }) => {
  let createdIssue: { id: string } | undefined;
  await page.context().addCookies([{ name: 'admin-locale', value: 'en', url: hotelUrl }]);
  await page.goto('/admin/housekeeping');
  const roomRow = page.locator('tbody tr').first();
  const roomNumber = (await roomRow.getByRole('link').innerText()).trim();
  await roomRow.getByRole('combobox', { name: 'Assign housekeeper' }).selectOption('housekeeper-demo');

  const housekeeperContext = await browser.newContext();
  await housekeeperContext.addCookies([{ name: 'admin-locale', value: 'en', url: hotelUrl }]);
  const housekeeperPage = await signIn(housekeeperContext, 'housekeeper@asteriacove.example', /\/housekeeper$/);
  try {
    const room = housekeeperPage.getByRole('region', { name: `Номер ${roomNumber}` });
    await expect(room).toBeVisible();
    await room.getByRole('button', { name: 'Сообщить о проблеме' }).click();
    const report = housekeeperPage.getByRole('dialog', { name: 'Сообщить о проблеме' });
    const uploadInput = report.locator('[data-testid="upload-dropzone"] input[type="file"]');
    await uploadInput.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
    await expect(report.getByRole('alert')).toContainText('JPEG, PNG или WebP');

    await report.getByRole('textbox').fill('Кондиционер не охлаждает комнату.');
    await uploadInput.setInputFiles('public/images/hotel/cove.webp');
    await housekeeperPage.route('**/api/housekeeper/maintenance-issues', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }), { times: 1 });
    await report.getByRole('button', { name: 'Отправить сообщение' }).click();
    await expect(report.getByRole('alert')).toContainText('Сервис недоступен');
    await expect(report.getByRole('textbox')).toHaveValue('Кондиционер не охлаждает комнату.');
    await expect(report.getByRole('img', { name: 'Фото неисправности 1' })).toBeVisible();
    await housekeeperPage.unroute('**/api/housekeeper/maintenance-issues');
    await report.getByRole('button', { name: 'Отправить сообщение' }).click();
    await expect(housekeeperPage.getByRole('alert')).toContainText(`Проблема в номере ${roomNumber} успешно отправлена.`);
    const reportsResponse = await housekeeperPage.request.get(`${hotelUrl}/api/housekeeper/maintenance-issues?hotel=asteria-cove`);
    expect(reportsResponse.ok()).toBeTruthy();
    createdIssue = ((await reportsResponse.json()).issues as Array<{ id: string; unitId: string; description: string }>)
      .find((issue) => issue.description === 'Кондиционер не охлаждает комнату.');
  } finally {
    await housekeeperContext.close();
  }

  expect(createdIssue).toBeTruthy();

  const issueId = createdIssue!.id;
  await page.goto(`/admin/maintenance/${issueId}?hotel=asteria-cove`);
  const photoImage = page.locator('img[src*="/api/admin/maintenance-issues/"]').first();
  await expect(photoImage).toBeVisible();
  const photoPath = await photoImage.getAttribute('src');
  expect(photoPath).toContain(`/photos/`);
  const anonymous = await browser.newContext();
  try {
    const anonymousResponse = await anonymous.request.get(`${hotelUrl}${photoPath}`);
    expect([401, 403, 404]).toContain(anonymousResponse.status());
  } finally {
    await anonymous.close();
  }

  await page.getByRole('button', { name: 'Replacement needed' }).click();
  await page.getByLabel('What needs replacing and why?').fill('Replace the failing air-conditioning unit.');
  await page.getByRole('button', { name: 'Request hotelier approval' }).click();
  await expect(page.getByRole('button', { name: 'Mark as fixed' })).toBeDisabled();

  const hotelierContext = await browser.newContext();
  await hotelierContext.addCookies([{ name: 'admin-locale', value: 'en', url: hotelUrl }]);
  const hotelierPage = await signIn(hotelierContext, 'hotelier@asteriacove.example', /\/admin(?:\?|$)/);
  try {
    const notificationResponse = await hotelierPage.request.get(`${hotelUrl}/api/admin/maintenance-notifications?hotel=asteria-cove`);
    expect(notificationResponse.ok()).toBeTruthy();
    expect((await notificationResponse.json()).notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ issueId, href: `/admin/maintenance/${issueId}?hotel=asteria-cove` }),
    ]));

    await hotelierPage.goto(`/admin/maintenance/${issueId}?hotel=asteria-cove`);
    await expect(hotelierPage.getByText('Replacement awaiting approval')).toBeVisible();
    const foreignPhoto = await hotelierPage.request.get(`${hotelUrl}${photoPath!.replace('asteria-cove', 'harbor-house')}`);
    expect([403, 404]).toContain(foreignPhoto.status());
    await hotelierPage.getByRole('button', { name: 'Approve replacement' }).click();
    await expect(hotelierPage.getByText('Replacement approved')).toBeVisible();
  } finally {
    await hotelierContext.close();
  }

  await page.reload();
  await page.getByRole('button', { name: 'Mark as fixed' }).click();
  await expect(page.getByText('Fixed')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Fixed')).toBeVisible();
});
