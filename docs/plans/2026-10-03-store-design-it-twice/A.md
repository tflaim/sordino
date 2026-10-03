# Design A: two entry points (`dispatch` writes, `watch` reads)

Constraint: minimise the interface, maximise leverage per entry point.

## 1. Interface

**Entry points: two.** Plus one constructor that only background calls.
- `dispatch(command, from)` is the only write. Client-side `send(command)` is the *same* entry point reached through the messaging adapter. The adapter supplies `from` and strips `effects`, so it is not a second interface to learn.
- `watch(lens, onView)` is the only read, and it works in any context.
- **Why not one?** Readers must read storage directly, and reads never write (35). A read routed through `dispatch` would wake background and enter the writer queue. Read and write therefore cannot share one function. A one-shot read is `watch` followed by unsubscribing after the first view.

```ts
// ── construction (background only) ─────────────────────────────────────
export function openStore(deps: { storage: StoragePort; clock: Clock }): Dispatch

// ── entry point 1: the one write ───────────────────────────────────────
export type Dispatch = <C extends Command>(command: C, from: Sender) => Promise<Result<C>>
export type Send     = <C extends Command>(command: C) => Promise<OutcomeOf<C>>   // dispatch via messaging adapter
export type Sender   = { kind: 'background' } | { kind: 'extension-page' } | { kind: 'tab'; url: string }
export type Result<C extends Command> = { outcome: OutcomeOf<C>; effects: Effects }

export type Command =
  | { type: 'Start'; choices: FirstRunChoices }              // First run; nothing is muted before it
  | { type: 'MuteNow'; minutes: number }
  | { type: 'Pause'; length: '15m' | '1h' | 'rest-of-today' }
  | { type: 'BackToSchedule' }
  | { type: 'RecordMute'; site: MutedSiteId; navigation: string }  // idempotent per navigation token
  | { type: 'TurnBack'; site: MutedSiteId }
  | { type: 'TakeBypass'; site: MutedSiteId }
  | { type: 'AddMutedSite'; input: string }                  // typed text, or a page URL ("Mute this site")
  | { type: 'RemoveMutedSite'; site: MutedSiteId }
  | { type: 'SetCategory'; category: string; on: boolean }
  | { type: 'SetCategorySite'; category: string; site: MutedSiteId; on: boolean }
  | { type: 'SaveSchedule'; draft: ScheduleDraft }           // create when draft.id is absent
  | { type: 'DeleteSchedule'; id: string }
  | { type: 'SetBypassOptions'; budget?: number; waitSeconds?: number; lengthMinutes?: number }
  | { type: 'SetOwnLine'; text: string }                     // '' clears
  | { type: 'SetStillness'; on: boolean }
  | { type: 'Export'; withUsage: boolean }                   // writes nothing
  | { type: 'Import'; file: unknown; withUsage: boolean }
  | { type: 'Wake'; reason: 'alarm' | 'startup' | 'install' | 'update' }

export type Refusal =                                         // one error vocabulary for every command
  | { refused: 'sender' }                                     // privileged command from a tab, or a site not matching its tab
  | { refused: 'not-a-muted-site'; input: string }
  | { refused: 'already-muted'; site: MutedSiteId; via: { category: string } | 'own' }
  | { refused: 'invalid'; reasons: string[] }                 // e.g. ['no-days', 'start-equals-end']
  | { refused: 'malformed-file'; problems: string[] }
  | { refused: 'newer-version'; found: number; supported: number }

export type OutcomeOf<C extends Command> = ({ ok: false } & Refusal) | ({ ok: true } & OkOf[C['type']])
type OkOf = {
  Start: {}; MuteNow: { until: number }; Pause: { until: number }; BackToSchedule: {}
  RecordMute: { counted: boolean }; TurnBack: {}
  TakeBypass: { site: MutedSiteId; until: number; budgetSpent: boolean }
  AddMutedSite: { site: MutedSiteId; dropped: ('path' | 'www' | 'port' | 'query')[] }
  RemoveMutedSite: {}; SetCategory: {}; SetCategorySite: {}
  SaveSchedule: { id: string }; DeleteSchedule: {}; SetBypassOptions: {}; SetOwnLine: {}; SetStillness: {}
  Export: { file: SordinoFile }
  Import: { fromVersion: number; sites: number; schedules: number; usage: 'kept' | 'replaced' }
  Wake: {}
}

// Effects are *desired external state*, not deltas: every Result carries the whole picture.
export type Effects = {
  badge: { text: string; tone: 'muting' | 'paused' | 'bypass' | 'quiet' }
  alarmAt: number | null                                      // the single next-change alarm
  open?: 'first-run'
}

// ── entry point 2: the one read ────────────────────────────────────────
export function watch(
  deps: { storage: StoragePort; clock: Clock },
  lens: { url?: string; usage?: boolean },
  onView: (w: Watched) => void,
): () => void

export type Watched = { ok: true; view: View } | { ok: false; reason: 'newer-version' | 'orphaned' }
export type View = {
  now: number
  firstRun: 'pending' | 'done'
  config: Readonly<Config>                                    // sites, Categories, Schedules, bypass options, Own line, Stillness
  muting: { inEffect: boolean; source: 'schedule' | 'mute-now' | 'pause' | 'none'; schedule?: string; until: number | null }
  budget: { used: number; total: number; spent: boolean }
  page?: PageView                                             // only when lens.url
  usage?: { days: DayCounts[]; bySite: Record<MutedSiteId, Counts> }   // only when lens.usage; 84 days, Monday-start
}
export type PageView =
  | { kind: 'clear' }                                         // no Muted site matches, or muting is not in effect
  | { kind: 'overlay'; site: MutedSiteId; source: View['muting']['source']; until: number | null
      offer: { waitSeconds: number; remaining: number; spent: boolean; lengthMinutes: number }
      ownLine: string | null; stillness: boolean }
  | { kind: 'bypassed'; site: MutedSiteId; until: number; endingSoon: boolean }
```

