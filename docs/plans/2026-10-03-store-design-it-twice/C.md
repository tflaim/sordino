# C: Sordino store, optimised for the most common caller

Constraint: the Overlay session at `document_start` and the popup are the hot callers, so each gets a **per-surface client** whose production form is a one-liner with no arguments beyond the page URL. Settings, import, schedules and background wiring use the raw typed command union and pay the learning cost.

## 1. Interface

Three layers, top-down. Callers normally touch only the first.

### 1a. Per-surface clients (`src/store/clients/*`)

```ts
// ---- Overlay (content script, plain DOM) ----
function overlayGate(url: string, deps?: ClientDeps): Promise<OverlayGate>
function watchOverlayGate(url: string, onGate: (g: OverlayGate) => void, deps?: ClientDeps): () => void

type OverlayGate =
  | { kind: 'notMutedSite' }                                   // early exit: no timers, config-only subscription
  | { kind: 'clear'; site: MutedSite; recheckAt: number | null } // Muted site, muting not in effect
  | { kind: 'bypassed'; site: MutedSite; until: number; recheckAt: number }
  | {
      kind: 'muted'; site: MutedSite
      source: { kind: 'schedule'; name: string } | { kind: 'muteNow' }
      until: number | null                                     // honest end, merged across schedules
      offer: BypassOffer                                       // from Bypass budget (#3)
      ownLine: string | null; stillness: boolean; recheckAt: number | null
      recordMute(): Promise<void>                              // idempotent per gate document
      turnBack(): Promise<void>
      takeBypass(waited: { seconds: number }): Promise<TakeBypassOutcome>
    }

type BypassOffer = { waitSeconds: number; budgetSpent: boolean; remainingToday: number; lengthMinutes: number }
type TakeBypassOutcome =
  | { kind: 'granted'; until: number; remainingToday: number }
  | { kind: 'waitLonger'; seconds: number }                  // budget spent in another tab during the wait
  | { kind: 'notMuted' }                                     // Pause / Back to schedule landed meanwhile

// ---- Popup (React) ----
function usePopup(deps?: ClientDeps): {
  status: MutingStatus                                       // Muting decision (#2) at now, re-derived at nextChangeAt
  today: UsageDay                                            // raw counts: mutes, turnBacks, bypasses, pauses
  pause(length: PauseLength): Promise<PauseOutcome>
  muteNow(length: MuteNowLength): Promise<MuteNowOutcome>
  backToSchedule(): Promise<BackToScheduleOutcome>
}
type PauseLength = '15m' | '1h' | 'restOfToday'              // decision 14
type MuteNowLength = { minutes: number } | 'restOfToday'     // decision 13: always finite
type MutingStatus = {
  inEffect: boolean
  source: { kind: 'schedule'; name: string } | { kind: 'muteNow' } | { kind: 'pause' } | { kind: 'none' }
  until: number | null; nextChangeAt: number | null; firstRunDone: boolean
}
type PauseOutcome = { kind: 'paused'; until: number }

// ---- Settings + First run (React): the wide door ----
function useSettings(deps?: ClientDeps): {
  config: Config; usage: UsageWeeks
  send: <C extends PageCommand>(cmd: C) => Promise<OutcomeOf<C>>
  exportFile(opts: { includeUsage: boolean }): string        // pure, client-side: reads never write
}
```

### 1b. Ports beneath the clients (`src/store/ports.ts`)

```ts
interface StorageArea {                                      // chrome.storage.local | in-memory
  get(keys: StoreKey[]): Promise<Partial<Record<StoreKey, unknown>>>
  set(items: Partial<Record<StoreKey, unknown>>): Promise<void>
  onChanged(cb: (changed: StoreKey[]) => void): () => void
}
type StoreKey = 'config' | 'state' | 'usage'
interface CommandPort { send<C extends Command>(cmd: C): Promise<OutcomeOf<C>> }  // runtime.sendMessage | direct
type ClientDeps = { storage: StorageArea; port: CommandPort; now: () => number }
```

