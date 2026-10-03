# D: the Sordino store as a deep module behind ports and adapters

Constraint: every dependency that crosses a seam is an explicit, minimal **port**. Each real seam has two **adapters** (production + in-memory/direct-call). The domain logic stays behind the store as in-process **internal seams**. The store's own **interface** is `openStore` + `dispatch` + `settle`. Readers get a separate read-only module built on the read half of the storage port.

## 1. Interface

```ts
// ── Ports (src/store/ports.ts): the only things the store touches outside itself ─────────
export type StoredKey = 'config' | 'state' | 'usage'           // decision 36; each doc carries `version`
type LegacyKey = 'sordino_settings'                             // v1, read-only

export interface StorageReadPort {                              // all a reader context gets
  read<K extends StoredKey | LegacyKey>(keys: readonly K[]): Promise<{ [P in K]?: unknown }>
  watch(keys: readonly StoredKey[], onChange: (changed: { [P in StoredKey]?: unknown }) => void): () => void
}
export interface StoragePort extends StorageReadPort {          // only background gets this half
  write(docs: Partial<{ config: ConfigDoc; state: StateDoc; usage: UsageDoc }>): Promise<void> // one atomic set; rejects on failure
}
export type Clock = () => number                                 // epoch ms; local day = process time zone

export interface CommandPort {                                   // how popup, settings, overlay and background-internal callers write
  send<C extends Command>(command: C): Promise<Result<C>>        // never rejects
}

// ── Commands (domain words only, decision 37) ─────────────────────────────────────────────
export type Command =
  | { type: 'start' }                                            // First run "Start"; nothing is muted before it
  | { type: 'mute-now'; minutes: number }                         // finite, decision 13
  | { type: 'pause'; length: '15m' | '1h' | 'rest-of-today' }    // decision 14
  | { type: 'back-to-schedule' }
  | { type: 'record-mute'; url: string; navigationId: string }   // once per navigation; navigationId makes retries idempotent
  | { type: 'turn-back'; url: string }
  | { type: 'take-bypass'; url: string }
  | { type: 'add-muted-site'; input: string }                     // raw text; also "Mute this site" (page URL)
  | { type: 'remove-muted-site'; site: MutedSite }
  | { type: 'set-category'; category: CategoryId; on: boolean; site?: MutedSite }
  | { type: 'save-schedule'; schedule: ScheduleDraft }            // create or replace by id
  | { type: 'delete-schedule'; id: ScheduleId }
  | { type: 'set-bypass-options'; waitSeconds?: number; lengthMinutes?: number; budget?: number }
  | { type: 'set-own-line'; text: string | null }
  | { type: 'set-stillness'; on: boolean }
  | { type: 'import'; file: unknown; includeUsage: boolean }

export interface OutcomeMap {
  'pause':          { kind: 'paused'; until: number }
  'mute-now':       { kind: 'muting'; until: number }
  'take-bypass':    { kind: 'granted'; site: MutedSite; until: number; budgetLeft: number }   // budgetLeft 0 is still granted (ADR-0002)
                  | { kind: 'already-bypassed'; site: MutedSite; until: number }
                  | { kind: 'not-muted' }                                                        // site not on the list, or muting not in effect
  'add-muted-site': { kind: 'added'; site: MutedSite; pathIgnored: boolean }                    // path rules deferred (decision 3)
                  | { kind: 'already-muted'; site: MutedSite; via: 'own' | CategoryId }
                  | { kind: 'refused'; reason: 'empty' | 'not-a-site' }
  'import':         { kind: 'imported'; fromVersion: number; sites: number; schedules: number; usage: 'kept' | 'replaced' }
                  | { kind: 'rejected'; reason: 'not-a-sordino-file' | 'newer-version' | 'malformed'; detail: string }
  'record-mute':    { kind: 'counted' | 'already-counted' | 'not-muted' }
  // …one entry per command; edits return { kind: 'saved' | 'unchanged' } or a domain refusal
}
export type Result<C extends Command> =
  | { ok: true; outcome: OutcomeMap[C['type']] }
  | { ok: false; error: { code: 'invalid-command' | 'not-allowed' | 'storage-failed' | 'transport-lost'; detail: string } }

export type Sender =
  | { kind: 'page' }                                // popup, settings, First run: any command
  | { kind: 'tab'; tabId: number; url: string }     // content script: record-mute / turn-back / take-bypass, own site only (decision 40)
  | { kind: 'background' }                          // alarms, context menu: any command

// ── Effects: data, not a port (decision 38) ──────────────────────────────────────────────────
export type Effect =
  | { kind: 'badge'; show: 'off' | 'muting' | 'paused' }                         // desired state, idempotent
  | { kind: 'alarms'; at: { name: 'muting-change' | `bypass-end:${MutedSite}` | `bypass-ending:${MutedSite}`; when: number }[] } // full desired set
  | { kind: 'notify-tab'; site: MutedSite; event: 'bypass-ending' }             // decision 22's one toast
  | { kind: 'open-page'; page: 'first-run' }

// ── The store (background only) ───────────────────────────────────────────────────────────
export function openStore(deps: { storage: StoragePort; clock: Clock }): Promise<SordinoStore>
export interface SordinoStore {
  dispatch<C extends Command>(command: C, sender: Sender): Promise<{ result: Result<C>; effects: Effect[] }>
  settle(trigger: 'installed' | 'updated' | 'startup' | 'alarm'): Promise<Effect[]>   // never writes
}

// ── Readers (any context) ─────────────────────────────────────────────────────────────────
export function openReader(storage: StorageReadPort): {
  read<K extends StoredKey>(...keys: K[]): Promise<Pick<{ config: Config; state: State; usage: Usage }, K>>  // migrated in memory
  watch<K extends StoredKey>(keys: K[], onChange: (docs: Pick<…, K>) => void): () => void
}
export function exportFile(config: Config, usage?: Usage): SordinoFile               // pure; export is a read
```

