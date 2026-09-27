import { expect, test } from '@playwright/test';

test('assigned rooms, tablet access, evidence and offline sync', async ({ page }) => {
  await page.goto('/admin/housekeeping');
  const row = page.locator('tbody tr').first();
  const number = (await row.getByRole('link').innerText()).trim();
  await row.getByRole('combobox', { name: 'Назначить хаускипера' }).selectOption('housekeeper-demo');
  await expect(row.getByRole('combobox', { name: 'Назначить хаускипера' })).toHaveValue('housekeeper-demo');

  await page.context().clearCookies();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill('housekeeper@asteriacove.example');
  await page.getByLabel('Password').fill('staysphere');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/housekeeper$/);
  await expect(page.getByRole('heading', { name: 'Мои номера' })).toBeVisible();
  const assigned = page.getByRole('region', { name: `Номер ${number}` });
  await expect(assigned).toBeVisible();
  const floorFilter = page.getByRole('group', { name: 'Этаж' });
  await floorFilter.getByRole('button', { name: /этаж/ }).last().click();
  await expect(assigned).toHaveCount(0);
  await floorFilter.getByRole('button', { name: /Все этажи/ }).click();
  await expect(assigned).toBeVisible();
  await expect(page.getByText('Accounting')).toHaveCount(0);
  await page.goto('/admin/accounting');
  await expect(page).toHaveURL(/\/housekeeper$/);

  await page.context().setOffline(true);
  await assigned.getByRole('button', { name: 'Грязный' }).click();
  await expect(assigned.getByText('Ожидает синхронизации')).toBeVisible();
  await page.context().setOffline(false);
  await expect(assigned.getByText('Ожидает синхронизации')).toHaveCount(0, { timeout: 20_000 });

  await assigned.getByRole('button', { name: 'Чисто' }).click();
  const confirm = assigned.getByRole('button', { name: 'Подтвердить уборку' });
  await expect(confirm).toBeDisabled();
  await assigned.locator('input[type=file]').setInputFiles({ name: 'room.png', mimeType: 'image/png',
    buffer: await page.screenshot({ type: 'png' }) });
  await assigned.getByPlaceholder('Например, не работает лампа').fill('Лампа требует замены');
  await confirm.click();
  await expect(page.getByRole('alert')).toHaveText('Изменения синхронизированы.');
  await expect(assigned.getByText('Ожидает синхронизации')).toHaveCount(0, { timeout: 20_000 });
  await expect(assigned.locator('span').filter({ hasText: 'Чисто' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: `Номер ${number}` }).locator('span').filter({ hasText: 'Чисто' })).toBeVisible();
});
