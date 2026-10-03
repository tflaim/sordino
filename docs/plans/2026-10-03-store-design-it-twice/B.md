# B: the Sordino store, built to be extended

Constraint: maximise flexibility. 2.0 ships the settled shape (34–41). The follow-up release (path rules, "soften the page", per-category Schedules, more Usage events) should land as *new entries*, not new call shapes. Every extension point sits **behind** the seam. Callers learn three things: read, subscribe, send.

## 1. Interface

### Caller-facing (every context): `shared/store/contract.ts`
```ts
// Documents: three keys, each carrying its own schema version (36)
interface ConfigDoc { v: 2; firstRun: 'pending' | 'done'; categories: Category[]; ownSites: MutedSite[];
  schedules: Schedule[]; bypass: { waitSeconds: number /*0–15*/; lengthMinutes: number; budgetPerDay: number };
  ownLine: string | null; stillness: boolean }
interface StateDoc  { v: 2; action: { kind: 'mute-now' | 'pause'; since: number; until: number } | null; // most recent wins (15)
  bypasses: Record<MutedSiteId, { until: number }>; budget: { day: LocalDate; used: number } }
interface UsageDoc  { v: 2; days: Record<LocalDate, UsageDay> }      // ≤ 12 weeks kept
type UsageDay = { totals: Partial<Record<UsageEventKind, number>>;
                  sites: Record<MutedSiteId, Partial<Record<UsageEventKind, number>>> }
type UsageEventKind = 'mute' | 'turn-back' | 'bypass' | 'pause' | (string & {}) // open: readers skip unknown kinds

type MutedSiteRule = { kind: 'host'; host: string }                 // follow-up adds { kind: 'path'; host; prefix }
interface MutedSite { id: MutedSiteId; rule: MutedSiteRule }        // id is stable; keys Bypass and Usage
interface Schedule { id: ScheduleId; name: string; days: DayOfWeek[]; start: Minute; end: Minute | 'end-of-day';
  on: boolean; appliesTo: 'all' }                                    // follow-up widens to CategoryId[] (decision 16 now: global)

interface Snapshot { config: ConfigDoc; state: StateDoc; usage: UsageDoc }   // already migrated, read-only

// Reading (35): never writes; migrates in memory if background has not yet rewritten an older version.
function readSnapshot(storage: StorageReader): Promise<Snapshot>
function subscribe(storage: StorageReader, onChange: (s: Snapshot, changed: DocKey[]) => void): () => void

// Writing (34, 37): one typed client per context, over a transport adapter.
interface StoreClient { send<K extends CommandKind>(kind: K, input: CommandInput<K>): Promise<Outcome<K>> }
function storeClient(transport: Transport): StoreClient

// The command catalogue (one entry per domain command; there is no generic patch)
interface Commands {
  'start':              { in: { categories: CategoryId[]; schedules: ScheduleId[] };  out: { mutingFrom: number } }
  'mute-now':           { in: { minutes: number };                                    out: { until: number } }
  'pause':              { in: { length: '15m' | '1h' | 'rest-of-today' };             out: { until: number } }
  'back-to-schedule':   { in: {};                                                     out: { was: 'mute-now' | 'pause' | null } }
  'record-mute':        { in: { site: MutedSiteId; navigation: string };              out: { counted: boolean } }
  'turn-back':          { in: { site: MutedSiteId };                                  out: {} }
  'take-bypass':        { in: { site: MutedSiteId; waited: number };
                          out: { granted: true; until: number; budgetLeft: number } | { granted: false; waitSeconds: number } }
                          // already bypassed → granted: true with the existing until, nothing spent (19)
  'add-muted-site':     { in: { input: string };  out: { site: MutedSite; dropped: ('path' | 'www' | 'port' | 'query')[] }
                                                       | { already: MutedSiteId; via: CategoryId | 'own' } }
  'remove-muted-site':  { in: { site: MutedSiteId };                                  out: {} }
  'set-category':       { in: { category: CategoryId; on: boolean; siteOff?: MutedSiteId[] }; out: {} }
  'save-schedule':      { in: { schedule: Omit<Schedule, 'id'> & { id?: ScheduleId } }; out: { id: ScheduleId } }
  'delete-schedule':    { in: { id: ScheduleId };                                     out: {} }
  'set-bypass-options': { in: Partial<ConfigDoc['bypass']>;                           out: ConfigDoc['bypass'] }
  'set-own-line':       { in: { text: string | null };                                out: {} }
  'set-stillness':      { in: { on: boolean };                                        out: {} }
  'export':             { in: { includeUsage: boolean };                              out: { file: ExportFile } }
  'import':             { in: { file: unknown };                                      out: { from: number; sites: number } }
}
type Outcome<K extends CommandKind> = { ok: true; value: Commands[K]['out'] }
  | { ok: false; error: 'refused' | 'rejected'; detail: string }   // shared modes, see below
  | { ok: false; error: 'not-found'; detail: string }
```

