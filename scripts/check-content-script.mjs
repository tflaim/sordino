#!/usr/bin/env node
// Post-build guard: every content script listed in a built manifest must parse
// as a CLASSIC script. Browsers inject manifest `content_scripts` as classic
// scripts, so a top-level `import`/`export` (e.g. from Rollup hoisting a shared
// chunk) throws "SyntaxError: Cannot use import statement outside a module"
// before any code runs, and the overlay never appears.
//
// Usage: node scripts/check-content-script.mjs [distDir ...]
//        (defaults to .output/chrome-mv3 .output/firefox-mv3)
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import vm from 'node:vm'

const distDirs = process.argv.slice(2)
if (distDirs.length === 0) distDirs.push('.output/chrome-mv3', '.output/firefox-mv3')

let failures = 0
let checked = 0

for (const dir of distDirs) {
  const manifestPath = join(dir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error(`FAIL ${manifestPath}: not found (run \`npm run build\` first)`)
    failures++
    continue
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const files = (manifest.content_scripts ?? []).flatMap((cs) => cs.js ?? [])
  if (files.length === 0) {
    console.error(`FAIL ${manifestPath}: no content_scripts[].js entries`)
    failures++
    continue
  }
  for (const rel of files) {
    const file = join(dir, rel)
    checked++
    if (!existsSync(file)) {
      console.error(`FAIL ${file}: listed in manifest but missing`)
      failures++
      continue
    }
    const src = readFileSync(file, 'utf8')
    try {
      // Compiles (does not run) the source with classic-script grammar.
      new vm.Script(src, { filename: resolve(file) })
      console.log(`ok   ${file} parses as a classic script`)
    } catch (err) {
      failures++
      console.error(`FAIL ${file}: not a valid classic script`)
      console.error(`     ${err.name}: ${err.message}`)
      console.error(`     starts with: ${JSON.stringify(src.slice(0, 80))}`)
    }
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} problem(s). Content scripts must be self-contained classic ` +
      `scripts (no import/export); the content entry must not share chunks.`
  )
  process.exit(1)
}
console.log(`\nAll ${checked} content script(s) are self-contained classic scripts.`)
