import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: [
    'desktop.spec.ts',
    'persistence.spec.ts',
    'fontenoy.spec.ts',
    'operations.spec.ts',
    'tabletop.spec.ts',
    'aftermath.spec.ts',
    'map-play.spec.ts',
    'player-guide.spec.ts',
    'player-helper.spec.ts',
    'waterloo.spec.ts',
    'waterloo-preparation.spec.ts',
    'fontenoy-operational.spec.ts',
    'simultaneous-recovery.spec.ts',
    'simultaneous-siege.spec.ts',
    'simultaneous-commanders.spec.ts',
  ],
  workers: 1,
  timeout: 45000,
  reporter: 'list',
});