**Invariants and ordering**
- **One writer.** `dispatch` runs commands one at a time through a queue inside background, so every check-and-act is atomic. Two `TakeBypass` commands that arrive together for the last unit of Bypass budget cannot overspend it.
- **Migration happens inside the queue.** It runs when the first command after a background restart (usually `Wake`) loads storage. No command ever sees v1 data. No separate init entry point exists.
- **Migrated v1 data counts as First run done.** v1 data gets `firstRun:'done'`, so there is no silent reset (decision 10). Only `Wake{install}` with empty storage returns `open:'first-run'`.
- **Write only on change.** `Export`, a repeated `RecordMute` and `Wake` with nothing expired write nothing. Day rollover happens lazily inside each command and never ends a live Bypass.
- **Sender rules live inside `dispatch` (40).**
  - A `{kind:'tab'}` sender may send only `RecordMute`, `TurnBack` and `TakeBypass`.
  - The `site` must equal the Muted site that the tab's own `url` matches. Matching runs through Muted sites inside the store.
  - Anything else returns `{refused:'sender'}`.
- **`dispatch` never throws for domain reasons.** It rejects only on a storage failure. The messaging adapter turns a rejection into a thrown `send`. Callers treat that as "try again", never as "not muted".
- **When `watch` calls `onView`:**
  - once after the first storage read (async, one `get`, no round trip to background);
  - on every `storage.onChanged` for the keys its lens needs;
  - at the next moment the lensed view can change: Pause or Mute now ending, a Schedule edge, a Bypass ending, 1 min before a Bypass ends, local midnight.
  - If nothing in the lens can change with time, it arms **no timer**. A tab that is not on a Muted site reads `config`+`state` once and then only listens for changes.
- **Reads never write.** `watch` migrates unversioned data in memory only.
  - If the stored version is newer than the code, `watch` delivers `{ok:false,'newer-version'}`.
  - If the extension context is invalidated, it delivers `{ok:false,'orphaned'}` and stops.
  - Either way, callers keep what they show. The Overlay **fails closed**.
- **Keys (36).**
  - `lens.url` reads `config`+`state`.
  - `lens.usage` adds `usage`.
  - The content script never loads `usage`.
- **First run.** `firstRun:'pending'` forces `muting.inEffect=false` and `page.kind='clear'` (decision 24).
- **"Notify tabs" (38) has no effect variant.** `storage.onChanged` → `watch` already reaches every tab, including edits made in settings (M7). Flagged for the comparison.

## 2. Usage examples

**Popup starts a 1-hour Pause.** "Paused until HH:MM" comes from `watch`. The outcome is used only for a refusal.
```ts
const view = useWatch({ usage: true })                       // the one React hook: useSyncExternalStore over watch
const o = await send({ type: 'Pause', length: '1h' })
if (!o.ok) toastRefusal(o)                                    // the success path renders view.muting {source:'pause', until}
```