### 1c. Background core (`src/store/core.ts`, background only)

```ts
function createSordinoStore(deps: { storage: StorageArea; now: () => number }): {
  run<C extends Command>(cmd: C, from: Sender): Promise<{ outcome: OutcomeOf<C> | Refused; effects: Effect[] }>
}
type Sender = { kind: 'extensionPage' } | { kind: 'tab'; tabId: number; url: string } | { kind: 'background' }
type Refused = { kind: 'refused'; reason: 'senderNotAllowed' | 'notThisTabsSite' }

type Command =
  // tab-allowed (decision 40), always for the Muted site matching sender.url
  | { type: 'recordMute'; site: MutedSite } | { type: 'turnBack'; site: MutedSite }
  | { type: 'takeBypass'; site: MutedSite; waitedSeconds: number }
  // extension pages
  | { type: 'pause'; length: PauseLength } | { type: 'muteNow'; length: MuteNowLength } | { type: 'backToSchedule' }
  | { type: 'startFirstRun'; choices: FirstRunChoices }
  | { type: 'addMutedSite'; input: string } | { type: 'removeMutedSite'; site: MutedSite }
  | { type: 'setCategory'; id: CategoryId; on: boolean } | { type: 'setCategorySite'; id: CategoryId; site: MutedSite; on: boolean }
  | { type: 'saveSchedule'; schedule: ScheduleDraft } | { type: 'deleteSchedule'; id: ScheduleId }
  | { type: 'setBypassOptions'; waitSeconds?: number; lengthMinutes?: number; budget?: number }
  | { type: 'setOwnLine'; text: string } | { type: 'setStillness'; on: boolean }
  | { type: 'importSettings'; text: string }
  // background only
  | { type: 'migrateStored'; reason: 'install' | 'update' }
  | { type: 'muteTimeReached' }                              // an alarm fired: prune ended Mute now / Pause / Bypasses
type PageCommand = Exclude<Command, { type: 'migrateStored' | 'muteTimeReached' }>

type Effect =
  | { kind: 'badge'; text: string; tone: 'muting' | 'paused' | 'bypassed' | 'off' }
  | { kind: 'alarm'; at: number } | { kind: 'clearAlarm' }   // one alarm: the next moment anything ends
  | { kind: 'notifyTabs'; urlMatches: MutedSite } | { kind: 'openFirstRun' }
function applyEffects(effects: Effect[]): Promise<void>       // thin chrome.* wiring, untested by Vitest
```

### What a caller must know (beyond types)

