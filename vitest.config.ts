import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/integration/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.tsx'],
    restoreMocks: true,
  },
});
