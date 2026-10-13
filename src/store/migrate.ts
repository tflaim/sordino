// One version boundary for stored documents and imported files. Storage can be
// repaired; a file is validated in full before the same conversion runs.
import { parseMutedSite, storedMutedSite } from '@/shared/muted-sites'
import { coerceScheduleDraft, DAYS_OF_WEEK, validateSchedule } from '@/shared/schedule'
import {
  isJson,
  isRecord,
  parseState,
  parseUsage,
  resolveConfig,
  VERSION,
  type ConfigDoc,
  type UsageDoc,
} from './docs'
import { isCategory } from './legacy-sites'
import type { StoredDocs, StorageKey } from './ports'

export interface ExportFile {
  version: typeof VERSION
  config: ConfigDoc
  usage?: UsageDoc
}

export type ImportResult =
  { ok: true; docs: { config: ConfigDoc; usage?: UsageDoc } } | { ok: false; reason: string }

/** Fails before any startup write when storage belongs to a newer release. */
export function migrateStorage(raw: { [K in StorageKey]?: unknown }): StoredDocs {
  for (const key of ['config', 'state', 'usage', 'sordino_settings'] as const) {
    const reason = versionReason(raw[key], key)
    if (reason) throw new Error(reason)
  }
  return {
    config: resolveConfig(raw.config, raw.sordino_settings),
    state: parseState(raw.state),
    usage: parseUsage(raw.usage),
  }
}

/** Detached JSON, never runtime state. Downloading is the settings UI's job. */
export function exportDocs(docs: StoredDocs, includeUsage: boolean): ExportFile {
  return structuredClone({
    version: VERSION,
    config: docs.config,
    ...(includeUsage ? { usage: docs.usage } : {}),
  })
}

/** Accepts file text or parsed JSON. A refusal cannot produce a write candidate. */
export function parseImport(input: unknown): ImportResult {
  try {
    const raw: unknown = typeof input === 'string' ? JSON.parse(input) : input
    if (!isRecord(raw) || !isJson(raw)) return rejected('The file must contain a JSON object.')
    const rootVersion = versionReason(raw, 'file')
    if (rootVersion) return rejected(rootVersion)
    if (raw.version === VERSION) {
      const version = versionReason(raw.config, 'config') ?? versionReason(raw.usage, 'usage')
      if (version) return rejected(version)
      const reason = validateConfig(raw.config)
      if (reason) return rejected(reason)
      if ('usage' in raw && (!isRecord(raw.usage) || raw.usage.version !== VERSION)) {
        return rejected('Usage must be a version 2 document.')
      }
      return {
        ok: true,
        docs: {
          config: resolveConfig(raw.config, undefined),
          ...('usage' in raw ? { usage: parseUsage(raw.usage) } : {}),
        },
      }
    }
    const legacy = 'sordino_settings' in raw ? raw.sordino_settings : raw
    const version = versionReason(legacy, 'v1 settings')
    if (version) return rejected(version)
    // An envelope claiming v1 cannot smuggle a v2 document through legacy repair.
    if (isRecord(legacy) && legacy.version !== undefined && legacy.version !== 1) {
      return rejected('Expected unversioned or version 1 settings.')
    }
    const reason = validateLegacy(legacy)
    if (reason) return rejected(reason)
    return { ok: true, docs: { config: migrateStorage({ sordino_settings: legacy }).config } }
  } catch {
    return rejected('The file is not valid JSON.')
  }
}

function rejected(reason: string): ImportResult {
  return { ok: false, reason }
}

function versionReason(raw: unknown, label: string): string | null {
  if (!isRecord(raw) || raw.version === undefined) return null
  if (typeof raw.version === 'number' && raw.version > VERSION) {
    return `${label} uses version ${raw.version}; this release supports up to version ${VERSION}.`
  }
  return raw.version === 1 || raw.version === VERSION ? null : `${label} has an invalid version.`
}

