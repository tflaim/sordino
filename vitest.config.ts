import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // The 1.x code has no tests and none are ported (replace, don't layer);
    // the first tests arrive with the Sordino store.
    passWithNoTests: true,
  },
})
