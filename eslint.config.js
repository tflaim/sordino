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
