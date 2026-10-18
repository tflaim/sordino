// Domain commands (decision 37), their outcomes, and who may send them (decision 40).
// A new command touches four places here and one in store.ts: `Command`,
// `OutcomeMap`, `SENDERS`, `parseCommand`, and its handler.
import { LENGTHS, type Length } from '@/shared/muting'
import type { AddMutedSiteOutcome, MutedSite } from '@/shared/muted-sites'
import {
  coerceScheduleDraft,
  type Schedule,
  type ScheduleDraft,
  type ScheduleReason,
} from '@/shared/schedule'
import { isRecord } from './docs'
import { DEFAULT_CATEGORIES } from '@/shared/types'

export type Command =
  | { type: 'set-category'; id: string; enabled: boolean; disabledSites: string[] }
  | { type: 'set-bypass-budget'; maxBypasses: number }
  | {
      type: 'start'
      categoryIds: string[]
      schedule: ScheduleDraft
      maxBypasses: number
      bypassWaitSeconds: number
    }
  | { type: 'mute-now'; length: Length }
  | { type: 'pause'; length: Length }
  | { type: 'back-to-schedule' }
  | { type: 'save-schedule'; schedule: ScheduleDraft }
  | { type: 'delete-schedule'; id: string }
  | { type: 'add-muted-site'; input: string }
  | { type: 'remove-muted-site'; id: string }

export interface OutcomeMap {
  'set-category': { kind: 'saved' } | { kind: 'missing' }
  'set-bypass-budget': { kind: 'saved' }

  start:
    | { kind: 'started' }
    | { kind: 'already-started' }
    | { kind: 'refused'; reasons: ScheduleReason[] }
  'mute-now': { kind: 'muting'; until: number }
  pause: { kind: 'paused'; until: number }
  'back-to-schedule': { kind: 'back-to-schedule' } | { kind: 'already-on-schedule' }
  'save-schedule':
    | { kind: 'saved'; schedule: Schedule }
    | { kind: 'unchanged' }
    | { kind: 'refused'; reasons: ScheduleReason[] }
  'delete-schedule': { kind: 'deleted' } | { kind: 'missing' }
  'add-muted-site': AddMutedSiteOutcome
  'remove-muted-site': { kind: 'removed'; site: MutedSite } | { kind: 'not-on-list' }
}

export type Outcome<C extends Command> = OutcomeMap[C['type']]

/**
 * A refusal is an outcome. `ok: false` means the command did not run: nothing
 * was written and no effects were returned.
 */
export type Result<C extends Command> =
  { ok: true; outcome: Outcome<C> } | { ok: false; error: { code: ErrorCode; detail: string } }

export type ErrorCode = 'invalid-command' | 'not-allowed' | 'storage-failed' | 'transport-lost'

export type Sender =
  /** Popup, settings, First run: any command. */
  | { kind: 'page' }
  /** A content script, with its frame's URL. */
  | { kind: 'tab'; tabId: number; url: string }
  /** Alarms, context menu: any command. */
  | { kind: 'background' }

/**
 * Which senders may run each command. Content scripts will get Record mute,
 * Turn back and Take bypass, for the muted site matching their own tab only
 * (#5, #6); everything else is for extension pages and the background.
 */
const SENDERS: { [T in Command['type']]: 'extension' } = {
  start: 'extension',
  'set-category': 'extension',
  'set-bypass-budget': 'extension',
  'mute-now': 'extension',
  pause: 'extension',
  'back-to-schedule': 'extension',
  'save-schedule': 'extension',
  'delete-schedule': 'extension',
  'add-muted-site': 'extension',
  'remove-muted-site': 'extension',
}

export function mayRun(command: Command, sender: Sender): boolean {
  return SENDERS[command.type] === 'extension' && sender.kind !== 'tab'
}

const isLength = (v: unknown): v is Length => LENGTHS.includes(v as Length)

/** Runtime validation: a command off the wire is untrusted, whatever its static type. */
export function parseCommand(raw: unknown): Command | null {
  if (!isRecord(raw)) return null
  switch (raw.type) {
    case 'set-category':
      return typeof raw.id === 'string' &&
        raw.id.trim() &&
        typeof raw.enabled === 'boolean' &&
        Array.isArray(raw.disabledSites) &&
        raw.disabledSites.every((site) => typeof site === 'string')
        ? {
            type: 'set-category',
            id: raw.id.trim(),
            enabled: raw.enabled,
            disabledSites: [...new Set(raw.disabledSites)] as string[],
          }
        : null
    case 'set-bypass-budget':
      return isIntegerIn(raw.maxBypasses, 1, 10)
        ? { type: 'set-bypass-budget', maxBypasses: raw.maxBypasses }
        : null
    case 'start': {
      const schedule = coerceScheduleDraft(raw.schedule)
      const categoryIds = raw.categoryIds
      if (
        !schedule ||
        !Array.isArray(categoryIds) ||
        categoryIds.length === 0 ||
        !categoryIds.every(
          (id) => typeof id === 'string' && DEFAULT_CATEGORIES.some((c) => c.id === id)
        ) ||
        !isIntegerIn(raw.maxBypasses, 1, 10) ||
        !isIntegerIn(raw.bypassWaitSeconds, 0, 15)
      )
        return null
      return {
        type: 'start',
        categoryIds: [...new Set(categoryIds)] as string[],
        schedule,
        maxBypasses: raw.maxBypasses,
        bypassWaitSeconds: raw.bypassWaitSeconds,
      }
    }
    case 'mute-now':
    case 'pause':
      return isLength(raw.length) ? { type: raw.type, length: raw.length } : null
    case 'back-to-schedule':
      return { type: 'back-to-schedule' }
    case 'save-schedule': {
      const schedule = coerceScheduleDraft(raw.schedule)
      return schedule ? { type: 'save-schedule', schedule } : null
    }
    case 'delete-schedule':
      return typeof raw.id === 'string' && raw.id.trim()
        ? { type: 'delete-schedule', id: raw.id.trim() }
        : null
    case 'add-muted-site':
      return typeof raw.input === 'string' ? { type: 'add-muted-site', input: raw.input } : null
    case 'remove-muted-site':
      return typeof raw.id === 'string' ? { type: 'remove-muted-site', id: raw.id } : null
    default:
      return null
  }
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}
