#!/usr/bin/env node
// Install Playwright's Chromium for the version pinned in package.json.
// Do not use bare `npx playwright install` — that can resolve a newer CLI than
// the repo pin. On macOS Playwright's extractor has hung for minutes while
// writing Assets.car; this wrapper times out and falls back to curl + system
// extract (ditto on macOS, unzip elsewhere), then verifies the binary.
import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const DEFAULT_TIMEOUT_MS = 240_000

function pinnedPlaywrightVersion() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  const raw = pkg.devDependencies?.playwright ?? pkg.dependencies?.playwright
  if (!raw) {
    console.error('FAIL package.json has no playwright dependency')
    process.exit(1)
  }
  return String(raw).replace(/^[\^~]/, '')
}

function runCaptured(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...opts,
  })
  return res
}

function parseChromiumDryRun(text) {
  // Split on browser headers; keep the name on each chunk.
  const chunks = text
    .split(/(?=^browser:\s+)/m)
    .map((c) => c.trim())
    .filter(Boolean)
  const chromium = chunks.find(
    (c) => /^browser:\s+chromium\b/i.test(c) && !/^browser:\s+chromium-/i.test(c)
  )
  if (!chromium) {
    throw new Error('dry-run output had no chromium browser block')
  }
  const location = chromium.match(/Install location:\s+(\S+)/)?.[1]
  const urls = [...chromium.matchAll(/Download(?: url| fallback \d+):\s+(\S+)/g)].map((m) => m[1])
  if (!location || urls.length === 0) {
    throw new Error('dry-run missing Install location or Download url')
  }
  return { location, urls, versionLine: chromium.split('\n')[0]?.trim() }
}

function findChromeBinary(installLocation) {
  const candidates = [
    join(installLocation, 'chrome-linux', 'chrome'),
    join(installLocation, 'chrome-linux64', 'chrome'),
    join(installLocation, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    join(installLocation, 'chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    join(installLocation, 'chrome-mac-x64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  // Last resort: shallow search for an executable named chrome/Chromium.
  const stack = [installLocation]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      const p = join(dir, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (name !== 'Code Resources' && name !== '.git') stack.push(p)
      } else if (name === 'chrome' || name === 'Chromium') {
        return p
      }
    }
  }
  return null
}

function verifyBrowser(installLocation) {
  const binary = findChromeBinary(installLocation)
  if (!binary) {
    throw new Error(`no chrome/Chromium binary under ${installLocation}`)
  }
  const ver = runCaptured(binary, ['--version'], {
    env: { ...process.env, HOME: process.env.HOME },
  })
  if (ver.status !== 0) {
    throw new Error(
      `browser --version failed (status ${ver.status}): ${ver.stderr || ver.stdout || ''}`.trim()
    )
  }
  const versionText = (ver.stdout || ver.stderr || '').trim()
  console.log(JSON.stringify({ event: 'browser-verify', binary, version: versionText }))
  return { binary, versionText }
}

function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true })
  if (process.platform === 'darwin') {
    // macOS: ditto handles Chromium zips (including Assets.car) more reliably
    // than Playwright's Node extractor / plain unzip on some machines.
    const res = runCaptured('ditto', ['-x', '-k', zipPath, destDir])
    if (res.status !== 0) {
      throw new Error(`ditto failed: ${res.stderr || res.stdout || res.status}`)
    }
    return 'ditto -x -k'
  }
  const res = runCaptured('unzip', ['-q', '-o', zipPath, '-d', destDir])
  if (res.status !== 0) {
    throw new Error(`unzip failed: ${res.stderr || res.stdout || res.status}`)
  }
  return 'unzip'
}

function downloadTo(url, destFile) {
  const res = runCaptured('curl', ['-fsSL', '--retry', '3', '-o', destFile, url])
  if (res.status !== 0) {
    throw new Error(`curl failed for ${url}: ${res.stderr || res.status}`)
  }
}

