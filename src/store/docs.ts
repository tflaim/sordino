// The three stored documents and how raw storage values become them.
// Unversioned data is v1 (the 1.x `sordino_settings` key); these are v2.
import type { Mode } from '@/shared/muting'
import { adoptInputs, storedMutedSite, type MutedSite } from '@/shared/muted-sites'
import { schedulesFromConfig, schedulesFromLegacy, type Schedule } from '@/shared/schedule'
import { legacyCategories, legacyCustomSites, parseCategories } from './legacy-sites'
import type { Category } from '@/shared/types'

export const VERSION = 2

/** Portable setup. Runtime choices and budget used belong to state. */
export interface ConfigDoc {
  version: typeof VERSION
  schedules: Schedule[]
  ownSites: MutedSite[]
  categories: Category[]
  maxBypasses: number
  bypassDurationMinutes: number
  bypassWaitSeconds: number
  ownLine: string
  stillness: boolean
  firstRunDone: boolean
}

/** What is happening now: the latest Mute now or Pause (null = on schedule). */
export interface StateDoc {
  version: typeof VERSION
  mode: Mode | null
}

/** Daily counts: filled in by the Usage ticket (#9). */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface UsageDoc {
  version: typeof VERSION
  // Usage owns the counts schema (#9); retain its additive JSON fields.
  [key: string]: JsonValue
}

/**
 * Each list on `config` is the list, even when empty (the user deleted it).
 * A missing `schedules` array is v1, or a config written before schedules moved:
 * take the 1.x list, or the suggested schedules when there isn't one.
 * A missing `ownSites` array takes the 1.x custom list (junk dropped, sites an
 * enabled category already mutes skipped). An empty array is not filled again.
 */
export function resolveConfig(rawConfig: unknown, legacySettings: unknown): ConfigDoc {
  const record = isRecord(rawConfig) ? rawConfig : null
  const legacy = isRecord(legacySettings) ? legacySettings : null
  const categories =
    record && Array.isArray(record.categories)
      ? parseCategories(record.categories)
      : legacyCategories(legacySettings)
  return {
    version: VERSION,
    schedules:
      record && Array.isArray(record.schedules)
        ? schedulesFromConfig(record.schedules)
        : schedulesFromLegacy(legacySettings),
    ownSites:
      record && Array.isArray(record.ownSites)
        ? parseOwnSites(record.ownSites)
        : adoptInputs(legacyCustomSites(legacySettings), {
            categories,
            ownSites: [],
          }),
    categories,
    maxBypasses: option(record?.maxBypasses, legacy?.maxBypasses, 3, 1, 10),
    bypassDurationMinutes: option(
      record?.bypassDurationMinutes,
      legacy?.bypassDurationMinutes,
      5,
      1,
      30
    ),
    bypassWaitSeconds: option(record?.bypassWaitSeconds, undefined, 5, 0, 15),
    ownLine: typeof record?.ownLine === 'string' ? record.ownLine : '',
    stillness: record?.stillness === true,
    firstRunDone: typeof record?.firstRunDone === 'boolean' ? record.firstRunDone : legacy !== null,
  }
}

export const parseConfig = (raw: unknown): ConfigDoc => resolveConfig(raw, undefined)

/** Repairs field by field: a malformed own site is dropped, the rest is kept. */
function parseOwnSites(raw: unknown): MutedSite[] {
  if (!Array.isArray(raw)) return []
  const sites: MutedSite[] = []
  for (const item of raw) {
    const site = storedMutedSite(item)
    if (site && !sites.some((kept) => kept.id === site.id)) sites.push(site)
  }
  return sites
}

export function parseUsage(raw?: unknown): UsageDoc {
  return isRecord(raw) && raw.version === VERSION && isJson(raw)
    ? ({ ...raw, version: VERSION } as UsageDoc)
    : { version: VERSION }
}

/** JSON data only: import and export must survive a file round-trip. */
export function isJson(raw: unknown): raw is JsonValue {
  if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') return true
  if (typeof raw === 'number') return Number.isFinite(raw)
  if (Array.isArray(raw)) return raw.every(isJson)
  return isRecord(raw) && Object.values(raw).every(isJson)
}

function option(
  current: unknown,
  legacy: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = current === undefined ? legacy : current
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max
    ? raw
    : fallback
}

/** Repair mode while retaining additive v2 runtime fields owned by the bypass ticket. */
export function parseState(raw: unknown): StateDoc {
  const doc = isRecord(raw) ? raw : {}
  return { ...(doc.version === VERSION ? doc : {}), version: VERSION, mode: parseMode(doc.mode) }
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
