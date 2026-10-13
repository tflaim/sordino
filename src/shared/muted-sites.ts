// Muted sites: one parse and one match, so a site saved from the popup, settings
// or "Mute this site" is the same site a page is matched to. That site's id
// keys bypasses and Usage. The only rule kind today is "host" (decision 3
// leaves room for path rules). Pure.
export interface MutedSite {
  /** Stable identity. For a host rule this is the canonical host. */
  id: string
  rule: { kind: 'host'; host: string }
}

/** Parts of an address that are not part of a host rule, so the whole site is muted. */
export type DroppedPart = 'credentials' | 'wildcard' | 'www' | 'port' | 'path' | 'query' | 'hash'

export type RefusalReason = 'empty' | 'not-a-site'

export type ParseResult =
  { ok: true; site: MutedSite; dropped: DroppedPart[] } | { ok: false; reason: RefusalReason }

/** A category as match and "already muted" see it. Sites may be un-normalised. */
export interface CategorySites {
  id: string
  name: string
  enabled: boolean
  sites: readonly string[]
  disabledSites?: readonly string[]
}

export interface MutedList {
  categories: readonly CategorySites[]
  ownSites: readonly MutedSite[]
}

export type AlreadyVia = { kind: 'own' } | { kind: 'category'; id: string; name: string }

export type AddMutedSiteOutcome =
  | { kind: 'added'; site: MutedSite; dropped: DroppedPart[] }
  | { kind: 'already-muted'; site: MutedSite; via: AlreadyVia }
  | { kind: 'refused'; reason: RefusalReason }

const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i

/**
 * Turns typed or pasted text, or a page URL, into a canonical muted site.
 * Lowercase, punycode, no leading `*.` or www, no credentials, port, path, query,
 * hash or trailing dot. A host rule already covers subdomains, so `*.host` is `host`.
 */
export function parseMutedSite(input: string): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }

  const scheme = trimmed.match(SCHEME)
  if (scheme && scheme[1]!.toLowerCase() !== 'http' && scheme[1]!.toLowerCase() !== 'https') {
    return { ok: false, reason: 'not-a-site' }
  }

  let url: URL
  try {
    url = new URL(scheme ? trimmed : `https://${trimmed}`)
  } catch {
    return { ok: false, reason: 'not-a-site' }
  }

  const host = canonicalHost(url.hostname)
  if (!host) return { ok: false, reason: 'not-a-site' }

  const dropped: DroppedPart[] = []
  if (url.username || url.password) dropped.push('credentials')
  if (host.droppedWildcard) dropped.push('wildcard')
  if (host.droppedWww) dropped.push('www')
  // `URL` omits the default port (:443 on https), so the port is read from the text too.
  if (url.port || explicitPort(trimmed)) dropped.push('port')
  if (url.pathname !== '/' && url.pathname !== '') dropped.push('path')
  if (url.search) dropped.push('query')
  if (url.hash) dropped.push('hash')

  return { ok: true, site: hostSite(host.host), dropped }
}

/** The muted site a page falls under, or null. The most specific host wins. */
export function matchMutedSite(url: string, list: MutedList): MutedSite | null {
  const parsed = parseMutedSite(url)
  if (!parsed.ok) return null
  return bestCover(parsed.site.id, list)?.site ?? null
}

/**
 * When `site` is already covered by an own site or an enabled category, the
 * covering site. A switched-off category, or a site switched off inside one,
 * does not cover.
 */
export function alreadyMuted(
  site: MutedSite,
  list: MutedList
): { site: MutedSite; via: AlreadyVia } | null {
  return bestCover(site.id, list)
}

/** Own sites, plus category sites that are on and not switched off. One entry per host. */
export function mutedSitesOnList(list: MutedList): MutedSite[] {
  const byId = new Map<string, MutedSite>()
  for (const site of list.ownSites) byId.set(site.id, site)
  for (const site of categorySites(list.categories)) {
    if (!byId.has(site.id)) byId.set(site.id, site)
  }
  return [...byId.values()]
}

/** The sentence the popup shows when a command does not run. */
export const COMMAND_FAILED = 'Sordino is restarting. Try again in a moment.'

/**
 * What "Mute this site" tells the user. Adding is quiet. Already muted, refused,
 * or a command that did not run uses the popup's sentence.
 */
export function muteThisSiteNotice(
  result: { ok: true; outcome: AddMutedSiteOutcome } | { ok: false }
): string | null {
  if (!result.ok) return COMMAND_FAILED
  if (result.outcome.kind === 'added') return null
  return addMutedSiteMessage(result.outcome)
}

