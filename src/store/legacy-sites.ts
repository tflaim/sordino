// Categories still live in the 1.x settings object. Custom sites are adopted
// into `config.ownSites` when that array is absent, the same way a missing
// schedule list falls back to 1.x. Once the array exists, even empty, it is
// the list (#4). v1 migration (#8) should not append them again.
import { DEFAULT_CATEGORIES } from '@/shared/types'
import type { CategorySites } from '@/shared/muted-sites'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function legacyCustomSites(raw: unknown): string[] {
  if (!isRecord(raw) || !Array.isArray(raw.customSites)) return []
  return raw.customSites.filter((site): site is string => typeof site === 'string')
}

/** Missing categories mean the 1.x defaults, as `getSettings` does. An empty array is empty. */
export function legacyCategories(raw: unknown): CategorySites[] {
  if (!isRecord(raw) || !Array.isArray(raw.categories)) return DEFAULT_CATEGORIES
  return raw.categories.filter(isCategory)
}

function isCategory(raw: unknown): raw is CategorySites {
  if (!isRecord(raw)) return false
  const { id, name, enabled, sites, disabledSites } = raw
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    typeof enabled === 'boolean' &&
    Array.isArray(sites) &&
    sites.every((site) => typeof site === 'string') &&
    (disabledSites === undefined ||
      (Array.isArray(disabledSites) && disabledSites.every((site) => typeof site === 'string')))
  )
}
