import { defineConfig } from '@playwright/test';
import fullConfig from './playwright.config';

/** Booking, inventory, CMS persistence and staff access are the PR gate. */
export default defineConfig({
  ...fullConfig,
  testMatch: [
    '**/cabinet.spec.ts',
    '**/cms.spec.ts',
    '**/inventory.spec.ts',
    '**/housekeeper.spec.ts',
    '**/maintenance-flow.spec.ts',
  ],
  projects: fullConfig.projects?.filter((project) => project.name !== 'tablet').map((project) => ({
    ...project,
    // API contracts are identical in both viewports; exercise them once.
    testIgnore: project.name === 'mobile' ? ['**/inventory.spec.ts'] : undefined,
  })),
});
