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
// Env:   see harness.mjs
import { builtExtension, collectErrors, launchExtension } from './harness.mjs'

const { dist: DIST, manifest } = builtExtension()
const FONTS = ['16px "DM Sans"', '16px "Cormorant Garamond"']
const SETTLE_MS = 500

const { ctx, sw, close } = await launchExtension(DIST)

const failures = []
const offDevice = []
const errors = []
const isOnDevice = (url) => /^(chrome-extension|data|blob):/.test(url)

ctx.on('request', (req) => {
  if (!isOnDevice(req.url())) offDevice.push(req.url())
})
const fontsRendered = (page) =>
  page.evaluate(async (fonts) => {
    await Promise.all(fonts.map((f) => document.fonts.load(f)))
    return Object.fromEntries(fonts.map((f) => [f, document.fonts.check(f)]))
  }, FONTS)

let exitCode
try {
  const base = `chrome-extension://${new URL(sw.url()).host}`

  const popupPath = manifest.action?.default_popup
  const optionsPath = manifest.options_ui?.page
  if (!popupPath) failures.push('manifest has no action.default_popup')
  if (!optionsPath) failures.push('manifest has no options_ui.page')

  if (popupPath && optionsPath) {
    const popup = await ctx.newPage()
    collectErrors(popup, errors, 'popup')
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
      collectErrors(options, errors, 'options')
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
  await close()
}
process.exit(exitCode)
