// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { ScheduleDraft } from '@/shared/schedule'
import { ScheduleForm } from './Schedules'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const weekdays: ScheduleDraft = {
  name: 'Work hours',
  enabled: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  allDay: false,
  startTime: '09:00',
  endTime: '17:00',
}

/** The settings page owns the draft and passes its setState straight through. */
function Editor() {
  const [draft, setDraft] = useState(weekdays)
  return (
    <ScheduleForm
      draft={draft}
      onChange={setDraft}
      onCancel={() => {}}
      onSubmit={() => {}}
      submitLabel="Save"
      pending={false}
    />
  )
}

function pressed(container: ParentNode, day: string): string | null | undefined {
  return container.querySelector(`[aria-label="${day}"]`)?.getAttribute('aria-pressed')
}

describe('schedule editor', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    container?.remove()
  })

  it('keeps every day toggled in one tick', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(<Editor />)
    })

    const monday = container.querySelector<HTMLButtonElement>('[aria-label="Monday"]')
    const saturday = container.querySelector<HTMLButtonElement>('[aria-label="Saturday"]')
    const sunday = container.querySelector<HTMLButtonElement>('[aria-label="Sunday"]')
    if (!monday || !saturday || !sunday) throw new Error('day buttons missing')

    await act(async () => {
      monday.click()
      saturday.click()
      sunday.click()
    })

    expect({
      Monday: pressed(container, 'Monday'),
      Tuesday: pressed(container, 'Tuesday'),
      Saturday: pressed(container, 'Saturday'),
      Sunday: pressed(container, 'Sunday'),
    }).toEqual({
      Monday: 'false',
      Tuesday: 'true',
      Saturday: 'true',
      Sunday: 'true',
    })
  })
})
