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

export type Command =
  | { type: 'mute-now'; length: Length }
  | { type: 'pause'; length: Length }
  | { type: 'back-to-schedule' }
  | { type: 'save-schedule'; schedule: ScheduleDraft }
  | { type: 'delete-schedule'; id: string }
  | { type: 'add-muted-site'; input: string }
  | { type: 'remove-muted-site'; id: string }
  | { type: 'record-mute'; siteId: string; navigationId: string }
  | { type: 'turn-back'; siteId: string; navigationId: string }

export interface OutcomeMap {
  'record-mute': { kind: 'recorded' | 'already-recorded' | 'not-muted'; offeredAt: number | null }
  'turn-back': { kind: 'turned-back' | 'already-turned-back' | 'not-recorded' }
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
 * Record mute and Turn back may come from content scripts. The store checks
 * their site against the authoritative sender URL. Take bypass comes in #6.
 * Everything else is for extension pages and the background.
 */
const SENDERS: { [T in Command['type']]: 'extension' | 'content' } = {
  'record-mute': 'content',
  'turn-back': 'content',
  'mute-now': 'extension',
  pause: 'extension',
  'back-to-schedule': 'extension',
  'save-schedule': 'extension',
  'delete-schedule': 'extension',
  'add-muted-site': 'extension',
  'remove-muted-site': 'extension',
}

export function mayRun(command: Command, sender: Sender): boolean {
  return SENDERS[command.type] === 'content' || sender.kind !== 'tab'
}

const isLength = (v: unknown): v is Length => LENGTHS.includes(v as Length)

/** Runtime validation: a command off the wire is untrusted, whatever its static type. */
export function parseCommand(raw: unknown): Command | null {
  if (!isRecord(raw)) return null
  switch (raw.type) {
    case 'record-mute':
    case 'turn-back':
      return typeof raw.siteId === 'string' &&
        raw.siteId.length > 0 &&
        raw.siteId.length <= 253 &&
        typeof raw.navigationId === 'string' &&
        raw.navigationId.length > 0 &&
        raw.navigationId.length <= 128
        ? { type: raw.type, siteId: raw.siteId, navigationId: raw.navigationId }
        : null
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