### Background-facing (entrypoint and tests only): `background/store/open.ts`
```ts
function openStore(deps: { storage: StorageAdapter; clock: () => number; tz?: string }): Promise<Store>
interface Store {
  dispatch(env: Envelope, sender: SenderInfo): Promise<{ outcome: Outcome<CommandKind>; effects: Effect[] }>
  lifecycle(event: 'installed' | 'updated' | 'startup' | { alarm: string }): Promise<Effect[]>
}
type Envelope   = { v: 1; kind: string; input: unknown }           // v = command-schema version, not storage version
type SenderInfo = { context: 'extension-page' } | { context: 'content'; tabId: number; url: string } | { context: 'background' }
type Effect = { kind: 'badge'; text: string; colour: string }
  | { kind: 'alarm-at'; name: AlarmName; at: number } | { kind: 'alarm-clear'; name: AlarmName }
  | { kind: 'notify-tab'; tabId: number; note: 'bypass-ending' } | { kind: 'open-page'; page: 'first-run' }
```

### Invariants, ordering, error modes
- **No patch through the back door.** Every handler receives `(snapshot, input, ctx)` and *computes* new documents; no catalogue entry accepts a state delta from a caller. `set-bypass-options` takes named fields, each range-checked; it is not "merge this object".
- **Serial.** `dispatch` runs one command at a time through one queue; check-and-spend (`take-bypass`) is atomic. Callers may fire concurrently; outcomes resolve in arrival order.
- **Pipeline, fixed order:** envelope version → sender rule → input decode → (queue) → load + day rollover → handler → key guard → write-on-change → reactions → effects returned. A request that fails before the queue touches nothing.
- **Key guard.** Each entry declares the keys it may write (`record-mute`: `usage` only). Writing another key is a programming error caught by tests; `config` is never rewritten on the hot path.
- **Write-on-change.** Unchanged documents are not written, so a no-op command fires no `onChanged`.
- **Day rollover is lazy** inside the load step: a new local day resets `budget.used` and leaves live Bypasses alone.
- **Before First run:** `firstRun: 'pending'` means nothing is muted. Overlay commands return `refused` until `start`.
- **Errors are values; nothing throws across the seam.** `refused` means this sender may not send this command (rule 40). `rejected` means the input or file is malformed, or the envelope `v` is unknown (for example an orphaned old page after an update). `not-found` means the id is stale. Domain "no" answers live in each `out` (`granted: false`, `already`). Storage write failure rejects the `dispatch` promise; the snapshot is unchanged.

## 2. Usage examples

**Popup: 1-hour Pause.**
```ts
const store = storeClient(messagingTransport())
const r = await store.send('pause', { length: '1h' })
if (r.ok) setLabel(`Paused until ${hhmm(r.value.until)}`)
// effects (wiring applies them): badge "paused", alarm-at 'action-end' at until. Usage +1 'pause'.
```

