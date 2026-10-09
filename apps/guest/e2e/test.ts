import { test as base, expect } from '@playwright/test';

export * from '@playwright/test';

export const test = base.extend<{ pmsClient: void }>({
  pmsClient: [async ({ request }, use) => {
    const controlPort = Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 101;
    const response = await request.post(`http://127.0.0.1:${controlPort}/client`);
    expect(response.ok(), 'the test proxy allocates an isolated PMS client').toBeTruthy();
    await use();
  }, { auto: true }],
});