**Overlay session at `document_start`.** It decides locally, then takes a Bypass.
```ts
const navigation = crypto.randomUUID()                        // one per document; SPA route changes on the same site reuse it
let recorded = false
const stop = watch(contentDeps, { url: location.href }, w => {
  if (!w.ok) return                                           // fail closed: keep whatever is shown
  const p = w.view.page!
  if (p.kind === 'clear') return render.remove()
  if (p.kind === 'bypassed') return p.endingSoon ? render.endingToast(p.until) : render.remove()
  render.show(p)                                              // waitSeconds is 0–15, or 30 when spent (ADR-0002); Turn back is instant
  if (!recorded) { recorded = true; send({ type: 'RecordMute', site: p.site, navigation }) }
})
// Bypass button enabled after p.offer.waitSeconds on the overlay's own countdown:
const o = await send({ type: 'TakeBypass', site: p.site })
if (!o.ok) render.say(o)                                      // e.g. 'sender' if the tab navigated away
// on success do nothing: storage changes, so watch delivers {kind:'bypassed'} and the Overlay lifts
```
- **The Bypass wait.** The Overlay enforces it. The store cannot verify that a content script waited, and a content script that lies has already left the soft path.
- **Once per navigation.** The session owns it, and the store backs it up by being idempotent on `navigation`.

**Settings adds "Reddit.com/r/foo".**
```ts
const o = await send({ type: 'AddMutedSite', input: 'Reddit.com/r/foo' })
// Social on:   { ok: false, refused: 'already-muted', site: 'reddit.com', via: { category: 'social' } }
//              → "Already muted through Social"
// Social off:  { ok: true, site: 'reddit.com', dropped: ['path'] }
//              → "Added reddit.com (paths aren't supported yet)" (decision 3)
// The context menu sends the same command with input = the page URL; no extra command exists.
```

**Import of a v1 file.** 1.x had no export, so a v1 file is a raw `sordino_settings` dump with no version.
```ts
const o = await send({ type: 'Import', file: JSON.parse(text), withUsage: false })
// ok:  { fromVersion: 1, sites: 14, schedules: 4, usage: 'kept' }
//      Categories, own sites, Schedules and bypass options are taken.
//      Runtime state (Pause, Bypasses, budget used) is never imported.
//      The 1.x template lock is dropped, so built-ins become ordinary Schedules (16).
// bad: { ok: false, refused: 'malformed-file', problems: ['schedules[2].startTime: "9am"'] }; storage untouched (39)
```

**A test** (Vitest; in-memory storage, direct-call transport, fixed clock (41)). Both entry points are exercised.
```ts
test('a Pause started mid-Schedule ends on time and the Overlay comes back', async () => {
  const storage = memoryStorage({ sordino_settings: v1Fixture_372cc65 })   // emits onChanged like chrome's
  const clock = fixedClock('2026-10-05T10:00')                            // Monday, inside Work hours
  const dispatch = openStore({ storage, clock })
  await dispatch({ type: 'Wake', reason: 'update' }, BACKGROUND)          // migrates v1 → current
  const r = await dispatch({ type: 'Pause', length: '1h' }, EXTENSION_PAGE)
  expect(r.outcome).toEqual({ ok: true, until: at('11:00') })
  expect(r.effects.alarmAt).toBe(at('11:00'))
  expect(await dispatch({ type: 'Pause', length: '1h' }, tab('https://reddit.com')))
    .toMatchObject({ outcome: { ok: false, refused: 'sender' } })
  const seen = recordViews(watch({ storage, clock }, { url: 'https://old.reddit.com/r/foo' }, ...))
  await flush(); expect(seen.last.page.kind).toBe('clear')
  await clock.advanceTo('11:00'); expect(seen.last.page).toMatchObject({ kind: 'overlay', site: 'reddit.com' })
})
```

## 3. What the implementation hides
- **Storage layout.** Three keys with versions, the migrate chain shared by storage and `Import`, the `sordino_settings` v1 shape, and the export file format. `Export` sits behind `dispatch` so that the format and its migrate chain stay in one place.
- **Writing.** The serial queue, write-only-on-change, lazy day rollover, and pruning of expired Bypasses and of Usage past 12 weeks.
- **Rules.** The sender rules and the URL → Muted site match they rely on.
- **Delegated modules.** Muting decision (precedence: most recent of Mute now and Pause wins; a Schedule never overrides a Pause), Bypass budget (per-site timers, 30 s spent wait), Usage (local-day keys, Monday weeks) and Muted sites (parse and match).
- **Effects.** Badge text and tone, and the one next-change alarm. A single alarm replaces the 1-minute poll.
- **Read side.** Lens-selective key reads, in-memory migration, next-change timers, debouncing of bursts from `onChanged`, and orphan detection.

