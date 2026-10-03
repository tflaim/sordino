#!/usr/bin/env node
// Extension smoke test: the overlay must appear on a blocked site.
//
// Loads the built Chrome extension into Chromium, forces blocking on, visits a
// default-blocked host (www.reddit.com, mapped to a local server) and asserts:
//   (a) #sordino-overlay is attached to the page, and
//   (b) no page errors / console errors (e.g. the content script failing to
//       parse with "Cannot use import statement outside a module").
//
// Usage: node tests/e2e/overlay.smoke.mjs [distDir]   (default: .output/chrome-mv3)
// Env:   CHROMIUM_PATH  optional Chromium binary (must be full Chromium, not
//                       headless-shell, which cannot load extensions)
//        HEADED=1       run headed
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const DIST = resolve(process.argv[2] ?? '.output/chrome-mv3')
const HOST = 'www.reddit.com' // in DEFAULT_CATEGORIES (social), so blocked when blocking is on
const OVERLAY = '#sordino-overlay'
const OVERLAY_TIMEOUT_MS = 5000
const SETTLE_MS = 500

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error(`FAIL ${DIST}/manifest.json not found (run \`npm run build\` first)`)
  process.exit(1)
}

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

const userDataDir = mkdtempSync(join(tmpdir(), 'sordino-smoke-'))
const ctx = await chromium.launchPersistentContext(userDataDir, {
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : { channel: 'chromium' }),
  headless: !process.env.HEADED,
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--no-proxy-server',
    `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${port}`,
  ],
})

let exitCode
try {
  const sw =
    ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 10000 }))

  // Force blocking on. Wait for the extension APIs to be bound in the worker
  // (they appear shortly after it starts) and for onInstalled to have written
  // settings: it does a read-modify-write and would clobber an earlier patch.
  const forceBlockingOn = () =>
    sw.evaluate(async () => {
      const KEY = 'sordino_settings'
      if (!globalThis.chrome?.storage) return false
      const s = (await chrome.storage.local.get(KEY))[KEY]
      if (!s?.blockState) return false
      s.blockState = { ...s.blockState, manualOverride: 'on', pausedUntil: null }
      await chrome.storage.local.set({ [KEY]: s })
      return true
    })
  let forced = false
  for (let i = 0; i < 100 && !(forced = await forceBlockingOn()); i++) {
    await new Promise((r) => setTimeout(r, 50))
  }
  if (!forced) throw new Error('sordino_settings never initialised by onInstalled')

  const page = await ctx.newPage()
  const errors = []
  let onError
  const firstError = new Promise((r) => (onError = r))
  page.on('pageerror', (e) => {
    errors.push(`[pageerror] ${e.name}: ${e.message}`)
    onError()
  })
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(`[console.error] ${m.text()}`)
      onError()
    }
  })

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
  console.log(JSON.stringify({ dist: DIST, overlay: overlayPresent, errors }, null, 2))
  console.log(
    pass
      ? `PASS overlay rendered on http://${HOST}/ with no page errors`
      : `FAIL ${overlayPresent ? '' : 'no overlay on blocked site'}${!overlayPresent && errors.length ? '; ' : ''}${errors.length ? `${errors.length} page error(s)` : ''}`
  )
  exitCode = pass ? 0 : 1
} finally {
  await ctx.close()
  server.close()
  rmSync(userDataDir, { recursive: true, force: true })
}
process.exit(exitCode)