**Invariants**
- Only `openStore` (migration, at most once per version bump) and `dispatch` write. `settle` and every reader never write. A command that changes nothing writes nothing.
- One command = at most one `storage.write`, carrying only the keys that changed. The Usage path never rewrites `config`.
- Commands run one at a time in arrival order. `now` is read once per command, when it is dequeued, so a check-and-spend (Bypass budget) is atomic.
- A refusal is an **outcome** (`not-muted`, `refused`, `rejected`), never an error. `ok: false` means the command did not run: nothing was written and no effects were returned.
- Effects describe *desired* state (badge, the full alarm set). Applying the same effects twice is harmless, so a service-worker restart only needs `settle('startup')`.
- After `openStore` resolves, all three keys hold the current version. Before that, readers migrate in memory, so they never see v1 shapes.

**Ordering constraints**
- Background must register its listeners synchronously (MV3) and await `openStore` inside them. `dispatch` before `openStore` resolves is impossible by construction, because the listeners hold the promise.
- When `send` resolves, the write has landed, but the caller's `watch` may not have fired yet (Chrome does not order `onChanged` against the reply). Render the outcome, and let the subscription catch up.
- Effects from one call are applied in order before the reply is sent, so a granted Bypass and its `bypass-end` alarm arrive together.

**Error modes**
- `invalid-command`: payload failed runtime validation, whatever its static type.
- `not-allowed`: the sender rule failed (decision 40).
- `storage-failed`: `write` rejected (quota or IO). In-memory state is rolled back.
- `transport-lost`: the receiving end is gone or the extension context is invalidated. Content scripts treat it as fail-open.
- `openStore` rejects only if storage cannot be read at all. A malformed stored doc is migrated field by field to defaults (no silent reset of the valid parts), and the repair is logged. A malformed *import* is `rejected`, and state is not touched.

## 2. Usage examples

**Popup starts a 1-hour Pause**
```ts
const sordino = runtimeCommandPort()                       // production adapter
const r = await sordino.send({ type: 'pause', length: '1h' })
if (r.ok) setLine(`Paused until ${hhmm(r.outcome.until)}`) else setLine('Sordino is restarting, try again')
// behind it: Muting decision applies "most recent wins"; Usage counts one Pause; one write {state, usage};
// effects: badge 'paused', alarms [{ name: 'muting-change', when: until }]
```

**Overlay session at document_start, then a Bypass**
```ts
const reader = openReader(chromeStorage(browser.storage.local))   // StoragePort narrows to StorageReadPort here
const sordino = runtimeCommandPort()
const { config, state } = await reader.read('config', 'state')       // one storage.get, no message, no write
const d = decidePage(config, state, location.href, Date.now())     // Muting decision + Muted sites + Bypass budget offer (pure)
if (d.kind === 'mute') {
  overlay.show(d)                                                   // d.offer.waitSeconds: 0–15, or 30 when spent
  void sordino.send({ type: 'record-mute', url: location.href, navigationId: crypto.randomUUID() })
  overlay.onBypass(async () => {                                    // fires after the visible Bypass wait
    const r = await sordino.send({ type: 'take-bypass', url: location.href })
    if (!r.ok || r.outcome.kind !== 'not-muted') overlay.lift()     // transport-lost lifts too: fail open
  })
}
reader.watch(['config', 'state'], docs => rerunDecision(docs))      // replaces 1.x polling
```