## 4. Dependency strategy and adapters
- **Storage port** `{ get(keys), set(partial), onChanged(cb) }`. It has two adapters: `chrome.storage.local`, and in-memory that emits change events. This is a real seam. Both `openStore` and `watch` take it.
- **Command transport.** It has two adapters:
  - **Messaging.** `listen(dispatch, applyEffects)` in background classifies `sender` in a fixed order. First, if `sender.url` starts with `runtime.getURL('')`, the sender is `extension-page`; this covers settings and First run, which also run in a tab. Otherwise, if `sender.tab` is set, the sender is `tab` with `sender.url`. Anything else is refused. This mirrors the L9 fix.. It validates the payload shape and calls `dispatch`. It applies `effects` and replies with `outcome` only. `send` wraps `runtime.sendMessage`.
  - **Direct call.** `send = c => dispatch(c, from).then(r => r.outcome)`, used in tests and by background-internal callers.
- **Clock** `{ now(): number; at(t, fn): Cancel }`. It is injected into both entry points. `watch` needs `at` for its timers, so a fixed clock in tests must be advanceable.
- **True external, applied by wiring** (~25 lines in the background entrypoint):
  - `applyEffects` sets the badge, sets or clears the single `sordino` alarm, and opens First run.
  - `alarms.onAlarm` → `Wake{alarm}`; `onInstalled` → `Wake{install|update}`; `onStartup` → `Wake{startup}`.
  - The context menu → `AddMutedSite{input: tab.url}`.
  - The keyboard shortcut is `_execute_action` in the manifest, so it is not a store concern.
- **In-process modules** (Muting decision, Bypass budget, Usage, Muted sites) are internal seams, tested directly. They are shared by `dispatch` and `watch`, so they ship in the content bundle (pure TS, no React; ADR-0003 holds).

## 5. Trade-offs
**Where leverage is high**
- **Overlay session.** The Overlay session collapses to a `switch` over `PageView`. It does no matching, budget arithmetic, precedence or timer maths. The 1 s/30 s polling, the expiry lag and the fail-open bug (candidates #6) disappear by construction.
- **Popup and settings.** They can no longer disagree, because both render `view.muting`. One React hook covers every extension page.
- **Tests.** Tests learn two functions and three adapters. Every 2.0 ticket in the candidates' table is a test that dispatches commands and then watches views.
- **Background wiring.** Effects as desired state make the wiring idempotent. A lost or duplicated `applyEffects` is harmless, and alarm drift (L8) goes away.
- **Adding a command.** A new command is one union member, one `OkOf` row and one handler. There is no new export, no new message type, and no new place to repeat sender checks.

**Where leverage is thin, and what costs it hides**
- **The vocabulary moved; it did not shrink.** Two entry points carry a 19-member `Command` union and a `View`. A caller still learns the command names. The win is that they are in one place with one `Refusal` vocabulary.
- **Live Schedule-form validation.** This is the likeliest leak. `invalid` reasons exist only as a refusal after submit. To show "no days chosen" while the user types, settings will import the Schedule module directly. That is honest, but it is a third de facto entry point. Option: a dry-run flag on `SaveSchedule`, at the cost of a write-queue round trip per keystroke.
- **`watch` is a second deep module in every context.** It runs in every tab, so a timer bug ships everywhere. It also needs its own TZ and DST tests. `View` is a shared shape: a ticket that wants a new derived fact extends it for every reader unless the ticket adds a lens field.
- **Type-level outcome map.** `OutcomeOf<C>` produces poor TS error messages, and the messaging adapter loses the `C` → outcome link unless `send` is generic in the same way. A runtime payload guard per command is still needed (L9), so the union is written twice, as type and as guard, unless the guard is generated from a schema.
- **`Export` through the writer queue.** It costs a round trip and wakes background. The gain is that the file format never leaks into settings.
- **Things a 2.0 ticket author would find awkward:**
  - The Bypass wait is not enforced by the store.
  - "Once per navigation" depends on a token the content side mints.
  - The `Wake` command doubles as install, update and alarm, so its outcome is uninformative and the reason matters only for `effects.open`.