async function fallbackInstall(info, version, reason) {
  console.log(
    JSON.stringify({
      event: 'install-fallback',
      reason,
      platform: process.platform,
      extractor: process.platform === 'darwin' ? 'ditto -x -k' : 'unzip',
      location: info.location,
    })
  )
  const work = mkdtempSync(join(tmpdir(), 'sordino-pw-fallback-'))
  const zipPath = join(work, 'chromium.zip')
  let lastErr
  for (const url of info.urls) {
    try {
      console.log(JSON.stringify({ event: 'fallback-download', url }))
      downloadTo(url, zipPath)
      lastErr = null
      break
    } catch (err) {
      lastErr = err
    }
  }
  if (lastErr) throw lastErr

  // Replace a partial Playwright extract (e.g. stuck Assets.car) cleanly.
  rmSync(info.location, { recursive: true, force: true })
  mkdirSync(info.location, { recursive: true })
  const extractor = extractZip(zipPath, info.location)
  writeFileSync(join(info.location, 'INSTALLATION_COMPLETE'), '')
  const verified = verifyBrowser(info.location)
  rmSync(work, { recursive: true, force: true })
  console.log(
    JSON.stringify({
      event: 'install-ok',
      playwright: version,
      via: 'fallback',
      extractor,
      ...verified,
    })
  )
}

function killInstallTree(child) {
  if (!child.pid) return
  try {
    // Kill the whole process group so oop download workers do not keep writing
    // to a closed pipe (EPIPE) after we move on to the fallback extractor.
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    try {
      child.kill('SIGKILL')
    } catch {
      /* already gone */
    }
  }
}

function officialInstall(cliJs, timeoutMs) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [cliJs, 'install', 'chromium'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      detached: process.platform !== 'win32',
    })
    let settled = false
    const forward = (buf) => {
      if (!settled) process.stdout.write(buf)
    }
    child.stdout?.on('data', forward)
    child.stderr?.on('data', forward)
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdout?.destroy()
      child.stderr?.destroy()
      resolvePromise(result)
    }
    const timer = setTimeout(() => {
      killInstallTree(child)
      finish({ ok: false, reason: `timeout after ${timeoutMs}ms` })
    }, timeoutMs)
    child.on('exit', (code, signal) => {
      if (code === 0) finish({ ok: true })
      else finish({ ok: false, reason: signal ? `signal ${signal}` : `exit ${code}` })
    })
    child.on('error', (err) => finish({ ok: false, reason: err.message }))
  })
}

const version = pinnedPlaywrightVersion()
const cliJs = join(REPO_ROOT, 'node_modules', 'playwright', 'cli.js')
const cliBin = join(REPO_ROOT, 'node_modules', '.bin', 'playwright')
if (!existsSync(cliJs)) {
  console.error(
    `FAIL ${cliJs} missing — run \`npm ci\` so playwright@${version} is present, then retry.`
  )
  process.exit(1)
}

const dry = runCaptured(process.execPath, [cliJs, 'install', '--dry-run', 'chromium'])
if (dry.status !== 0) {
  console.error(`FAIL playwright install --dry-run failed:\n${dry.stderr || dry.stdout}`)
  process.exit(1)
}
const info = parseChromiumDryRun(`${dry.stdout}\n${dry.stderr}`)

const timeoutMs = Number(process.env.SORDINO_PLAYWRIGHT_INSTALL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
const forceFallback = process.env.SORDINO_PLAYWRIGHT_FORCE_FALLBACK === '1'

console.log(
  JSON.stringify({
    event: 'install-start',
    playwright: version,
    cli: cliJs,
    timeoutMs,
    forceFallback,
    installLocation: info.location,
    // macOS cache is under ~/Library/Caches/ms-playwright/ (not ~/.cache).
    platform: process.platform,
  })
)

try {
  if (forceFallback) {
    await fallbackInstall(info, version, 'SORDINO_PLAYWRIGHT_FORCE_FALLBACK=1')
    process.exit(0)
  }

  const result = await officialInstall(cliJs, timeoutMs)
  if (result.ok) {
    const verified = verifyBrowser(info.location)
    console.log(
      JSON.stringify({ event: 'install-ok', playwright: version, via: 'playwright', ...verified })
    )
    process.exit(0)
  }

  console.error(
    `WARN official playwright install failed (${result.reason}); falling back to curl + ${
      process.platform === 'darwin' ? 'ditto' : 'unzip'
    }`
  )
  await fallbackInstall(info, version, result.reason)
  process.exit(0)
} catch (err) {
  console.error(`FAIL Chromium install: ${err instanceof Error ? err.message : err}`)
  console.error(`
Pinned Playwright: ${version} (from package.json). CLI: ${cliBin}

macOS note: cache dir is ~/Library/Caches/ms-playwright/chromium-<revision>/
Linux note: cache dir is ~/.cache/ms-playwright/chromium-<revision>/

If fallback also failed, dry-run URLs with:
  ${cliBin} install --dry-run chromium
then curl the zip, extract with ditto -x -k (macOS) or unzip (Linux) into the
Install location, touch INSTALLATION_COMPLETE, and re-run this script.
`)
  process.exit(1)
}
