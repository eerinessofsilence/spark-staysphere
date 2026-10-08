import { expect, test, type BrowserContext, type Page } from '@playwright/test';

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
    await report.locator('input[type="file"]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
    await expect(report.getByText(/JPEG|PNG|WebP/)).toBeVisible();

    await report.getByRole('textbox').fill('Кондиционер не охлаждает комнату.');
    await report.locator('input[type="file"]').setInputFiles('../pms/public/images/hotel/cove.webp');
    await housekeeperPage.route('**/api/housekeeper/maintenance-issues', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }), { times: 1 });
    await report.getByRole('button', { name: 'Отправить сообщение' }).click();
    await expect(report.getByRole('alert')).toContainText('Сервис недоступен');
    await expect(report.getByRole('textbox')).toHaveValue('Кондиционер не охлаждает комнату.');
    await expect(report.locator('input[type="file"]')).toHaveValue(/cove\.webp/);
    await housekeeperPage.unroute('**/api/housekeeper/maintenance-issues');
    await report.getByRole('button', { name: 'Отправить сообщение' }).click();
    await expect(housekeeperPage.getByRole('alert')).toContainText(`Проблема в номере ${roomNumber} успешно отправлена.`);
  } finally {
    await housekeeperContext.close();
  }

  const reportsResponse = await page.request.get('http://localhost:3100/api/housekeeper/maintenance-issues?hotel=asteria-cove');
  expect(reportsResponse.ok()).toBeTruthy();
  const createdIssue = ((await reportsResponse.json()).issues as Array<{ id: string; unitId: string; photos: Array<{ id: string }> }>)
    .find((issue) => issue.unitId === awaitRoomId(roomRow));
  expect(createdIssue).toBeTruthy();

  await page.goto('/admin/maintenance?hotel=asteria-cove');
  const issueLink = page.getByRole('link', { name: roomNumber }).last();
  await issueLink.click();
  const issueUrl = new URL(page.url());
  const issueId = issueUrl.pathname.split('/').at(-1)!;
  const photo = createdIssue!.photos[0]!;
  const photoPath = `/api/admin/maintenance-issues/${issueId}/photos/${photo.id}?hotel=asteria-cove`;
  const anonymous = await browser.newContext();
  try {
    const anonymousResponse = await anonymous.request.get(`${hotelUrl}${photoPath}`);
    expect([401, 403, 404]).toContain(anonymousResponse.status());
  } finally {
    await anonymous.close();
  }

  await page.getByRole('button', { name: 'Replacement needed' }).click();
  await page.getByLabel('Replacement reason').fill('Replace the failing air-conditioning unit.');
  await page.getByRole('button', { name: 'Send replacement request' }).click();
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
    await expect(hotelierPage.getByText('Replacement approval required')).toBeVisible();
    const foreignPhoto = await hotelierPage.request.get(`${hotelUrl}${photoPath.replace('asteria-cove', 'harbor-house')}`);
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

async function awaitRoomId(row: ReturnType<Page['locator']>): Promise<string> {
  return (await row.getAttribute('data-unit-id')) ?? (await row.locator('[data-unit-id]').getAttribute('data-unit-id')) ?? '';
}
