import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'dev.spec.ts',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  webServer: {
    command: 'npx vite --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
