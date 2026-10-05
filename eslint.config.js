import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.output/', '.wxt/', 'node_modules/', '.agents/', '.claude/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // Only the background writes storage (ADR-0004): every other context gets
    // the read-only port from `chrome-storage-reader`.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/entrypoints/background.ts', 'src/store/adapters/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/chrome-storage'],
              message:
                'Only the background store writes storage. Read through chromeStorageReader and send commands.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs}', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Smoke tests also pass callbacks to page.evaluate / sw.evaluate, which run
    // in the page or the extension's service worker.
    files: ['tests/e2e/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.webextensions } },
  },
  prettier
)
