// Shared setup for the smoke tests: load a built extension into Chromium.
//
// Env: CHROMIUM_PATH  optional Chromium binary (must be full Chromium, not
//                     headless-shell, which cannot load extensions)
//      HEADED=1       run headed
import { chromium } from 'playwright'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// The built extension directory from argv (default: the Chrome build) and its
// manifest. Exits with a FAIL line when the build is missing.
export function builtExtension() {
  const dist = resolve(process.argv[2] ?? '.output/chrome-mv3')
  const manifestPath = join(dist, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error(`FAIL ${manifestPath} not found (run \`npm run build\` first)`)
    process.exit(1)
  }
  return { dist, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) }
}

// Launches Chromium with only this extension loaded and waits for its service
// worker. `close()` shuts the browser and removes the throwaway profile.
export async function launchExtension(dist, extraArgs = []) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'sordino-smoke-'))
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : { channel: 'chromium' }),
    headless: !process.env.HEADED,
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--no-proxy-server',
      ...extraArgs,
    ],
  })
  const close = async () => {
    await ctx.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
  try {
    const sw =
      ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 10000 }))
    return { ctx, sw, close }
  } catch (err) {
    await close()
    throw err
  }
}

// Records page errors and console errors from `page` into `errors`, calling
// `onError` (if given) on each one.
export function collectErrors(page, errors, label = 'page', onError = () => {}) {
  page.on('pageerror', (e) => {
    errors.push(`[${label} pageerror] ${e.name}: ${e.message}`)
    onError()
  })
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(`[${label} console.error] ${m.text()}`)
      onError()
    }
  })
}
