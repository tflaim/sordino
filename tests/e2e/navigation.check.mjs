import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import assert from 'node:assert/strict'
import { join } from 'node:path'
const source = readFileSync(
  join(process.argv[2] ?? '.output/chrome-mv3', 'content-scripts/navigation.js'),
  'utf8'
)
const calls = []
const events = []
const history = {
  pushState(...args) {
    calls.push(['push', ...args])
  },
  replaceState(...args) {
    calls.push(['replace', ...args])
  },
}
await runInNewContext(source, {
  window: {
    dispatchEvent(e) {
      events.push(e.type)
    },
  },
  history,
  Event,
  console,
})
history.pushState({ a: 1 }, '', '/quiet')
history.replaceState({ b: 2 }, '', '/quiet-2')
assert.deepEqual(calls, [
  ['push', { a: 1 }, '', '/quiet'],
  ['replace', { b: 2 }, '', '/quiet-2'],
])
assert.deepEqual(events, ['sordino:address-change', 'sordino:address-change'])
const push = history.pushState
await runInNewContext(source, { window: { navigation: {} }, history, Event, console })
assert.equal(history.pushState, push)
console.log(
  'PASS actual built history bridge: quiet push/replace emit events and preserve arguments; native Navigation API skips wrapping'
)