**Settings adds "Reddit.com/r/foo"**
```ts
const r = await sordino.send({ type: 'add-muted-site', input: 'Reddit.com/r/foo' })
// Social on (default): { kind: 'already-muted', site: 'reddit.com', via: 'social' }
// Social off:          { kind: 'added', site: 'reddit.com', pathIgnored: true }  → "Added reddit.com (whole site)"
```

**Import of a v1 file**
```ts
const file = JSON.parse(await picked.text())               // e.g. a 1.x SordinoSettings object, no `version`
const r = await sordino.send({ type: 'import', file, includeUsage: false })
// unversioned → v1 → same migrate chain as storage → validate → replace config; state (a live Pause) untouched
// { kind: 'imported', fromVersion: 1, sites: 21, schedules: 4, usage: 'kept' }; malformed → { kind: 'rejected', … }, zero writes
```

**A Vitest test** (vitest config pins `TZ`; this file runs under `Europe/London`)
```ts
it('a spent budget still grants a Bypass, and a forged site is refused', async () => {
  const storage = memoryStorage({ sordino_settings: v1At372cc65 })   // real v1 snapshot from git history
  const clock = fixedClock('2026-10-05T10:00')                       // Monday, inside Work hours
  const store = await openStore({ storage, clock: clock.now })
  const tabSender = { kind: 'tab', tabId: 7, url: 'https://old.reddit.com/r/x' } as const
  const tab = directCommandPort(store, tabSender)
  for (let i = 0; i < 3; i++) {                                      // the v1 budget of 3
    await tab.send({ type: 'take-bypass', url: 'https://old.reddit.com/r/x' }); clock.advance(6 * 60_000)
  }
  const { result, effects } = await store.dispatch({ type: 'take-bypass', url: 'https://www.reddit.com/' }, tabSender) // same Muted site
  expect(result).toMatchObject({ ok: true, outcome: { kind: 'granted', site: 'reddit.com', budgetLeft: 0 } })
  expect(effects).toContainEqual({ kind: 'alarms', at: expect.arrayContaining([{ name: 'bypass-end:reddit.com', when: clock.now() + 5 * 60_000 }]) })
  const writes = storage.writes.length
  expect(await tab.send({ type: 'take-bypass', url: 'https://youtube.com/' })).toMatchObject({ ok: false, error: { code: 'not-allowed' } })
  expect(storage.writes.length).toBe(writes)
})
```

## 3. What the implementation hides

- **Persistence:** the in-memory cache of the three docs; the serial queue; diffing so only changed keys are written; rollback if `write` rejects.
- **Migration:** one `migrate(unknown, version) → current` chain shared by `openStore`, readers and `import`. v1 (`sordino_settings`, no version) is split into `config`/`state`/`usage`. Categories are merged with defaults by id (M8). `manualOverride`, emergency refresh and scaffolding are dropped. The v1 key is left in place as read-only rollback insurance.
- **Command handling:** runtime validation of each command; the sender table (which kinds may send which commands); matching `sender.url` and `command.url` to the *same* Muted site; `navigationId` dedup (a bounded ring in `state`).
- **Domain delegation (internal seams, in-process, tested directly):**
  - Muted sites parses `input` and matches URLs;
  - Muting decision handles precedence, end times and the next change;
  - Bypass budget handles offer, take, lookup, local-day rollover and the 30 s spent wait;
  - Usage records into 12 weeks of local daily counts.
- **Effect derivation:** after every command, and on `settle`, the store asks Muting decision and Bypass budget for "badge now" and "every future moment something changes". It returns the full alarm set (this fixes L8's re-arming drift and M2's late expiry).

## 4. Dependency strategy and adapters