**Overlay session at document_start, then Bypass.**
```ts
const snap = await readSnapshot(storageReader)                      // direct read, no message round-trip
const site = mutedSites.match(location.href, snap.config)           // #5, pure
const d = site && muting.decide(snap, site, Date.now())             // #2 (consults #3 for live Bypasses)
if (d?.inEffect) {
  overlay.show(d, bypassBudget.offer(snap, site, Date.now()))       // offer = { waitSeconds: 5 | 30, budgetLeft }
  store.send('record-mute', { site: site.id, navigation: navId })   // once per navigation; dedup is by navigation id
  overlay.onBypass(async (waited) => {
    const r = await store.send('take-bypass', { site: site.id, waited })
    if (r.ok && r.value.granted) overlay.lift(r.value.until)
    else if (r.ok) overlay.waitAgain(r.value.waitSeconds)            // budget spent by another tab meanwhile: 30 s (ADR-0002)
  })
}
subscribe(storageReader, () => redecide())                          // replaces polling
```
The sender rule matches `sender.url` to a Muted site and requires it to equal `input.site`, so a page on `x.com` cannot spend a Bypass for `reddit.com`.

**Settings: adding "Reddit.com/r/foo".**
```ts
const r = await store.send('add-muted-site', { input: 'Reddit.com/r/foo' })
// 2.0: { ok: true, value: { site: { id, rule: { kind: 'host', host: 'reddit.com' } }, dropped: ['path'] } }
//  → UI: "Muting all of reddit.com (paths come later)."  If Social already has it: { already, via: 'social' }.
// Follow-up: the same call returns rule { kind: 'path', host: 'reddit.com', prefix: '/r/foo' } and dropped: [].
```

**Import of a v1 file** (a 1.x `sordino_settings` object, unversioned = v1):
```ts
const r = await store.send('import', { file: JSON.parse(text) })
// store: migrate(file, 'import') → v1→v2 step splits it into config (+ usage if present); every site goes through Parse
// ok   → { from: 1, sites: 14 }; state (Pause, Bypasses) is never imported
// bad  → { ok: false, error: 'rejected', detail: 'categories[2].sites[0]: not a site' }; storage untouched
```

**A test** (Vitest; in-memory adapter, direct-call transport, fixed clock):
```ts
test('last Bypass taken from two tabs at once: one granted, the other asked to wait 30 s', async () => {
  const storage = memoryStorage(v1Fixture('1fbc6ea'))               // starts as unversioned v1
  const clock = fixedClock('2026-10-05T10:00', 'Europe/London')
  const raw = await openStore({ storage, clock })
  const page = storeClient(directTransport(raw, { context: 'extension-page' }))
  await page.send('start', { categories: ['social'], schedules: ['always'] })
  await page.send('set-bypass-options', { budgetPerDay: 1 })
  const tab = (id: number, url: string) => storeClient(directTransport(raw, { context: 'content', tabId: id, url }))
  const [a, b] = await Promise.all([tab(7, 'https://old.reddit.com/').send('take-bypass', { site: REDDIT, waited: 5 }),
                                    tab(8, 'https://x.com/home').send('take-bypass', { site: X, waited: 5 })])
  expect([a, b].map(r => r.ok && r.value.granted)).toEqual([true, false])
  expect((await readSnapshot(storage)).usage.days['2026-10-05'].totals.bypass).toBe(1)
})
```