**Invariants**
- One writer: every command runs in background, serialised; its outcome describes the state after that command alone. Check-and-act (budget, duplicates) is atomic.
- A command's promise resolves only after the write is committed. A no-op command (adding a site already muted, Pause while that same Pause runs) writes nothing and fires no `onChanged`.
- Reading never writes, in any context. `status`, `gate` and `config` are always already migrated to the current version.
- UIs render from the subscription; outcomes are for messaging ("Paused until 14:05", "already muted via Social"), not for local state patches (1.x's settings rollback bug).
- Nothing is muted before First run: every gate is `notMutedSite` until `startFirstRun` commits.

**Ordering**
- Overlay: `overlayGate` → render → `recordMute()` once → count down `offer.waitSeconds` → `takeBypass({ seconds })`. If the outcome is `waitLonger`, keep counting and retry; never disable the Bypass (ADR-0002).
- Mute now / Pause: most recent wins (decision 15). Popup must not pre-compute precedence; read `status` after the subscription fires.
- Background: `migrateStored` must run in `onInstalled` before any other command is accepted; the core queues commands behind it.

**Error modes**
- Domain refusals are outcome kinds, never throws (`alreadyMuted`, `rejected`, `waitLonger`, `refused`).
- The only rejection is transport failure (`SordinoUnreachable`), typically the orphaned content script after an extension update. The overlay client **fails closed**: a `muted` gate stays muted and its commands resolve silently. 1.x failed open (candidates §6); this reverses it on purpose.
- Sender rule 40 is enforced in the core from `Sender`. The overlay client additionally *binds* the gate's site, so a content script cannot even express another site; that binding is convenience, not security.

## 2. Usage examples

```ts
// Popup: start a 1-hour Pause
const { status, pause } = usePopup()
<button onClick={() => pause('1h')}>Pause 1 hour</button>   // label reads status.until once onChanged fires

// Overlay session at document_start: decide, then take a Bypass
const gate = await overlayGate(location.href)
if (gate.kind !== 'muted') return                           // most pages of the web stop here
renderer.show(gate); void gate.recordMute()
await renderer.countdown(gate.offer.waitSeconds)
let r = await gate.takeBypass({ seconds: gate.offer.waitSeconds })
while (r.kind === 'waitLonger') { await renderer.countdown(r.seconds); r = await gate.takeBypass({ seconds: r.seconds }) }
if (r.kind === 'granted') renderer.lift(r.until)

// Settings: add "Reddit.com/r/foo"
const { send } = useSettings()
const out = await send({ type: 'addMutedSite', input: 'Reddit.com/r/foo' })
// -> { kind: 'alreadyMuted', site: 'reddit.com', via: { category: 'social' }, ignored: ['path'] }
//    (Muted sites #5 canonicalises; path rules deferred, decision 3). With Social off:
// -> { kind: 'added', site: 'reddit.com', ignored: ['path'] }

// Settings: import a v1 file
const out = await send({ type: 'importSettings', text: await file.text() })
// -> { kind: 'imported', fromVersion: 1, replaced: ['config'], usage: 'kept' }
// or { kind: 'rejected', reason: 'notJson' | 'notSordino' | 'newerVersion' | 'invalid', detail } and nothing written

// Test (Vitest): the same clients, pre-bound to in-memory storage, direct port, fixed clock
test('a spent budget still grants a Bypass after 30 s', async () => {
  const t = createTestSordino({ now: '2026-10-05T10:00', seed: v1Fixture('9e31291') })
  await t.background.run({ type: 'migrateStored', reason: 'update' })
  for (const _ of range(3)) await t.overlay('https://x.com/').bypass()        // helper: gate + take
  const gate = await t.overlay('https://old.reddit.com/r/foo').gate()
  expect(gate).toMatchObject({ kind: 'muted', site: 'reddit.com', offer: { waitSeconds: 30, budgetSpent: true } })
  expect(await gate.takeBypass({ seconds: 5 })).toEqual({ kind: 'waitLonger', seconds: 25 })
  expect(await gate.takeBypass({ seconds: 30 })).toMatchObject({ kind: 'granted' })
  expect(t.effects()).toContainEqual({ kind: 'alarm', at: t.at('10:05') })
})
```

`createTestSordino` returns `{ overlay(url), popup(), settings(), background, storage, clock, effects() }`. `overlay(url)` binds a `tab` sender with that URL; `popup()`/`settings()` bind `extensionPage`; hooks have plain-object twins (`popupClient`, `settingsClient`) that the hooks wrap.

## 3. What the implementation hides

- **Persistence:** three keys, each carrying `v`; write-only-on-change by key (Usage writes never rewrite `config`); the serial command queue.
- **Migration:** one `migrate(unknown) → Current` chain used by `migrateStored`, by `importSettings`, and by **every reader**. Reader-side migration is in-memory only (decision 35), so a v1 user stays muted through the window between the extension updating and `onInstalled` running.
- **Duration resolution:** `'restOfToday'` → next local midnight, `'1h'` → `now + 3.6e6`, using the injected clock, in the core; the popup never does date arithmetic.
- **Decisions:** the gate and `status` call Muting decision (#2), Bypass budget (#3) and Muted sites match (#5) on the snapshot; commands call the same modules plus Usage (#4) inside the writer. Precedence, day rollover that spares live Bypasses, the 30 s spent wait, and "Pause counts once in Usage" all live there.
- **Re-decision timing:** `watchOverlayGate` and `usePopup` subscribe to only the keys they read and arm one timer at `recheckAt`/`nextChangeAt`; `notMutedSite` arms nothing.
- **Effects derivation:** badge text/tone and the single next alarm come from the post-command snapshot, so `muteTimeReached` and every command produce them the same way.
- **Transport:** message envelope, payload validation, `MessageSender` → `Sender` mapping (`sender.url` under `runtime.getURL('')` → extension page; `sender.tab` → tab), the tab-site check.
- **`recordMute` idempotence** per gate document (one Mute count per navigation; SPA same-site URL changes reuse the gate).

## 4. Dependency strategy and adapters

| Dependency | Category (DEEPENING.md) | Adapters |
|---|---|---|
| `chrome.storage.local` + `onChanged` | Ports & adapters | `chromeStorage()` (prod), `memoryStorage(seed)` (tests, First run preview) |
| `runtime.sendMessage` + `sender` | Ports & adapters | `messagingPort()` + `listenForCommands(store)` (prod halves), `directPort(store, sender)` (tests) |
| Clock | Injected | `Date.now` / fixed clock with `advance()` |
| Badge, alarms, `tabs.sendMessage`, open First run | True external | returned `Effect[]`; `applyEffects` is the only code that touches them; tests assert on effects |
| Muting decision, Bypass budget, Usage, Muted sites | In-process | none; internal seams of the store, tested directly as pure modules |

Default `ClientDeps` resolve **lazily** on first call (`deps ?? productionDeps()`), so importing a client never touches `chrome`; Vitest imports the same modules and passes harness deps. Background wiring is three lines: `const store = createSordinoStore({ storage: chromeStorage(), now: Date.now })`, `listenForCommands(store, applyEffects)`, and alarm/install/context-menu listeners that call `store.run(..., { kind: 'background' })` (context-menu "Mute this site" → `addMutedSite` with the tab URL).

## 5. Trade-offs

**High leverage**
- Overlay: one call answers "show?", "why, until when?", "what wait?", "when to look again?", with commands pre-bound to the right site. The content script never sees `Config`, `State`, versions or sender rules.
- Popup: `usePopup()` is the whole store for its ticket; durations are tokens, not timestamps.
- Tests use the production clients through `createTestSordino`, so the interface really is the test surface; v1 fixtures, races and the spent budget are one-file tests.

**Thin leverage**
- Settings gets `send` over a ~17-member union: as wide as the command list, close to shallow for that caller. Every new setting is a new `Command` member, an `OutcomeOf` entry, a core case and a sender-table row (four edits in one module, but four).
- Usage tab reads `usage` raw and calls Usage (#4) itself; no client derivation.

**Awkward for a 2.0 ticket author**
- **Façade growth.** Three clients recombine #2/#3/#5 three ways. Rule: a client method exists only if it derives something or binds a sender; otherwise the surface uses `send`. The first test is popup Quick add returning: it should be `send({ type: 'addMutedSite' })` from a popup `useCommands()`, not `popup.addSite`.
- **Overlap with Overlay session (#6).** The gate returns facts, bound commands and `recheckAt`; the session owns DOM lifecycle, media fade, toasts, the countdown and the SPA navigation policy. `watchOverlayGate` is the line most likely to blur; it must not grow rendering hooks.
- **`notifyTabs`** is mostly redundant with `onChanged` (gates already re-decide); it stays for decision 38 and the context-menu case, but ticket authors will ask which to use. Answer: render from `onChanged`; `notifyTabs` only for messages that are not state.
- **Trust in `waitedSeconds`.** The Bypass wait is client-reported; a modified content script could skip it. Acceptable for a soft-muting product (PRODUCT.md), but it is the store trusting the caller.
- **Two shapes per React client** (hook + plain object) to keep tests React-free.
- Commands from the overlay need the background awake; MV3 wakes it on `sendMessage`, but the first `takeBypass` after idle pays the start-up cost inside the countdown.
