// The three stored documents and how raw storage values become them.
// Unversioned data is v1 (the 1.x `sordino_settings` key); these are v2.
import type { Mode } from '@/shared/muting'
import { schedulesFromConfig, schedulesFromLegacy, type Schedule } from '@/shared/schedule'

export const VERSION = 2

/** Sites, bypass options, own line and Stillness are filled in by later tickets. */
export interface ConfigDoc {
  version: typeof VERSION
  schedules: Schedule[]
}

/** What is happening now: the latest Mute now or Pause (null = on schedule). */
export interface StateDoc {
  version: typeof VERSION
  mode: Mode | null
}

/** Daily counts: filled in by the Usage ticket (#9). */
export interface UsageDoc {
  version: typeof VERSION
}

/**
 * `config.schedules` is the list, even when empty (the user deleted them).
 * A config with no list yet is v1, or the empty config written before schedules
 * moved: take the 1.x list, or the suggested schedules when there isn't one.
 */
export function resolveConfig(rawConfig: unknown, legacySettings: unknown): ConfigDoc {
  if (isRecord(rawConfig) && Array.isArray(rawConfig.schedules)) {
    return { version: VERSION, schedules: schedulesFromConfig(rawConfig.schedules) }
  }
  return { version: VERSION, schedules: schedulesFromLegacy(legacySettings) }
}

export const parseConfig = (raw: unknown): ConfigDoc => resolveConfig(raw, undefined)

export const parseUsage = (): UsageDoc => ({ version: VERSION })

/** Repairs field by field: a malformed field falls back to its default, the rest is kept. */
export function parseState(raw: unknown): StateDoc {
  const doc = isRecord(raw) ? raw : {}
  return { version: VERSION, mode: parseMode(doc.mode) }
}

function parseMode(raw: unknown): Mode | null {
  if (!isRecord(raw)) return null
  const { kind, since, until } = raw
  if (kind !== 'mute-now' && kind !== 'pause') return null
  if (!isTime(since) || !isTime(until) || until <= since) return null
  return { kind, since, until }
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
