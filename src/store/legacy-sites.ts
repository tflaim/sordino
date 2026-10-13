// v1 categories are merged by id once; current config lists are authoritative.
import { DEFAULT_CATEGORIES, type Category } from '@/shared/types'
import { parseMutedSite } from '@/shared/muted-sites'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function legacyCustomSites(raw: unknown): string[] {
  if (!isRecord(raw) || !Array.isArray(raw.customSites)) return []
  return raw.customSites.filter((site): site is string => typeof site === 'string')
}

/** Saved category ids override defaults; new default ids are added on v1 migration. */
export function legacyCategories(raw: unknown): Category[] {
  const saved = isRecord(raw) ? parseCategories(raw.categories) : []
  return [
    ...DEFAULT_CATEGORIES.map(
      (category) => saved.find((item) => item.id === category.id) ?? structuredClone(category)
    ),
    ...saved.filter((category) => !DEFAULT_CATEGORIES.some((item) => item.id === category.id)),
  ]
}

/** Repairs storage only. File imports validate before reaching this parser. */
export function parseCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return []
  const kept: Category[] = []
  for (const item of raw) {
    if (!isCategory(item) || kept.some((category) => category.id === item.id)) continue
    const hosts = (sites: readonly string[]) => [
      ...new Set(
        sites.flatMap((input) => {
          const parsed = parseMutedSite(input)
          return parsed.ok ? [parsed.site.id] : []
        })
      ),
    ]
    kept.push({
      id: item.id,
      name: item.name,
      enabled: item.enabled,
      sites: hosts(item.sites),
      ...(item.disabledSites === undefined ? {} : { disabledSites: hosts(item.disabledSites) }),
    })
  }
  return kept
}

export function isCategory(raw: unknown): raw is Category {
  if (!isRecord(raw)) return false
  const { id, name, enabled, sites, disabledSites } = raw
  return (
    typeof id === 'string' &&
    id.trim().length > 0 &&
    typeof name === 'string' &&
    name.trim().length > 0 &&
    typeof enabled === 'boolean' &&
    Array.isArray(sites) &&
    sites.every((site) => typeof site === 'string') &&
    (disabledSites === undefined ||
      (Array.isArray(disabledSites) && disabledSites.every((site) => typeof site === 'string')))
  )
}
