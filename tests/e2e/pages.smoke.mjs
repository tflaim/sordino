#!/usr/bin/env node
// Extension pages smoke test: popup and settings stay on the device.
//
// Loads the built Chrome extension into Chromium, opens the popup and the
// settings (options) page, and asserts:
//   (a) every request either page makes stays inside the extension (fonts are
//       self-hosted; nothing leaves the browser),
//   (b) the self-hosted fonts actually render,
//   (c) the popup's settings button opens the options page (the browser's
//       Options entry), and
//   (d) no page errors / console errors.
//
// Usage: node tests/e2e/pages.smoke.mjs [distDir]   (default: .output/chrome-mv3)
// Env:   CHROMIUM_PATH  optional Chromium binary (must be full Chromium, not
//                       headless-shell, which cannot load extensions)
//        HEADED=1       run headed
import { chromium } from 'playwright'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const DIST = resolve(process.argv[2] ?? '.output/chrome-mv3')
const FONTS = ['16px "DM Sans"', '16px "Cormorant Garamond"']
const SETTLE_MS = 500

const manifestPath = join(DIST, 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`FAIL ${manifestPath} not found (run \`npm run build\` first)`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const userDataDir = mkdtempSync(join(tmpdir(), 'sordino-pages-'))
const ctx = await chromium.launchPersistentContext(userDataDir, {
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : { channel: 'chromium' }),
  headless: !process.env.HEADED,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-proxy-server'],
})

const failures = []
const offDevice = []
const errors = []
const isOnDevice = (url) => /^(chrome-extension|data|blob):/.test(url)

ctx.on('request', (req) => {
  if (!isOnDevice(req.url())) offDevice.push(req.url())
})
const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`[${label} pageerror] ${e.name}: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label} console.error] ${m.text()}`)
  })
}
const fontsRendered = (page) =>
  page.evaluate(async (fonts) => {
    await Promise.all(fonts.map((f) => document.fonts.load(f)))
    return Object.fromEntries(fonts.map((f) => [f, document.fonts.check(f)]))
  }, FONTS)

let exitCode
try {
  const sw =
    ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 10000 }))
  const base = `chrome-extension://${new URL(sw.url()).host}`

  const popupPath = manifest.action?.default_popup
  const optionsPath = manifest.options_ui?.page
  if (!popupPath) failures.push('manifest has no action.default_popup')
  if (!optionsPath) failures.push('manifest has no options_ui.page')

  if (popupPath && optionsPath) {
    const popup = await ctx.newPage()
    watch(popup, 'popup')
    await popup.goto(`${base}/${popupPath}`, { waitUntil: 'networkidle' })
    const popupFonts = await fontsRendered(popup)

    const optionsOpened = ctx.waitForEvent('page', {
      predicate: (p) => p.url() === `${base}/${optionsPath}`,
      timeout: 5000,
    })
    await popup.click('button:has(svg.lucide-settings)')
    const options = await optionsOpened.catch(() => null)
    if (!options) failures.push('settings button did not open the options page')

    let optionsFonts = {}
    if (options) {
      watch(options, 'options')
      await options.waitForLoadState('networkidle')
      optionsFonts = await fontsRendered(options)
    }
    await popup.waitForTimeout(SETTLE_MS) // catch late requests and errors

    for (const [label, fonts] of [
      ['popup', popupFonts],
      ['options', optionsFonts],
    ]) {
      for (const [font, ok] of Object.entries(fonts)) {
        if (!ok) failures.push(`${label}: font ${font} did not load`)
      }
    }
    console.log(
      JSON.stringify({ dist: DIST, popupFonts, optionsFonts, offDevice, errors }, null, 2)
    )
  }

  if (offDevice.length) failures.push(`${offDevice.length} request(s) left the device`)
  if (errors.length) failures.push(`${errors.length} page error(s)`)
  console.log(
    failures.length === 0
      ? 'PASS popup and settings load with self-hosted fonts, no network requests and no errors'
      : `FAIL ${failures.join('; ')}`
  )
  exitCode = failures.length === 0 ? 0 : 1
} finally {
  await ctx.close()
  rmSync(userDataDir, { recursive: true, force: true })
}
process.exit(exitCode)