function validateConfig(raw: unknown): string | null {
  if (!isRecord(raw) || raw.version !== VERSION) return 'Config must be a version 2 document.'
  for (const field of ['schedules', 'ownSites', 'categories'] as const) {
    if (!Array.isArray(raw[field])) return `Config ${field} must be a list.`
  }
  const schedules = validateSchedules(raw.schedules, false)
  if (schedules) return schedules
  const ownSites = raw.ownSites as unknown[]
  if (ownSites.some((site) => !storedMutedSite(site)) || duplicateIds(ownSites)) {
    return 'Config contains an invalid or duplicate muted site.'
  }
  const categories = validateCategories(raw.categories)
  if (categories) return categories
  for (const [field, min, max] of OPTIONS) {
    if (!inRange(raw[field], min, max)) return `${field} must be an integer from ${min} to ${max}.`
  }
  if (typeof raw.ownLine !== 'string') return 'Own line must be text.'
  if (typeof raw.stillness !== 'boolean' || typeof raw.firstRunDone !== 'boolean') {
    return 'Stillness and First run completion must be booleans.'
  }
  return null
}

const OPTIONS = [
  ['maxBypasses', 1, 10],
  ['bypassDurationMinutes', 1, 30],
  ['bypassWaitSeconds', 0, 15],
] as const

function inRange(raw: unknown, min: number, max: number): boolean {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max
}

function validateLegacy(raw: unknown): string | null {
  if (
    !isRecord(raw) ||
    !['schedules', 'categories', 'customSites', 'maxBypasses', 'bypassDurationMinutes'].some(
      (key) => key in raw
    )
  ) {
    return 'The file does not contain Sordino settings.'
  }
  if ('schedules' in raw) {
    const reason = validateSchedules(raw.schedules, true)
    if (reason) return reason
  }
  if ('categories' in raw) {
    const reason = validateCategories(raw.categories)
    if (reason) return reason
  }
  if (
    'customSites' in raw &&
    (!Array.isArray(raw.customSites) ||
      raw.customSites.some((site) => typeof site !== 'string' || !parseMutedSite(site).ok))
  ) {
    return 'Custom sites must be a list of valid sites.'
  }
  for (const [field, min, max] of OPTIONS.slice(0, 2)) {
    if (field in raw && !inRange(raw[field], min, max))
      return `${field} must be an integer from ${min} to ${max}.`
  }
  return null
}

function validateCategories(raw: unknown): string | null {
  if (
    !Array.isArray(raw) ||
    duplicateIds(raw) ||
    raw.some(
      (item) =>
        !isCategory(item) ||
        [...item.sites, ...(item.disabledSites ?? [])].some((site) => !parseMutedSite(site).ok)
    )
  )
    return 'Categories must have unique ids, names, enabled flags and valid site lists.'
  return null
}

function validateSchedules(raw: unknown, legacy: boolean): string | null {
  if (!Array.isArray(raw) || duplicateIds(raw)) return 'Schedules must be a list with unique ids.'
  for (const item of raw) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.name !== 'string' ||
      typeof item.enabled !== 'boolean' ||
      !Array.isArray(item.days) ||
      item.days.some((day) => !DAYS_OF_WEEK.includes(day)) ||
      typeof item.startTime !== 'string' ||
      typeof item.endTime !== 'string' ||
      (!legacy && (typeof item.allDay !== 'boolean' || item.appliesTo !== 'all')) ||
      (legacy && 'allDay' in item && typeof item.allDay !== 'boolean')
    ) {
      return 'A schedule is missing valid fields.'
    }
    const draft = coerceScheduleDraft(item)!
    // All day skips time validation in the editor; a file must still carry
    // valid saved times rather than silently repairing them during import.
    const times = validateSchedule({ ...draft, allDay: false })
    if (!times.ok && times.reasons.includes('missing-time')) {
      return `Schedule ${item.id}: missing-time.`
    }
    if (legacy && draft.startTime === '00:00' && draft.endTime === '23:59') draft.allDay = true
    const validated = validateSchedule(draft)
    if (!validated.ok) return `Schedule ${item.id}: ${validated.reasons.join(', ')}.`
  }
  return null
}

function duplicateIds(items: unknown[]): boolean {
  const ids = items.map((item) =>
    isRecord(item) && typeof item.id === 'string' ? item.id.trim() : null
  )
  return new Set(ids).size !== ids.length
}