/** What the popup and settings say about an add. */
export function addMutedSiteMessage(outcome: AddMutedSiteOutcome): string {
  switch (outcome.kind) {
    case 'added': {
      const host = outcome.site.rule.host
      if (outcome.dropped.includes('path')) {
        return `Added ${host}. The path was ignored, so the whole site is muted.`
      }
      if (outcome.dropped.includes('query') || outcome.dropped.includes('hash')) {
        return `Added ${host}. The rest of the address was ignored, so the whole site is muted.`
      }
      return `Added ${host}.`
    }
    case 'already-muted':
      return outcome.via.kind === 'category'
        ? `already muted via ${outcome.via.name}`
        : 'already muted'
    case 'refused':
      return outcome.reason === 'empty' ? 'Enter a site.' : "That doesn't look like a site."
  }
}

/**
 * A muted site read back from storage. Anything that is not a canonical host
 * rule is dropped, so a bad write can never become a site that fails to match.
 */
export function storedMutedSite(raw: unknown): MutedSite | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const item = raw as Record<string, unknown>
  const rule = item.rule
  if (
    typeof item.id !== 'string' ||
    typeof rule !== 'object' ||
    rule === null ||
    Array.isArray(rule)
  ) {
    return null
  }
  const hostRule = rule as Record<string, unknown>
  if (hostRule.kind !== 'host' || hostRule.host !== item.id) return null
  const parsed = parseMutedSite(item.id)
  if (!parsed.ok || parsed.site.id !== item.id || parsed.dropped.length > 0) return null
  return parsed.site
}

/** 1.x custom-site strings, kept only when they are not already covered. */
export function adoptInputs(inputs: readonly string[], list: MutedList): MutedSite[] {
  const own = [...list.ownSites]
  for (const input of inputs) {
    const parsed = parseMutedSite(input)
    if (!parsed.ok) continue
    if (alreadyMuted(parsed.site, { ...list, ownSites: own })) continue
    own.push(parsed.site)
  }
  return own
}

function bestCover(host: string, list: MutedList): { site: MutedSite; via: AlreadyVia } | null {
  let own: MutedSite | null = null
  for (const site of list.ownSites) {
    if (site.rule.kind !== 'host' || !covers(host, site.rule.host)) continue
    if (!own || site.rule.host.length > own.rule.host.length) own = site
  }
  let category: { site: MutedSite; id: string; name: string } | null = null
  for (const entry of categoryEntries(list.categories)) {
    if (!covers(host, entry.site.id)) continue
    if (!category || entry.site.id.length > category.site.id.length) category = entry
  }
  if (own && (!category || own.rule.host.length >= category.site.id.length)) {
    return { site: own, via: { kind: 'own' } }
  }
  if (category) {
    return {
      site: category.site,
      via: { kind: 'category', id: category.id, name: category.name },
    }
  }
  return null
}

function categorySites(categories: readonly CategorySites[]): MutedSite[] {
  return categoryEntries(categories).map((entry) => entry.site)
}

function categoryEntries(
  categories: readonly CategorySites[]
): { site: MutedSite; id: string; name: string }[] {
  const entries: { site: MutedSite; id: string; name: string }[] = []
  for (const category of categories) {
    if (!category.enabled) continue
    const off = new Set<string>()
    for (const raw of category.disabledSites ?? []) {
      const host = bareHost(raw)
      if (host) off.add(host)
    }
    for (const raw of category.sites) {
      const host = bareHost(raw)
      if (!host || off.has(host)) continue
      entries.push({ site: hostSite(host), id: category.id, name: category.name })
    }
  }
  return entries
}

/** Suffix match on a label boundary: reddit.com covers old.reddit.com, not notreddit.com. */
function covers(host: string, ruleHost: string): boolean {
  return host === ruleHost || host.endsWith(`.${ruleHost}`)
}

function bareHost(input: string): string | null {
  const parsed = parseMutedSite(input)
  return parsed.ok ? parsed.site.id : null
}

function hostSite(host: string): MutedSite {
  return { id: host, rule: { kind: 'host', host } }
}

function canonicalHost(
  hostname: string
): { host: string; droppedWww: boolean; droppedWildcard: boolean } | null {
  let host = hostname.toLowerCase()
  while (host.endsWith('.')) host = host.slice(0, -1)
  // A leading `*.` is the same host: a host rule already covers every subdomain.
  let droppedWildcard = false
  while (host.startsWith('*.')) {
    host = host.slice(2)
    droppedWildcard = true
  }
  let droppedWww = false
  // Only a real "www" label, and only when a site remains (www.com stays www.com).
  if (host.startsWith('www.') && host.slice(4).includes('.')) {
    host = host.slice(4)
    droppedWww = true
    while (host.startsWith('*.')) {
      host = host.slice(2)
      droppedWildcard = true
    }
  }
  if (!isHost(host)) return null
  return { host, droppedWww, droppedWildcard }
}

function isHost(host: string): boolean {
  if (host === 'localhost') return true
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    host
  )
}

function explicitPort(input: string): boolean {
  const rest = input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const afterUser = rest.includes('@') ? rest.slice(rest.lastIndexOf('@') + 1) : rest
  const authority = afterUser.split(/[/?#]/)[0] ?? ''
  if (authority.startsWith('[')) return /\]:\d+$/.test(authority)
  return /:\d+$/.test(authority)
}
