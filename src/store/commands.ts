// Domain commands (decision 37), their outcomes, and who may send them (decision 40).
// A new command touches four places here and one in store.ts: `Command`,
// `OutcomeMap`, `SENDERS`, `parseCommand`, and its handler.
import { LENGTHS, type Length } from '@/shared/muting'
import { isRecord } from './docs'

export type Command =
  | { type: 'mute-now'; length: Length }
  | { type: 'pause'; length: Length }
  | { type: 'back-to-schedule' }

export interface OutcomeMap {
  'mute-now': { kind: 'muting'; until: number }
  pause: { kind: 'paused'; until: number }
  'back-to-schedule': { kind: 'back-to-schedule' } | { kind: 'already-on-schedule' }
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
  'mute-now': 'extension',
  pause: 'extension',
  'back-to-schedule': 'extension',
}

export function mayRun(command: Command, sender: Sender): boolean {
  return SENDERS[command.type] === 'extension' && sender.kind !== 'tab'
}

const isLength = (v: unknown): v is Length => LENGTHS.includes(v as Length)

/** Runtime validation: a command off the wire is untrusted, whatever its static type. */
export function parseCommand(raw: unknown): Command | null {
  if (!isRecord(raw)) return null
  switch (raw.type) {
    case 'mute-now':
    case 'pause':
      return isLength(raw.length) ? { type: raw.type, length: raw.length } : null
    case 'back-to-schedule':
      return { type: 'back-to-schedule' }
    default:
      return null
  }
}
