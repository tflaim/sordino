import { describe, expect, it, vi } from 'vitest'
import {
  addMutedSiteMessage,
  alreadyMuted,
  matchMutedSite,
  muteThisSiteNotice,
  mutedSitesOnList,
  parseMutedSite,
  type CategorySites,
  type MutedSite,
} from './muted-sites'

const reddit: MutedSite = { id: 'reddit.com', rule: { kind: 'host', host: 'reddit.com' } }
const munich: MutedSite = {
  id: 'xn--mnchen-3ya.de',
  rule: { kind: 'host', host: 'xn--mnchen-3ya.de' },
}

const social: CategorySites = {
  id: 'social',
  name: 'Social',
  enabled: true,
  sites: ['reddit.com'],
}

describe('parse muted site', () => {
  it.each([
    ['Reddit.com', reddit, []],
    ['HTTPS://reddit.com/r/x?ref=1', reddit, ['path', 'query']],
    ['reddit.com:443', reddit, ['port']],
    ['www.reddit.com.', reddit, ['www']],
    ['  reddit.com  ', reddit, []],
    ['münchen.de', munich, []],
    ['https://münchen.de/path', munich, ['path']],
    ['XN--MNCHEN-3YA.DE', munich, []],
    ['WWW.Reddit.COM', reddit, ['www']],
    [
      'https://user:pw@reddit.com:443/r/x?ref=1#top',
      reddit,
      ['credentials', 'port', 'path', 'query', 'hash'],
    ],
    ['*.reddit.com', reddit, ['wildcard']],
    ['https://*.www.reddit.com/r/x', reddit, ['wildcard', 'www', 'path']],
    ['www.com', { id: 'www.com', rule: { kind: 'host', host: 'www.com' } }, []],
    ['localhost:3000', { id: 'localhost', rule: { kind: 'host', host: 'localhost' } }, ['port']],
  ] as const)('normalises %s', (input, site, dropped) => {
    expect(parseMutedSite(input)).toEqual({ ok: true, site, dropped: [...dropped] })
  })

  it.each([
    '',
    '   ',
    'not a site',
    'https://',
    '*reddit.com',
    'javascript:alert(1)',
    'chrome://extensions',
    'ftp://files.example.org',
    'com',
    'reddit',
    '.',
    'http:/reddit.com',
    'http://[::1]/',
  ])('refuses %s', (input) => {
    const result = parseMutedSite(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(['empty', 'not-a-site']).toContain(result.reason)
    expect(result.ok ? null : result.reason).toBe(input.trim() ? 'not-a-site' : 'empty')
  })

  it('strips a leading *. before URL parsing, including when URL encodes the star as Chromium does', () => {
    const RealURL = globalThis.URL
    const constructed: string[] = []
    class ChromiumURL extends RealURL {
      constructor(url: string | URL, base?: string | URL) {
        const text = typeof url === 'string' ? url : url.href
        constructed.push(text)
        if (base === undefined) super(text)
        else super(text, base)
      }
      override get hostname() {
        return super.hostname.replaceAll('*', '%2A')
      }
    }
    vi.stubGlobal('URL', ChromiumURL)
    try {
      const neverssl = { id: 'neverssl.com', rule: { kind: 'host', host: 'neverssl.com' } }
      const example = { id: 'example.org', rule: { kind: 'host', host: 'example.org' } }
      expect(parseMutedSite('*.neverssl.com')).toEqual({
        ok: true,
        site: neverssl,
        dropped: ['wildcard'],
      })
      expect(parseMutedSite('*.example.org')).toEqual({
        ok: true,
        site: example,
        dropped: ['wildcard'],
      })
      expect(parseMutedSite('https://user:pw@*.example.org:443/a?q=1#h')).toEqual({
        ok: true,
        site: example,
        dropped: ['credentials', 'wildcard', 'port', 'path', 'query', 'hash'],
      })
      expect(constructed.every((text) => !text.includes('*'))).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('Mute this site notice', () => {
  it('uses the popup sentence when the site is already muted or refused, and stays quiet when added', () => {
    const via = { kind: 'category' as const, id: 'social', name: 'Social' }
    const already = {
      ok: true as const,
      outcome: { kind: 'already-muted' as const, site: reddit, via },
    }
    expect(muteThisSiteNotice(already)).toBe(addMutedSiteMessage(already.outcome))
    expect(muteThisSiteNotice(already)).toBe('already muted via Social')
    expect(
      muteThisSiteNotice({ ok: true, outcome: { kind: 'refused', reason: 'not-a-site' } })
    ).toBe("That doesn't look like a site.")
    expect(
      muteThisSiteNotice({ ok: true, outcome: { kind: 'added', site: reddit, dropped: [] } })
    ).toBeNull()
    expect(muteThisSiteNotice({ ok: false })).toBe('Sordino is restarting. Try again in a moment.')
  })
})

describe('match muted site', () => {
  const list = { categories: [social], ownSites: [] }

  it('matches a subdomain and a www host to the muted site', () => {
    expect(matchMutedSite('https://old.reddit.com/r/x', list)).toEqual(reddit)
    expect(matchMutedSite('https://www.reddit.com/', list)).toEqual(reddit)
    expect(matchMutedSite('https://www.reddit.com./', list)).toEqual(reddit)
    expect(matchMutedSite('http://old.reddit.com:443/r/x?ref=1', list)).toEqual(reddit)
  })

  it('does not match look-alikes', () => {
    expect(matchMutedSite('https://notreddit.com/', list)).toBeNull()
    expect(matchMutedSite('https://reddit.com.example.org/', list)).toBeNull()
    expect(matchMutedSite('https://example.org/reddit.com', list)).toBeNull()
    expect(matchMutedSite('https://reddit.com.example.org/reddit.com', list)).toBeNull()
  })

  it('a site switched off inside a category does not match', () => {
    const switchedOff = {
      categories: [{ ...social, disabledSites: ['reddit.com'] }],
      ownSites: [],
    }
    expect(matchMutedSite('https://old.reddit.com/', switchedOff)).toBeNull()
    expect(matchMutedSite('https://www.reddit.com/', switchedOff)).toBeNull()
  })

  it('a category that is off does not match, and an own site still does', () => {
    const off = { categories: [{ ...social, enabled: false }], ownSites: [] }
    expect(matchMutedSite('https://reddit.com/', off)).toBeNull()
    expect(alreadyMuted(reddit, off)).toBeNull()
    expect(matchMutedSite('https://old.reddit.com/', { ...off, ownSites: [reddit] })).toEqual(
      reddit
    )
  })

  it('the most specific host is the matched site', () => {
    const old: MutedSite = { id: 'old.reddit.com', rule: { kind: 'host', host: 'old.reddit.com' } }
    const both = { categories: [social], ownSites: [old] }
    expect(matchMutedSite('https://old.reddit.com/r/x', both)?.id).toBe('old.reddit.com')
    expect(matchMutedSite('https://www.reddit.com/', both)?.id).toBe('reddit.com')
  })

  it('an IDN page matches the punycode host', () => {
    const list = {
      categories: [{ id: 'places', name: 'Places', enabled: true, sites: ['münchen.de'] }],
      ownSites: [],
    }
    expect(matchMutedSite('https://www.münchen.de/rathaus', list)).toEqual(munich)
  })
})

function mustParse(input: string): MutedSite {
  const result = parseMutedSite(input)
  if (!result.ok) throw new Error(`${input} refused: ${result.reason}`)
  return result.site
}

describe('already muted', () => {
  it('names the category that already covers the site, including a subdomain', () => {
    const via = alreadyMuted(mustParse('https://old.reddit.com/r/x'), {
      categories: [social],
      ownSites: [],
    })
    expect(via).toEqual({ site: reddit, via: { kind: 'category', id: 'social', name: 'Social' } })
    expect(addMutedSiteMessage({ kind: 'already-muted', site: reddit, via: via!.via })).toBe(
      'already muted via Social'
    )
  })

  it('a switched-off site is not already muted, so it can be added by hand', () => {
    expect(
      alreadyMuted(mustParse('reddit.com'), {
        categories: [{ ...social, disabledSites: ['WWW.Reddit.com'] }],
        ownSites: [],
      })
    ).toBeNull()
  })

  it('counts an own site once when a category lists the same host', () => {
    expect(
      mutedSitesOnList({
        categories: [
          social,
          { ...social, id: 'news', name: 'News', enabled: false, sites: ['bbc.com'] },
        ],
        ownSites: [reddit, { id: 'example.org', rule: { kind: 'host', host: 'example.org' } }],
      }).map((site) => site.id)
    ).toEqual(['reddit.com', 'example.org'])
  })
})
