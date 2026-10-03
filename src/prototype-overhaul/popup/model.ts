// PROTOTYPE — in-memory popup state. Mirrors decisions 13–15: Mute now and Pause
// take a duration, most recent action wins, Back to schedule is one tap.
import { useState } from 'react'

export type PopupMode = 'schedule' | 'mutenow' | 'paused' | 'off'
export const popupStates = [
  { key: 'schedule', label: 'muting by schedule' },
  { key: 'mutenow', label: 'Mute now (until 14:30)' },
  { key: 'paused', label: 'Paused until 23:59' },
  { key: 'off', label: 'not muting' },
]
export const DURATIONS = [
  { key: '15', label: '15 min' },
  { key: '60', label: '1 hour' },
  { key: 'today', label: 'Rest of today' },
] as const
export type DurationKey = (typeof DURATIONS)[number]['key']

export function usePopupModel(initial: string) {
  const start = (popupStates.some((s) => s.key === initial) ? initial : 'schedule') as PopupMode
  // The fake clock: inside Work hours unless the prototype starts "not muting".
  const scheduleActive = start !== 'off'
  const now = start === 'off' ? '18:40' : start === 'mutenow' ? '13:30' : '11:12'
  const [mode, setMode] = useState<PopupMode>(start)
  const [until, setUntil] = useState<string | null>(
    start === 'mutenow' ? '14:30' : start === 'paused' ? '23:59' : null,
  )
  const [pausesToday, setPausesToday] = useState(start === 'paused' ? 1 : 0)

  const addMins = (m: number) => {
    const [h, mm] = now.split(':').map(Number)
    const t = h * 60 + mm + m
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }
  const untilFor = (d: DurationKey) => (d === '15' ? addMins(15) : d === '60' ? addMins(60) : '23:59')

  const muting = mode === 'schedule' || mode === 'mutenow'
  const status =
    mode === 'schedule'
      ? { head: 'Muting until 17:00', sub: 'Work hours · 14 sites in Social and Video', dot: 'on' }
      : mode === 'mutenow'
        ? { head: `Muting until ${until}`, sub: 'Mute now · then back to your schedules', dot: 'on' }
        : mode === 'paused'
          ? { head: `Paused until ${until}`, sub: 'Nothing is muted until then.', dot: 'paused' }
          : { head: 'Not muting', sub: 'Next: Work hours, Friday at 09:00', dot: 'off' }

  return {
    mode,
    until,
    now,
    muting,
    status,
    overridden: mode === 'mutenow' || mode === 'paused',
    pausesToday,
    today: { muted: 7, turnedBack: 4, bypassed: 1, left: 2, budget: 3 },
    untilFor,
    pause(d: DurationKey) {
      setMode('paused')
      setUntil(untilFor(d))
      setPausesToday((n) => n + 1)
    },
    muteNow(d: DurationKey) {
      setMode('mutenow')
      setUntil(untilFor(d))
    },
    backToSchedule() {
      setMode(scheduleActive ? 'schedule' : 'off')
      setUntil(null)
    },
  }
}
export type PopupModel = ReturnType<typeof usePopupModel>
