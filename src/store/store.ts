// The Sordino store: the one writer of Sordino's persisted state, in the
// background only (ADR-0004). Its interface is `openStore`, `dispatch` and `settle`.
import { modeEnd, runningMode } from '@/shared/muting'
import {
  mayRun,
  parseCommand,
  type Command,
  type ErrorCode,
  type Outcome,
  type Result,
  type Sender,
} from './commands'
import { parseConfig, parseState, parseUsage } from './docs'
import { desiredEffects, type Effect } from './effects'
import { legacySchedules } from './legacy'
import type { Clock, StoragePort, StoredDocs, StoredKey } from './ports'

export interface SordinoStore {
  /**
   * Runs one command at a time, in arrival order. The clock is read once, when
   * the command is dequeued. At most one write, of only the keys that changed;
   * a command that changes nothing writes nothing.
   */
  dispatch<C extends Command>(
    command: C,
    sender: Sender
  ): Promise<{ result: Result<C>; effects: Effect[] }>
  /** The desired effects for now (install, startup, alarms). Never writes. */
  settle(): Promise<Effect[]>
}

const KEYS: readonly StoredKey[] = ['config', 'state', 'usage']

/**
 * Reads and parses the three docs and writes back any that were missing,
 * unversioned or repaired, so afterwards all three hold the current version.
 * Rejects only if storage cannot be read or written at all.
 */
export async function openStore(deps: {
  storage: StoragePort
  clock: Clock
}): Promise<SordinoStore> {
  const { storage, clock } = deps
  const raw = await storage.read(KEYS)
  let docs: StoredDocs = {
    config: parseConfig(),
    state: parseState(raw.state),
    usage: parseUsage(),
  }
  const stale = changedKeys(raw, docs)
  if (stale.length) await storage.write(pick(docs, stale))

  const schedules = async () =>
    legacySchedules((await storage.read(['sordino_settings'])).sordino_settings)

  async function run<C extends Command>(
    command: C,
    sender: Sender
  ): Promise<{ result: Result<C>; effects: Effect[] }> {
    const parsed = parseCommand(command)
    if (!parsed) return refuse('invalid-command', `not a Sordino command: ${describe(command)}`)
    if (!mayRun(parsed, sender)) return refuse('not-allowed', `${parsed.type} from ${sender.kind}`)
    const now = clock()
    let current: Awaited<ReturnType<typeof schedules>>
    try {
      current = await schedules()
    } catch (e) {
      return refuse('storage-failed', String(e))
    }
    const { outcome, next } = handle(parsed, docs, now)
    const changed = changedKeys(docs, { ...docs, ...next })
    if (changed.length) {
      const update = pick({ ...docs, ...next }, changed)
      try {
        await storage.write(update)
      } catch (e) {
        return refuse('storage-failed', String(e))
      }
      docs = { ...docs, ...update }
    }
    return {
      result: { ok: true, outcome: outcome as Outcome<C> },
      effects: desiredEffects(current, docs.state, now),
    }
  }

  let queue: Promise<unknown> = Promise.resolve()
  return {
    dispatch(command, sender) {
      const result = queue.then(() => run(command, sender))
      queue = result.catch(() => undefined)
      return result
    },
    async settle() {
      return desiredEffects(await schedules(), docs.state, clock())
    },
  }
}

function handle(
  command: Command,
  docs: StoredDocs,
  now: number
): { outcome: Outcome<Command>; next: Partial<StoredDocs> } {
  const running = runningMode(docs.state.mode, now)
  switch (command.type) {
    case 'mute-now':
    case 'pause': {
      const until = modeEnd(command.length, now)
      const kind = command.type
      // Starting what is already running with the same end changes nothing.
      const mode =
        running?.kind === kind && running.until === until ? running : { kind, since: now, until }
      return {
        outcome: kind === 'mute-now' ? { kind: 'muting', until } : { kind: 'paused', until },
        next: { state: { ...docs.state, mode } },
      }
    }
    case 'back-to-schedule':
      // An ended Mute now or Pause is already back to schedule; it stays stored, ignored.
      return running
        ? { outcome: { kind: 'back-to-schedule' }, next: { state: { ...docs.state, mode: null } } }
        : { outcome: { kind: 'already-on-schedule' }, next: {} }
  }
}

function refuse(code: ErrorCode, detail: string) {
  return { result: { ok: false as const, error: { code, detail } }, effects: [] }
}

function describe(command: unknown): string {
  try {
    return JSON.stringify(command).slice(0, 200)
  } catch {
    return typeof command
  }
}

function changedKeys(before: { [K in StoredKey]?: unknown }, after: StoredDocs): StoredKey[] {
  return KEYS.filter((k) => !sameValue(before[k], after[k]))
}

function pick(docs: StoredDocs, keys: readonly StoredKey[]): Partial<StoredDocs> {
  return Object.fromEntries(keys.map((k) => [k, docs[k]]))
}

/** Structural equality for JSON-shaped values, ignoring key order. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return (
    ka.length === kb.length &&
    ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}
