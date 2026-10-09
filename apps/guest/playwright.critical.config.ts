import { defineConfig } from '@playwright/test';
import fullConfig from './playwright.config';

/** Keep the booking journey and PMS boundary mandatory in pull requests. */
export default defineConfig({
  ...fullConfig,
  testMatch: ['**/golden-path.spec.ts', '**/inventory.spec.ts', '**/pms-published-gallery.spec.ts'],
  grep: /a lost PMS response|a changed price|a guest can complete|a trip is claimed|a guest cancels|PMS-published|a guest can book the exact|replaying the same|the same room cannot|a room belonging|a malformed room|booking without choosing|booking lookups keep/,
  projects: fullConfig.projects?.map((project) => ({
    ...project,
    testIgnore: project.name === 'mobile' ? ['**/inventory.spec.ts'] : undefined,
  })),
});
