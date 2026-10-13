#!/usr/bin/env node
// control-sordino — drive a disposable Chromium session with the built Sordino
// extension loaded. See ../SKILL.md for launch/doctor/drive/evidence/cleanup.
import { spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../..')
const DEFAULT_DIST = join(REPO_ROOT, '.output/chrome-mv3')
const DEFAULT_ARTIFACTS_ROOT = join(REPO_ROOT, '.cursor/skills/verify-sordino/artifacts')

function usage(exitCode = 1) {
  console.error(`Usage:
  control-sordino launch [--dist <dir>] [--map-host <host>] [--run-id <id>]
  control-sordino doctor
  control-sordino popup open|close|dismiss-tip|open-settings
  control-sordino popup click --role <role> --name <regex>
  control-sordino popup fill --selector <sel> --value <text>
  control-sordino popup wait-text --pattern <regex>
  control-sordino options open
  control-sordino options click --role <role> --name <regex>
  control-sordino site open [--url <url>] [--name site]
  control-sordino site wait --selector <sel> [--state attached|detached]
  control-sordino site click --selector <sel> | --role <role> --name <regex>
  control-sordino site eval --expr <js>
  control-sordino screenshot --page <name> --path <relpath>
  control-sordino aria --page <name> --path <relpath>
  control-sordino sw-eval --expr <js>
  control-sordino cleanup

Env:
  SORDINO_VERIFY_DIR   session dir (set by launch; required for later commands)
  CHROMIUM_PATH        optional full Chromium binary (not headless-shell)
  HEADED=1             show the browser window
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) out[key] = true
      else {
        out[key] = next
        i++
      }
    } else out._.push(a)
  }
  return out
}

function sessionPath() {
  const dir = process.env.SORDINO_VERIFY_DIR
  if (!dir) {
    console.error(`FAIL SORDINO_VERIFY_DIR is not set.

Run launch first, then copy and run the \`export\` field from its JSON stdout, e.g.:
  node .cursor/skills/verify-sordino/scripts/control-sordino.mjs launch --run-id demo
  # stdout includes: "export": "export SORDINO_VERIFY_DIR=..."
  # On macOS that path is under $TMPDIR (often /var/folders/...), not always /tmp.
  eval "$(...paste the export line...)"   # or run the export line as printed
`)
    process.exit(1)
  }
  return join(dir, 'session.json')
}

function logTail(logFile, maxLines = 40) {
  if (!existsSync(logFile)) return '(daemon.log missing — stdio was not captured)'
  const text = readFileSync(logFile, 'utf8')
  if (!text.trim()) return '(daemon.log empty)'
  const lines = text.split('\n')
  return lines.slice(-maxLines).join('\n')
}

