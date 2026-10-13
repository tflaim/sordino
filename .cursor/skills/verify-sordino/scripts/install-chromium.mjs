#!/usr/bin/env node
// Install Playwright's Chromium for the version pinned in package.json.
// Do not use bare `npx playwright install` — that can resolve a newer CLI than
// the repo pin and on macOS has been seen to hang for many minutes while writing
// Assets.car. This wrapper uses the local package and fails clearly on hang.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../..')
const DEFAULT_TIMEOUT_MS = 240_000 // 4 minutes — Assets.car hangs often exceed this

function pinnedPlaywrightVersion() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  const raw = pkg.devDependencies?.playwright ?? pkg.dependencies?.playwright
  if (!raw) {
    console.error('FAIL package.json has no playwright dependency')
    process.exit(1)
  }
  // Exact pin expected (e.g. "1.56.1"); strip a leading ^/~ if present.
  return String(raw).replace(/^[\^~]/, '')
}

function printManualUnzipHelp(version, timeoutSec) {
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'playwright')
  console.error(`
FAIL playwright install chromium did not finish within ${timeoutSec}s.
On macOS this often hangs while writing Assets.car after the zip download
completes (Playwright's extractor stalls; the download itself is fine).

This skill requires the repo pin playwright@${version} — never bare
\`npx playwright install\`, which can pull a different version.

Manual-unzip workaround:
  1. Kill any hung install process.
  2. From the repo root, print the exact URLs and cache paths for this pin:
       ${cli} install --dry-run chromium
  3. curl the Chromium zip for your OS (the first Download url) to a temp file.
  4. unzip it into the printed Install location, e.g. on macOS:
       ~/Library/Caches/ms-playwright/chromium-<revision>/
     or on Linux: ~/.cache/ms-playwright/chromium-<revision>/
  5. Mark the install complete so Playwright skips its own extractor:
       touch <install-location>/INSTALLATION_COMPLETE
  6. Re-run:
       node .cursor/skills/verify-sordino/scripts/install-chromium.mjs

Optional: raise the wait with SORDINO_PLAYWRIGHT_INSTALL_TIMEOUT_MS (ms).
`)
}

const version = pinnedPlaywrightVersion()
const cliJs = join(REPO_ROOT, 'node_modules', 'playwright', 'cli.js')
if (!existsSync(cliJs)) {
  console.error(
    `FAIL ${cliJs} missing — run \`npm install\` so playwright@${version} is present, then retry.`
  )
  process.exit(1)
}

const timeoutMs = Number(process.env.SORDINO_PLAYWRIGHT_INSTALL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
const timeoutSec = Math.round(timeoutMs / 1000)

console.log(
  JSON.stringify({
    event: 'install-start',
    playwright: version,
    cli: cliJs,
    timeoutMs,
    args: ['install', 'chromium'],
  })
)

const child = spawn(process.execPath, [cliJs, 'install', 'chromium'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: process.env,
})

let settled = false
const timer = setTimeout(() => {
  if (settled) return
  settled = true
  child.kill('SIGTERM')
  setTimeout(() => {
    try {
      child.kill('SIGKILL')
    } catch {
      /* already gone */
    }
  }, 2000)
  printManualUnzipHelp(version, timeoutSec)
  process.exit(1)
}, timeoutMs)

child.on('exit', (code, signal) => {
  if (settled) return
  settled = true
  clearTimeout(timer)
  if (signal) {
    console.error(`FAIL playwright install exited from signal ${signal}`)
    process.exit(1)
  }
  if (code !== 0) {
    console.error(`FAIL playwright install exited with code ${code}`)
    printManualUnzipHelp(version, timeoutSec)
    process.exit(code ?? 1)
  }
  console.log(JSON.stringify({ event: 'install-ok', playwright: version }))
  process.exit(0)
})

child.on('error', (err) => {
  if (settled) return
  settled = true
  clearTimeout(timer)
  console.error(`FAIL could not start playwright CLI: ${err.message}`)
  process.exit(1)
})