| Seam | Port | Production adapter | Test adapter |
|---|---|---|---|
| Storage (ports & adapters) | `StoragePort` / `StorageReadPort` | `chromeStorage(browser.storage.local)`: `get`, one `set` per write, `lastError` → reject, `onChanged` filtered to `local` + our keys, null `newValue` guarded | `memoryStorage(seed)`: a Map; `watch` fires on a **microtask** after `write` (so ordering bugs show in tests); extras for tests only: `writes` log, `failNextWrite()` |
| Command transport (ports & adapters) | `CommandPort` + `serveCommands` | `runtimeCommandPort()`: wraps in `{ sordino: 2, command }`, maps "Receiving end does not exist" / context-invalidated to `transport-lost`. `serveCommands(runtime, ready, apply)` uses `sendResponse` + `return true` (works on both browsers), and `toSender(MessageSender)`: runtime-URL origin → `page`, otherwise `tab` with `sender.url` (frame URL) | `directCommandPort(store, sender, apply?)`: `structuredClone`s command and result to keep wire parity. Also a **production** adapter for background-internal callers, which makes the seam doubly real |
| Clock (injected) | `Clock = () => number` | `Date.now` | `fixedClock(iso)` with `now`, `advance`, `set` |
| Badge, alarms, tabs (true external) | none: `Effect[]` is data | `applyEffects(browser, effects)`: sets the badge, clears `sordino:*` alarms and creates the desired set, `tabs.sendMessage` and ignores errors, `tabs.create` for First run | tests assert on the returned `effects`; real application is covered by the Playwright smoke test |

Effects are deliberately *not* a port. Only one adapter would exist, so a port there would be a hypothetical seam.

**Background wiring** (`entrypoints/background.ts`, the whole file):
```ts
export default defineBackground(() => {
  const ready = openStore({ storage: chromeStorage(browser.storage.local), clock: Date.now })
  const apply = (e: Effect[]) => applyEffects(browser, e)
  const self = ready.then(s => directCommandPort(s, { kind: 'background' }, apply))
  serveCommands(browser.runtime, ready, apply)                               // registered synchronously
  browser.runtime.onInstalled.addListener(d => ready.then(s => s.settle(d.reason === 'install' ? 'installed' : 'updated')).then(apply))
  browser.runtime.onStartup.addListener(() => ready.then(s => s.settle('startup')).then(apply))
  browser.alarms.onAlarm.addListener(() => ready.then(s => s.settle('alarm')).then(apply))
  browser.contextMenus.onClicked.addListener(i => self.then(p => p.send({ type: 'add-muted-site', input: i.pageUrl! })))
  // keyboard shortcut is `_execute_action` in the manifest: no store involvement
})
```
**Test composition:** `memoryStorage` + `fixedClock` → `openStore` → one `directCommandPort` per simulated sender. Also `openReader(storage)` on the same `memoryStorage`, to check that a reader sees what a command wrote and that a read never adds to `storage.writes`.

## 5. Trade-offs

**Where leverage is high**
- **Read/write split at the type level.** Content and popup are handed a `StorageReadPort`, so they *cannot* call `write`, and decision 34 is enforced by the compiler rather than by review.
- **Validation and sender rules sit inside `dispatch`, not in the messaging adapter.** The direct-call adapter therefore exercises them in Vitest. The only untested security logic is `toSender`, a ~10-line pure function in the adapter that gets its own table test.
- **The direct-call adapter has a production caller** (context menu, future alarms-as-commands), so the transport seam has two real adapters even outside tests.
- **Desired-state effects** turn badge and alarm bugs into store-level assertions, and make service-worker restarts boring.

**Where it is thin**
- **The clock port is only `() => number`.** The local day comes from the process time zone. TZ-sensitive tests need per-file `TZ` (Vitest projects), not an injected zone. Injecting `{ now, zone }` would be deeper but would leak `Intl` plumbing into every reader.
- **`applyEffects` and `serveCommands` are untested by Vitest.** They are thin, but alarm reconciliation and `return true` are real code; only the Playwright smoke test covers them.
- **`settle` is a second entry point that is not a domain command.** It exists so that alarms never pose as user actions in the outcome types.

**What a 2.0 ticket author would find awkward**
- **A new command touches four places in one file area:** the `Command` union, `OutcomeMap`, the sender table and the handler. A `defineCommand({ senders, parse, run })` table would co-locate them, at the cost of type inference gymnastics.
- **"Outcome arrived, but my `watch` has not fired" surprises UI authors.** Popup code must render from the outcome, not re-read.
- **`notify-tab` overlaps with readers' own `watch`.** It earns its place only for the "ending in 1 min" toast. Expect a ticket to question it.
- **Keeping the v1 key means two copies of user data until a later migration deletes it.** Someone must remember to write that migration.
- **`navigationId` dedup and Bypass wait are trust-the-client.** The store does not verify that the wait was served. This is acceptable for a soft mute (L9), but a reviewer will ask.
