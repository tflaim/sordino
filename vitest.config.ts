import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

// Local days (Pause "rest of today", schedules, Usage) come from the process
// time zone, so tests pin one. Europe/London has a daylight-saving change.
process.env.TZ = 'Europe/London'

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
