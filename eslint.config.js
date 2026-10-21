import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'node:*',
            'electron',
            'fs',
            'path',
            'child_process',
            '../main/*',
            '../preload/*',
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly' },
    },
  },
);
