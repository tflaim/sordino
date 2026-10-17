#!/usr/bin/env node
/* global chrome */
// Verification session daemon: holds a Playwright Chromium context with the
// built Sordino extension loaded, plus an optional local fake muted-site server.
// Spoken to over HTTP by control-sordino.mjs. Not for production use.
// `chrome` is referenced only inside page/service-worker evaluate callbacks.
import { createServer as createHttpServer } from 'node:http'
import { createServer as createSiteServer } from 'node:http'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const sessionDir = process.env.SORDINO_VERIFY_DIR
if (!sessionDir) {
  console.error('SORDINO_VERIFY_DIR is required')
  process.exit(1)
}

const logFile = join(sessionDir, 'daemon.log')
const readyFile = process.env.SORDINO_READY_FILE || join(sessionDir, 'ready.json')
function log(line) {
  appendFileSync(logFile, `${line}\n`)
}

const metaPath = join(sessionDir, 'session.json')
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
const dist = resolve(meta.dist)
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
const artifactsDir = meta.artifactsDir
mkdirSync(artifactsDir, { recursive: true })

const pages = new Map() // name -> Page
let ctx
let sw
let extensionId
let fakeServer = null
let fakeHost = null
let fakePort = null

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolveBody({})
      try {
        resolveBody(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

async function ensurePage(name) {
  let page = pages.get(name)
  if (page && !page.isClosed()) return page
  page = await ctx.newPage()
  pages.set(name, page)
  return page
}

async function getPage(name) {
  const page = pages.get(name)
  if (!page || page.isClosed()) throw new Error(`page "${name}" is not open`)
  return page
}

function locator(page, { role, name, selector, text }) {
  if (selector) return page.locator(selector)
  if (role && name) return page.getByRole(role, { name: new RegExp(name) })
  if (text) return page.getByText(new RegExp(text))
  throw new Error('need selector, role+name, or text')
}

async function startFakeHost(host) {
  if (fakeServer) {
    await new Promise((r) => fakeServer.close(r))
    fakeServer = null
  }
  fakeHost = host
  fakeServer = createSiteServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(
        `<!doctype html><title>fake ${host}</title><h1>fake ${host}</h1><p>verification stand-in</p>`
      )
    } else {
      res.writeHead(204).end()
    }
  })
  await new Promise((r) => fakeServer.listen(0, '127.0.0.1', r))
  fakePort = fakeServer.address().port
  return { host: fakeHost, port: fakePort }
}

async function boot() {
  const args = [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-proxy-server',
  ]
  if (meta.mapHost) {
    await startFakeHost(meta.mapHost)
    args.push(`--host-resolver-rules=MAP ${meta.mapHost} 127.0.0.1:${fakePort}`)
  }

  ctx = await chromium.launchPersistentContext(meta.profileDir, {
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : { channel: 'chromium' }),
    headless: !process.env.HEADED,
    args,
  })

  sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 15000 }))
  extensionId = new URL(sw.url()).host

  const ready = {
    pid: process.pid,
    port: meta.port,
    extensionId,
    dist,
    profileDir: meta.profileDir,
    artifactsDir,
    mapHost: meta.mapHost ?? null,
    fakePort,
    popupPath: manifest.action?.default_popup ?? null,
    optionsPath: manifest.options_ui?.page ?? null,
    manifestName: manifest.name,
    readyAt: new Date().toISOString(),
  }
  writeFileSync(metaPath, JSON.stringify({ ...meta, ...ready }, null, 2))
  return ready
}

async function doctor() {
  let alarm = null
  let swOk = false
  try {
    alarm = await sw.evaluate(() => chrome.alarms.get('muting-change'))
    swOk = true
  } catch {
    // alarm stays null; service worker is not answering
  }
  const ok = Boolean(ctx && sw && extensionId && swOk)
  return {
    ok,
    extensionId,
    dist,
    profileDir: meta.profileDir,
    artifactsDir,
    mapHost: fakeHost,
    fakePort,
    manifestName: manifest.name,
    serviceWorkerUrl: sw?.url?.() ?? null,
    mutingChangeAlarm: alarm,
    pages: [...pages.keys()],
    note: ok
      ? 'session owns this Chromium profile; do not drive another verifier against it'
      : 'context or service worker looks dead',
  }
}

