import { describe, expect, it } from 'vitest'
import { memoryStorage } from '@/store/adapters/memory'
import { openReader } from '@/store/reader'
import { openStore } from '@/store/store'
import { handleMuteThisSite } from '@/store/mute-this-site'

describe('Mute this site handler', () => {
  it('writes the page host onto config.ownSites, which is what readers read', async () => {
    const storage = memoryStorage()
    const clock = () => new Date('2026-10-05T10:00').getTime()

    const { notice } = await handleMuteThisSite('https://www.example.org/news', () =>
      openStore({ storage, clock })
    )

    expect(notice).toBeNull()
    const { config } = await openReader(storage).read('config')
    expect(config.ownSites).toEqual([
      { id: 'example.org', rule: { kind: 'host', host: 'example.org' } },
    ])
    expect(
      storage.writes.some((write) =>
        write.config?.ownSites?.some((site) => site.id === 'example.org')
      )
    ).toBe(true)
  })
})
