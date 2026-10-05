import { describe, expect, it } from 'vitest'
import { clockTime, statusLine } from './status'

const at = (local: string) => new Date(local).getTime()

describe('statusLine', () => {
  it.each([
    {
      muting: {
        muted: true,
        source: { kind: 'schedule', id: 'work-hours', name: 'Work hours' },
        until: at('2026-10-05T17:00'),
        nextChange: at('2026-10-05T17:00'),
      },
      expected: 'Muting until 17:00 · Work hours',
    },
    {
      muting: {
        muted: true,
        source: { kind: 'mute-now' },
        until: at('2026-10-05T09:30'),
        nextChange: at('2026-10-05T09:30'),
      },
      expected: 'Muting until 09:30 · Mute now',
    },
    {
      muting: {
        muted: false,
        source: { kind: 'pause' },
        until: at('2026-10-06T00:00'),
        nextChange: at('2026-10-06T00:00'),
      },
      expected: 'Paused until midnight',
    },
    {
      muting: {
        muted: true,
        source: { kind: 'schedule', id: 'all', name: 'Always' },
        until: null,
        nextChange: null,
      },
      expected: 'Muting · Always',
    },
    {
      muting: { muted: false, source: { kind: 'none' }, until: null, nextChange: null },
      expected: 'Not muting',
    },
  ] as const)('$expected', ({ muting, expected }) => {
    expect(statusLine(muting)).toBe(expected)
  })

  it('writes local times as 24-hour HH:MM, and local midnight as midnight', () => {
    expect(clockTime(at('2026-10-05T07:05'))).toBe('07:05')
    expect(clockTime(at('2026-10-05T23:59'))).toBe('23:59')
    expect(clockTime(at('2026-10-06T00:00'))).toBe('midnight')
  })
})
