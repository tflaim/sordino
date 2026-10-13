#!/usr/bin/env node
// Extension smoke test: the overlay must appear on a blocked site.
//
// Loads the built Chrome extension into Chromium, presses "Mute now · 1 hour"
// in the popup, visits a default-muted host (www.reddit.com, mapped to a local
// server) and asserts:
//   (a) the Mute now reached the store: its end alarm is set,
//   (b) #sordino-overlay is attached to the page, and
//   (c) no page errors / console errors (e.g. the content script failing to
//       parse with "Cannot use import statement outside a module").
//
// Usage: node tests/e2e/overlay.smoke.mjs [distDir]   (default: .output/chrome-mv3)
// Env:   see harness.mjs
import { createServer } from 'node:http'
import { builtExtension, collectErrors, launchExtension } from './harness.mjs'

const { dist: DIST, manifest } = builtExtension()
const HOST = 'www.reddit.com' // in DEFAULT_CATEGORIES (social), so muted while muting is in effect
const OVERLAY = '#sordino-overlay'
const OVERLAY_TIMEOUT_MS = 5000
const SETTLE_MS = 500

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<!doctype html><title>fake reddit</title><h1>fake reddit</h1>')
  } else {
    res.writeHead(204).end() // favicon etc.: no 404 console noise
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const { ctx, sw, close } = await launchExtension(DIST, [
  `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${port}`,
])

let exitCode
try {
  // Start Mute now from the popup, as a user would: popup -> store command ->
  // write + effects. The reply arrives once the alarms have been applied.
  const popup = await ctx.newPage()
  await popup.goto(`chrome-extension://${new URL(sw.url()).host}/${manifest.action.default_popup}`)
  await popup.getByRole('button', { name: /^Mute now for 1 hour/ }).click()
  await popup.getByText(/^Muting until .* · Mute now$/).waitFor({ timeout: 5000 })
  const alarm = await sw.evaluate(() => chrome.alarms.get('muting-change'))
  if (!alarm) throw new Error('Mute now set no muting-change alarm')
  await popup.close()

  const page = await ctx.newPage()
  const errors = []
  let onError
  const firstError = new Promise((r) => (onError = r))
  collectErrors(page, errors, 'page', onError)

  await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded' })

  // Fail fast on the first error; otherwise wait for the overlay.
  const overlay = await Promise.race([
    page.waitForSelector(OVERLAY, { state: 'attached', timeout: OVERLAY_TIMEOUT_MS }).then(
      () => true,
      () => false
    ),
    firstError.then(() => false),
  ])
  await page.waitForTimeout(SETTLE_MS) // catch late errors
  const overlayPresent = overlay || (await page.$(OVERLAY)) !== null

  const pass = overlayPresent && errors.length === 0
  console.log(
    JSON.stringify(
      { dist: DIST, alarm: alarm.scheduledTime, overlay: overlayPresent, errors },
      null,
      2
    )
  )
  console.log(
    pass
      ? `PASS overlay rendered on http://${HOST}/ with no page errors`
      : `FAIL ${overlayPresent ? '' : 'no overlay on muted site'}${!overlayPresent && errors.length ? '; ' : ''}${errors.length ? `${errors.length} page error(s)` : ''}`
  )
  exitCode = pass ? 0 : 1
} finally {
  await close()
  server.close()
}
process.exit(exitCode)
