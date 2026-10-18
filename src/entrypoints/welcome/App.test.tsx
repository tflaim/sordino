// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { memoryStorage } from '@/store/adapters/memory'
import { directCommandPort } from '@/store/adapters/direct'
import { openReader } from '@/store/reader'
import { openStore } from '@/store/store'
import { Welcome } from './App'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

async function mount(checkPrivate: () => Promise<boolean> = async () => false) {
  const storage = memoryStorage()
  const store = await openStore({ storage, clock: () => new Date('2026-10-05T10:00').getTime() })
  const commands = directCommandPort(store, { kind: 'page' })
  const reader = openReader(storage)
  storage.writes.length = 0
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <Welcome
        commands={commands}
        loadConfig={async () => (await reader.read('config')).config}
        checkPrivate={checkPrivate}
        openSettings={async () => undefined}
      />
    )
  })
  return { storage, reader }
}

function control(name: string) {
  const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[aria-label="${name}"]`
  )
  if (!element) throw new Error(`Missing labelled control: ${name}`)
  return element
}

function change(name: string, value: string) {
  const element = control(name)
  element.value = value
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

async function submit() {
  await act(async () => {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

describe('First run user path', () => {
  it('edits labelled sentence controls and commits only when Start is submitted', async () => {
    const { storage, reader } = await mount()
    expect(control('First category').value).toBe('social')
    expect(control('Second category').value).toBe('video')
    expect(control('Schedule days').value).toBe('weekdays')
    expect(control('Schedule start time').value).toBe('09:00')
    expect(control('Schedule end time').value).toBe('17:00')
    expect(control('Daily bypass budget').value).toBe('3')
    expect(control('Bypass wait in seconds').value).toBe('5')
    expect(container.textContent).toContain('Nothing is muted until you press Start.')
    await act(async () => {
      change('First category', 'news')
      change('Second category', 'none')
      change('Schedule days', 'weekends')
      change('Daily bypass budget', '7')
      change('Bypass wait in seconds', '0')
    })
    expect(container.textContent).toContain('7 bypasses a day. After that, the wait is 30 seconds.')
    expect(container.textContent).toContain('Bypass for 5 min')
    expect(storage.writes).toEqual([])
    await submit()
    const { config } = await reader.read('config')
    expect(config).toMatchObject({ firstRunDone: true, maxBypasses: 7, bypassWaitSeconds: 0 })
    expect(config.categories?.filter((c) => c.enabled).map((c) => c.id)).toEqual(['news'])
    expect(config.schedules[0]?.days).toEqual(['sat', 'sun'])
    expect(storage.writes).toHaveLength(1)
    expect(container.textContent).toContain('Sordino follows your schedules.')
  })

  it('keeps choices after storage failure and retries without partial activation', async () => {
    const { storage, reader } = await mount()
    await act(async () => change('Daily bypass budget', '8'))
    storage.failNextWrite()
    await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not save')
    expect(control('Daily bypass budget').value).toBe('8')
    expect((await reader.read('config')).config.firstRunDone).toBe(false)
    await submit()
    expect((await reader.read('config')).config).toMatchObject({
      firstRunDone: true,
      maxBypasses: 8,
    })
  })

  it('reports real private coverage and rechecks when returning to the page', async () => {
    let allowed = false
    await mount(async () => allowed)
    expect(container.textContent).toContain('Sordino is not allowed in private windows.')
    expect(container.textContent).toContain('Allow in Incognito')
    allowed = true
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(container.textContent).toContain('Sordino is allowed in private windows.')
  })

  it('reports failed private detection as unknown', async () => {
    await mount(async () => {
      throw new Error('API unavailable')
    })
    expect(container.textContent).toContain('Could not check private-window coverage.')
    expect(container.textContent).not.toContain('Sites there will not be muted.')
  })
})