## 3. What the implementation hides
- **The command registry.** Each catalogue entry is one `defineCommand` record: `{ kind, from: 'extension-page' | 'own-tab-site', decode, writes: DocKey[], handle, upgradeInput? }`. The pipeline is generic over it, so adding a command means one file plus one line in `Commands`.
- **Middleware chain.** Envelope version, sender rule (data-driven from `from`; the `own-tab-site` rule calls Muted sites Match on `sender.url`), decode, queue. Ordered, closed list; not caller-registrable.
- **Reactions.** Run after every commit, so handlers never remember side work. They are pure functions of `(prev, next, now)`:
  - *badge* (from the Muting decision);
  - *next-change alarm* (from the decision's next change time);
  - *bypass-ending notice* (from `bypasses`).
  A handler for a future command gets a correct badge for free.
- **Migration chain.** `steps: { key, from, to, up }[]` per document key, plus a v1 splitter. It is used by `openStore` (storage), by `readSnapshot` (in memory, no write) and by `import`. A malformed input fails the whole chain atomically.
- **Delegation to pure modules:** Muting decision (#2), Bypass budget (#3: offer, take, rollover, wait selection), Usage (#4: record, prune to 12 weeks, local-date keys), Muted sites (#5: Parse, Match). Handlers are a few lines of glue between them.
- **Navigation dedup** for `record-mute`: a bounded in-memory set keyed by tab and navigation, so repeated sends count once. It is lost on background restart; at worst one extra count.
- **Defaults and First run:**
  - the install document;
  - the suggested Schedules;
  - `firstRun: 'pending'` and its `open-page` effect.

## 4. Dependency strategy and adapters

| Dependency | Category | Adapters |
|---|---|---|
| `storage.local` + `onChanged` | ports & adapters | `chromeStorage()` (prod); `memoryStorage(seed?)` (tests, First run preview); both implement `StorageAdapter` (get/set by key, `onChanged`) |
| command transport | ports & adapters | `messagingTransport()` (`runtime.sendMessage`; background side `listen(store)` fills `SenderInfo` from the real `sender`, never from the payload); `directTransport(store, sender)` (tests, and background callers such as the context menu and the shortcut) |
| clock + time zone | injected | `Date.now` / `fixedClock(iso, tz)` |
| badge, alarms, `tabs.sendMessage`, `tabs.create` | true external | none inside the store; `Effect[]` values, applied by an exhaustive `applyEffect` switch in the entrypoint (adding an effect kind fails typecheck until wiring handles it) |
| #2–#5 | in-process | none; called directly, tested directly |

The entrypoint is roughly 40 lines:
- `openStore(chromeStorage(), Date.now)`;
- `listen(store)` on `onMessage`;
- `alarms.onAlarm` → `store.lifecycle({ alarm })`;
- `onInstalled` → `lifecycle('installed' | 'updated')`;
- the context menu → `directTransport(store, { context: 'background' })`, which sends `add-muted-site`;
- every returned effect goes to `applyEffect`.

## 5. Trade-offs

**Where leverage is high**
- **Follow-up features as entries, not reshapes:**
  - Path rules: `MutedSiteRule` gains `'path'`, Parse stops dropping, and a config v3 step adds nothing because host rules stay valid. The sender rule and Bypass/Usage keys are unchanged (keyed by `MutedSiteId`).
  - Soften the page: the Muting decision answer gains `treatment: 'overlay' | 'soften'`; readers that ignore it keep showing the Overlay.
  - Per-category Schedules: `appliesTo` widens, with a v3 step that writes `'all'`.
  - More Usage events: a new `UsageEventKind`, with no migration, because counts are open-keyed.
- **Reactions** give every command a correct badge and alarm for free; this is the single biggest locality win.
- **Errors as values with three shared modes:** each surface handles `refused`, `rejected` and `not-found` once.
- **Tests** never register handlers or middleware; they cross the same seam as callers (`openStore` + clients + `readSnapshot`).

**Where it is thin**
- **The middleware chain is a one-adapter seam.** It has one ordered list and nothing varies across it; by SKILL.md's own rule it is indirection. Its honest value is ordering discipline, not pluggability. Inlining it into `dispatch` loses nothing today.
- **Command-schema versioning (`Envelope.v`, `upgradeInput`) is mostly hypothetical.** All contexts ship together. Skew happens only when an orphaned page talks to a freshly updated background, and `rejected` already covers that.
- **Open `UsageEventKind`** buys migration-free growth at the cost of exhaustive typing. A typo'd kind compiles.
- **The catalogue is wider than a minimal design's.** That is 17 entries, because the settings edits are separate domain commands (37 forbids collapsing them into a patch).

**What a 2.0 ticket author would find awkward**
- **One new command touches four places:** the `Commands` entry, `defineCommand` (with `from`, `decode`, `writes`), the handler, and possibly a new `Effect` kind plus its `applyEffect` case. The registry localises the logic but not the declarations.
- **Two "versions" to keep apart:** `Envelope.v` (command schema) versus `ConfigDoc.v` (storage). Both are needed for the follow-up story; in 2.0 they will be confused.
- **"Does my change need a reaction or a handler effect?"** This has to be learned. The rule: if it can be derived from `(prev, next, now)`, it is a reaction; otherwise the handler emits the effect.
- **`take-bypass` trusts `waited`.** Friction is soft by design (PRODUCT.md Principle 1), but a ticket author may expect the store to time the wait itself. That would need a two-step offer/take and stored offers.
