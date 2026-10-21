import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['desktop.spec.ts', 'persistence.spec.ts', 'fontenoy.spec.ts'],
  workers: 1,
  timeout: 45000,
  reporter: 'list',
});