const server = createHttpServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${meta.port}`)
    const path = url.pathname
    const body = req.method === 'POST' ? await readBody(req) : {}

    if (path === '/doctor' && req.method === 'GET') {
      return json(res, 200, await doctor())
    }

    if (path === '/popup/open' && req.method === 'POST') {
      const page = await ensurePage('popup')
      const popupPath = manifest.action.default_popup
      await page.goto(`chrome-extension://${extensionId}/${popupPath}`, {
        waitUntil: 'domcontentloaded',
      })
      await page.getByRole('heading', { name: 'Sordino' }).waitFor({ timeout: 5000 })
      return json(res, 200, { ok: true, url: page.url() })
    }

    if (path === '/popup/click' && req.method === 'POST') {
      const page = await getPage('popup')
      const loc = locator(page, body)
      await loc.first().click({ timeout: body.timeoutMs ?? 5000 })
      return json(res, 200, { ok: true })
    }

    if (path === '/popup/fill' && req.method === 'POST') {
      const page = await getPage('popup')
      const loc = locator(page, body)
      await loc.first().fill(body.value ?? '', { timeout: body.timeoutMs ?? 5000 })
      return json(res, 200, { ok: true })
    }

    if (path === '/popup/wait-text' && req.method === 'POST') {
      const page = await getPage('popup')
      await page.getByText(new RegExp(body.pattern)).waitFor({ timeout: body.timeoutMs ?? 5000 })
      return json(res, 200, { ok: true })
    }

    if (path === '/popup/dismiss-tip' && req.method === 'POST') {
      const page = await getPage('popup')
      const tip = page.getByRole('button', { name: 'Got it' })
      if (await tip.count()) await tip.click()
      return json(res, 200, { ok: true })
    }

    if (path === '/popup/close' && req.method === 'POST') {
      const page = pages.get('popup')
      if (page && !page.isClosed()) await page.close()
      pages.delete('popup')
      return json(res, 200, { ok: true })
    }

    if (path === '/popup/open-settings' && req.method === 'POST') {
      const popup = await getPage('popup')
      const optionsPath = manifest.options_ui.page
      const expected = `chrome-extension://${extensionId}/${optionsPath}`
      const optionsOpened = ctx.waitForEvent('page', {
        predicate: (p) => p.url() === expected || p.url().startsWith(expected),
        timeout: body.timeoutMs ?? 5000,
      })
      await popup.locator('button:has(svg.lucide-settings)').click()
      const options = await optionsOpened
      pages.set('options', options)
      await options.waitForLoadState('domcontentloaded')
      await options.getByRole('heading', { name: 'Sordino' }).waitFor({ timeout: 5000 })
      return json(res, 200, { ok: true, url: options.url() })
    }

    if (path === '/options/open' && req.method === 'POST') {
      const page = await ensurePage('options')
      const optionsPath = manifest.options_ui.page
      await page.goto(`chrome-extension://${extensionId}/${optionsPath}`, {
        waitUntil: 'domcontentloaded',
      })
      await page.getByRole('heading', { name: 'Sordino' }).waitFor({ timeout: 5000 })
      return json(res, 200, { ok: true, url: page.url() })
    }

    if (path === '/options/click' && req.method === 'POST') {
      const page = await getPage('options')
      const loc = locator(page, body)
      await loc.first().click({ timeout: body.timeoutMs ?? 5000 })
      return json(res, 200, { ok: true })
    }

    if (path === '/site/open' && req.method === 'POST') {
      const name = body.name ?? 'site'
      const page = await ensurePage(name)
      const target = body.url ?? (fakeHost ? `http://${fakeHost}/` : null)
      if (!target) throw new Error('url required when no mapHost was launched')
      await page.goto(target, { waitUntil: 'domcontentloaded' })
      return json(res, 200, { ok: true, url: page.url() })
    }

    if (path === '/site/wait' && req.method === 'POST') {
      const page = await getPage(body.name ?? 'site')
      const state = body.state ?? 'attached'
      await page.waitForSelector(body.selector, {
        state,
        timeout: body.timeoutMs ?? 5000,
      })
      return json(res, 200, { ok: true })
    }

    if (path === '/site/click' && req.method === 'POST') {
      const page = await getPage(body.pageName ?? body.name ?? 'site')
      const loc = locator(page, body)
      await loc.first().click({ timeout: body.timeoutMs ?? 5000 })
      return json(res, 200, { ok: true })
    }

    if (path === '/site/eval' && req.method === 'POST') {
      const page = await getPage(body.name ?? 'site')
      const result = await page.evaluate(async (expression) => {
        return await eval(expression)
      }, body.expression)
      return json(res, 200, { ok: true, result })
    }

    if (path === '/screenshot' && req.method === 'POST') {
      const page = await getPage(body.page ?? 'site')
      const rel = body.path ?? `${body.page ?? 'site'}.png`
      const abs = resolve(artifactsDir, rel)
      mkdirSync(join(abs, '..'), { recursive: true })
      await page.screenshot({ path: abs, fullPage: Boolean(body.fullPage) })
      return json(res, 200, { ok: true, path: abs })
    }

    if (path === '/aria' && req.method === 'POST') {
      const page = await getPage(body.page ?? 'site')
      const rel = body.path ?? `${body.page ?? 'site'}.aria.txt`
      const abs = resolve(artifactsDir, rel)
      mkdirSync(join(abs, '..'), { recursive: true })
      const snapshot = await page.locator('body').ariaSnapshot()
      writeFileSync(abs, snapshot)
      return json(res, 200, { ok: true, path: abs, snapshot })
    }

    if (path === '/sw/eval' && req.method === 'POST') {
      // Read-only inspection helper for alarms/storage the UI surfaces.
      // Expression is evaluated inside the service worker (e.g. chrome.alarms.get(...)).
      const result = await sw.evaluate(async (expression) => {
        return await eval(expression)
      }, body.expression)
      return json(res, 200, { ok: true, result })
    }

    if (path === '/cleanup' && req.method === 'POST') {
      json(res, 200, { ok: true, stopping: true })
      setTimeout(async () => {
        try {
          for (const page of pages.values()) {
            if (!page.isClosed()) await page.close().catch(() => {})
          }
          if (ctx) await ctx.close().catch(() => {})
          if (fakeServer) await new Promise((r) => fakeServer.close(r))
          if (existsSync(meta.profileDir)) {
            rmSync(meta.profileDir, { recursive: true, force: true })
          }
        } finally {
          process.exit(0)
        }
      }, 50)
      return
    }

    json(res, 404, { ok: false, error: `unknown ${req.method} ${path}` })
  } catch (err) {
    json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

const ready = await boot()
server.listen(meta.port, '127.0.0.1', () => {
  const payload = { event: 'ready', ...ready }
  writeFileSync(readyFile, JSON.stringify(payload, null, 2))
  log(JSON.stringify(payload))
})

process.on('SIGTERM', async () => {
  try {
    if (ctx) await ctx.close()
    if (fakeServer) await new Promise((r) => fakeServer.close(r))
  } finally {
    process.exit(0)
  }
})
