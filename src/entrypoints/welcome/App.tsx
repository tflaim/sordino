/* First run is an Operate surface in Sordino's existing visual system.
   One editable sentence owns the setup; a small dark overlay demonstrates it.
   Warm paper follows the system theme, native underlined controls wrap on a
   phone, and Start sits beside the explicit pre-consent state. Draft edits
   stay here until one store command commits them. The preview stays still. */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DEFAULT_CATEGORIES, type DayOfWeek } from '@/shared/types'
import { SCHEDULE_REASON } from '@/shared/schedule'
import type { ConfigDoc } from '@/store/docs'
import type { CommandPort } from '@/store/ports'

interface Props {
  commands: CommandPort
  loadConfig: () => Promise<ConfigDoc>
  checkPrivate: () => Promise<boolean>
  openSettings: () => Promise<unknown>
}

const DAY_CHOICES: Record<string, DayOfWeek[]> = {
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  weekends: ['sat', 'sun'],
  'every day': ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
}

type Coverage = 'checking' | 'allowed' | 'not-allowed' | 'unknown'

export function Welcome({ commands, loadConfig, checkPrivate, openSettings }: Props) {
  const [first, setFirst] = useState('social')
  const [second, setSecond] = useState('video')
  const [days, setDays] = useState('weekdays')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [budget, setBudget] = useState(3)
  const [wait, setWait] = useState(5)
  const [coverage, setCoverage] = useState<Coverage>('checking')
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const submitting = useRef(false)
  const status = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    loadConfig().then(
      (config) => {
        if (!cancelled) {
          setDone(config.firstRunDone)
          setReady(true)
          setError('')
        }
      },
      () => {
        if (!cancelled) setError('Could not read your setup. Try again before starting.')
      }
    )
    return () => {
      cancelled = true
    }
  }, [loadConfig, attempt])

  useEffect(() => {
    let cancelled = false
    let request = 0
    const refresh = () => {
      const current = ++request
      checkPrivate().then(
        (allowed) => {
          if (!cancelled && current === request) setCoverage(allowed ? 'allowed' : 'not-allowed')
        },
        () => {
          if (!cancelled && current === request) setCoverage('unknown')
        }
      )
    }
    const visible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [checkPrivate])

  async function start(event: FormEvent) {
    event.preventDefault()
    if (!ready || done || submitting.current) return
    submitting.current = true
    setPending(true)
    setError('')
    try {
      const result = await commands.send({
        type: 'start',
        categoryIds: second === 'none' ? [first] : [first, second],
        schedule: {
          name: 'Work hours',
          enabled: true,
          days: DAY_CHOICES[days]!,
          allDay: false,
          startTime,
          endTime,
        },
        maxBypasses: budget,
        bypassWaitSeconds: wait,
      })
      if (!result.ok)
        setError('Could not save your setup. Your choices are still here; try Start again.')
      else if (result.outcome.kind === 'refused')
        setError(result.outcome.reasons.map((reason) => SCHEDULE_REASON[reason]).join(' '))
      else {
        setDone(true)
        // Move keyboard focus to the result after the form leaves the page.
        requestAnimationFrame(() => status.current?.focus())
      }
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <main className="welcome-page">
      <header>
        <p className="wordmark">Sordino</p>
        <h1>Choose when to mute.</h1>
      </header>
      {done ? (
        <section aria-live="polite">
          <h2 ref={status} tabIndex={-1}>
            Sordino follows your schedules.
          </h2>
          <p>You can change your categories, schedules and bypass options in Settings.</p>
          <button
            className="start-button"
            onClick={() =>
              void openSettings().catch(() =>
                setError('Could not open Settings. Use the extension’s Options entry.')
              )
            }
          >
            Open Settings
          </button>
        </section>
      ) : (
        <form onSubmit={(event) => void start(event)} aria-describedby="before-start">
          <fieldset disabled={!ready || pending} className="sentence">
            <legend className="sr-only">Your muting defaults</legend>
            Mute{' '}
            <select
              aria-label="First category"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            >
              {DEFAULT_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>{' '}
            and{' '}
            <select
              aria-label="Second category"
              value={second}
              onChange={(e) => setSecond(e.target.value)}
            >
              {DEFAULT_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value="none">no other category</option>
            </select>{' '}
            on{' '}
            <select
              aria-label="Schedule days"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              {Object.keys(DAY_CHOICES).map((choice) => (
                <option key={choice}>{choice}</option>
              ))}
            </select>
            ,{' '}
            <span className="time-window">
              <input
                aria-label="Schedule start time"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <span aria-hidden="true">–</span>
              <input
                aria-label="Schedule end time"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </span>
            . Allow{' '}
            <select
              aria-label="Daily bypass budget"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1}>{i + 1}</option>
              ))}
            </select>{' '}
            bypasses a day, each after a{' '}
            <select
              aria-label="Bypass wait in seconds"
              value={wait}
              onChange={(e) => setWait(Number(e.target.value))}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>
                  {i}-second
                </option>
              ))}
            </select>{' '}
            wait.
          </fieldset>
          <div className="start-row">
            <button type="submit" className="start-button" disabled={!ready || pending}>
              {pending ? 'Starting…' : 'Start'}
            </button>
            <p id="before-start">Nothing is muted until you press Start.</p>
          </div>
          {!ready && error && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
        </form>
      )}
      <p role="alert" className="error">
        {error}
      </p>
      <figure className="overlay-example" aria-label="Overlay preview, example only">
        <figcaption>On a muted site</figcaption>
        <div className="preview">
          <p className="preview-brand">Sordino</p>
          <h2>
            {first === 'social'
              ? 'reddit.com'
              : DEFAULT_CATEGORIES.find((category) => category.id === first)?.sites[0]}{' '}
            is muted until {endTime || '17:00'}.
          </h2>
          <p>Work hours · Example preview</p>
          <div className="preview-actions" aria-label="Example overlay actions">
            <span className="preview-turn-back">Turn back</span>
            <span className="preview-bypass">
              {wait === 0 ? 'Bypass for 5 min' : `Bypass in ${wait}`}
            </span>
          </div>
          <p>{budget} bypasses a day. After that, the wait is 30 seconds.</p>
        </div>
      </figure>
      <div className="welcome-notes">
        <section aria-labelledby="private-heading">
          <h2 id="private-heading">Private windows</h2>
          <p aria-live="polite">
            {coverage === 'checking' && 'Checking whether Sordino is allowed in private windows…'}
            {coverage === 'allowed' &&
              'Sordino is allowed in private windows. The same muting schedules apply there once you start.'}
            {coverage === 'not-allowed' &&
              'Sordino is not allowed in private windows. Sites there will not be muted.'}
            {coverage === 'unknown' &&
              'Could not check private-window coverage. Check the extension’s permissions in your browser.'}
          </p>
          <p>
            In Chrome, open Extensions → Manage extensions → Sordino → Details → Allow in Incognito.
            In Firefox, open Add-ons and themes → Extensions → Sordino → Run in Private Windows →
            Allow. Return here to check coverage again.
          </p>
        </section>
        <section aria-labelledby="repertoire-heading">
          <h2 id="repertoire-heading">A rotating repertoire</h2>
          <p>
            The bypass wait uses a small rotating repertoire of musical styles. The countdown stays
            visible. Stillness in Settings, or your system’s reduced-motion setting, keeps it to
            plain text and numbers.
          </p>
        </section>
      </div>
      <footer>Your settings stay in this browser.</footer>
    </main>
  )
}