function loadSession() {
  const path = sessionPath()
  if (!existsSync(path)) {
    console.error(`FAIL missing session at ${path}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function freePort() {
  return new Promise((resolvePort) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolvePort(port))
    })
  })
}

async function api(method, path, body) {
  const session = loadSession()
  const url = `http://127.0.0.1:${session.port}${path}`
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { ok: false, error: text }
  }
  if (!res.ok || data.ok === false) {
    console.error(JSON.stringify(data, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify(data, null, 2))
  return data
}

function requireBuiltExtension(dist) {
  const manifestPath = join(dist, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error(`FAIL ${manifestPath} not found — run \`npm run build:chrome\` first`)
    process.exit(1)
  }
}

async function launch(args) {
  const dist = resolve(args.dist ?? DEFAULT_DIST)
  requireBuiltExtension(dist)

  const runId =
    args['run-id'] ??
    process.env.SORDINO_RUN_ID ??
    `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  // An explicit --run-id always gets a fresh dir under the OS temp root ($TMPDIR
  // on macOS, often /tmp on Linux). Do not reuse a leftover SORDINO_VERIFY_DIR
  // from the shell when the caller asked for a new run id.
  const sessionDir = resolve(
    args['run-id']
      ? join(tmpdir(), `sordino-verify-${runId}`)
      : (process.env.SORDINO_VERIFY_DIR ?? join(tmpdir(), `sordino-verify-${runId}`))
  )
  const artifactsDir = resolve(args.artifacts ?? join(DEFAULT_ARTIFACTS_ROOT, runId))
  const profileDir = mkdtempSync(join(tmpdir(), 'sordino-profile-'))
  const port = await freePort()
  const mapHost = args['map-host'] ?? 'www.reddit.com'

  mkdirSync(sessionDir, { recursive: true })
  mkdirSync(artifactsDir, { recursive: true })

  const meta = {
    runId,
    port,
    dist,
    profileDir,
    artifactsDir,
    mapHost,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(join(sessionDir, 'session.json'), JSON.stringify(meta, null, 2))

  const daemon = join(__dirname, 'daemon.mjs')
  const readyFile = join(sessionDir, 'ready.json')
  const logFile = join(sessionDir, 'daemon.log')
  // Capture daemon stdout/stderr from process start (not only the ready line
  // the daemon appends itself). Parent closes its fd after spawn; the child keeps it.
  writeFileSync(logFile, '')
  const logFd = openSync(logFile, 'a')
  const child = spawn(process.execPath, [daemon], {
    env: {
      ...process.env,
      SORDINO_VERIFY_DIR: sessionDir,
      SORDINO_READY_FILE: readyFile,
    },
    detached: true,
    stdio: ['ignore', logFd, logFd],
  })
  closeSync(logFd)
  child.unref()

  const ready = await new Promise((resolveReady, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (existsSync(readyFile)) {
        clearInterval(timer)
        child.off('exit', onExit)
        resolveReady(true)
        return
      }
      if (Date.now() - started > 30000) {
        clearInterval(timer)
        child.off('exit', onExit)
        reject(
          new Error(`daemon did not become ready\n--- daemon.log (tail) ---\n${logTail(logFile)}`)
        )
      }
    }, 100)
    const onExit = (code) => {
      clearInterval(timer)
      reject(
        new Error(`daemon exited early (${code})\n--- daemon.log (tail) ---\n${logTail(logFile)}`)
      )
    }
    child.on('exit', onExit)
  })

  // Re-read session enriched by the daemon.
  const session = JSON.parse(readFileSync(join(sessionDir, 'session.json'), 'utf8'))
  writeFileSync(join(sessionDir, 'daemon.pid'), String(child.pid))

  console.log(
    JSON.stringify(
      {
        ok: true,
        ready,
        SORDINO_VERIFY_DIR: sessionDir,
        export: `export SORDINO_VERIFY_DIR=${sessionDir}`,
        runId,
        port: session.port,
        extensionId: session.extensionId,
        artifactsDir,
        mapHost,
        pid: child.pid,
      },
      null,
      2
    )
  )
}

async function cleanup() {
  const session = loadSession()
  try {
    await api('POST', '/cleanup', {})
  } catch {
    // Daemon may already be gone; fall through to local cleanup.
  }

  // Give the daemon a moment to exit and remove the profile.
  await new Promise((r) => setTimeout(r, 300))

  if (existsSync(session.profileDir)) {
    rmSync(session.profileDir, { recursive: true, force: true })
  }
  // Keep artifactsDir. Remove only the session control files.
  const dir = process.env.SORDINO_VERIFY_DIR
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        cleaned: { sessionDir: dir, profileDir: session.profileDir },
        retainedArtifacts: session.artifactsDir,
      },
      null,
      2
    )
  )
}

const args = parseArgs(process.argv.slice(2))
const [cmd, sub] = args._

if (!cmd || args.help) usage(cmd ? 0 : 1)

if (cmd === 'launch') {
  try {
    await launch(args)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
} else if (cmd === 'doctor') {
  await api('GET', '/doctor')
} else if (cmd === 'popup' && sub === 'open') {
  await api('POST', '/popup/open', {})
} else if (cmd === 'popup' && sub === 'close') {
  await api('POST', '/popup/close', {})
} else if (cmd === 'popup' && sub === 'dismiss-tip') {
  await api('POST', '/popup/dismiss-tip', {})
} else if (cmd === 'popup' && sub === 'open-settings') {
  await api('POST', '/popup/open-settings', {})
} else if (cmd === 'popup' && sub === 'click') {
  await api('POST', '/popup/click', {
    role: args.role,
    name: args.name,
    selector: args.selector,
    text: args.text,
  })
} else if (cmd === 'popup' && sub === 'fill') {
  await api('POST', '/popup/fill', {
    role: args.role,
    name: args.name,
    selector: args.selector,
    value: args.value,
  })
} else if (cmd === 'popup' && sub === 'wait-text') {
  await api('POST', '/popup/wait-text', { pattern: args.pattern })
} else if (cmd === 'options' && sub === 'open') {
  await api('POST', '/options/open', {})
} else if (cmd === 'options' && sub === 'click') {
  await api('POST', '/options/click', {
    role: args.role,
    name: args.name,
    selector: args.selector,
    text: args.text,
  })
} else if (cmd === 'site' && sub === 'open') {
  await api('POST', '/site/open', { url: args.url, name: args.name ?? 'site' })
} else if (cmd === 'site' && sub === 'wait') {
  await api('POST', '/site/wait', {
    name: args.name ?? 'site',
    selector: args.selector,
    state: args.state ?? 'attached',
    timeoutMs: args.timeout ? Number(args.timeout) : undefined,
  })
} else if (cmd === 'site' && sub === 'click') {
  await api('POST', '/site/click', {
    pageName: args['page-name'] ?? 'site',
    role: args.role,
    name: args.name,
    selector: args.selector,
    text: args.text,
  })
} else if (cmd === 'site' && sub === 'eval') {
  await api('POST', '/site/eval', {
    name: args['page-name'] ?? 'site',
    expression: args.expr,
  })
} else if (cmd === 'screenshot') {
  await api('POST', '/screenshot', {
    page: args.page ?? 'site',
    path: args.path,
    fullPage: Boolean(args['full-page']),
  })
} else if (cmd === 'aria') {
  await api('POST', '/aria', { page: args.page ?? 'site', path: args.path })
} else if (cmd === 'sw-eval') {
  await api('POST', '/sw/eval', { expression: args.expr })
} else if (cmd === 'cleanup') {
  await cleanup()
} else {
  usage(1)
}
