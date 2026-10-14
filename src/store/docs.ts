// The three stored documents and how raw storage values become them.
// Unversioned data is v1 (the 1.x `sordino_settings` key); these are v2.
import type { Mode } from '@/shared/muting'
import { adoptInputs, storedMutedSite, type MutedSite } from '@/shared/muted-sites'
import { schedulesFromConfig, schedulesFromLegacy, type Schedule } from '@/shared/schedule'
import { legacyCategories, legacyCustomSites } from './legacy-sites'

export const VERSION = 2

/** Schedules and sites added by hand. Bypass options, own line and Stillness come later. */
export interface ConfigDoc {
  version: typeof VERSION
  schedules: Schedule[]
  ownSites: MutedSite[]
}

/** What is happening now: the latest Mute now or Pause (null = on schedule). */
export interface StateDoc {
  version: typeof VERSION
  mode: Mode | null
  /** Latest visit per tab; offer time is the store's clock, never the page's. */
  muteOffers?: Record<string, MuteOffer>
}

export interface MuteOffer {
  siteId: string
  navigationId: string
  offeredAt: number
  turnedBack: boolean
}

/** Daily counts: filled in by the Usage ticket (#9). */
export interface UsageDoc {
  version: typeof VERSION
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
            categories: legacyCategories(legacySettings),
            ownSites: [],
          }),
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

export const parseUsage = (): UsageDoc => ({ version: VERSION })

/** Repairs field by field: a malformed field falls back to its default, the rest is kept. */
export function parseState(raw: unknown): StateDoc {
  const doc = isRecord(raw) ? raw : {}
  const muteOffers: Record<string, MuteOffer> = {}
  if (isRecord(doc.muteOffers)) {
    for (const [key, value] of Object.entries(doc.muteOffers).slice(-128)) {
      if (!isRecord(value)) continue
      if (
        typeof value.siteId !== 'string' ||
        typeof value.navigationId !== 'string' ||
        !isTime(value.offeredAt) ||
        typeof value.turnedBack !== 'boolean'
      )
        continue
      muteOffers[key] = {
        siteId: value.siteId,
        navigationId: value.navigationId,
        offeredAt: value.offeredAt,
        turnedBack: value.turnedBack,
      }
    }
  }
  return {
    version: VERSION,
    mode: parseMode(doc.mode),
    ...(Object.keys(muteOffers).length ? { muteOffers } : {}),
  }
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
