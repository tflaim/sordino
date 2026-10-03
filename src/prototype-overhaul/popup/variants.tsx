// PROTOTYPE — three structurally different popups in a 360px frame.
import { useId, useState, type ReactNode } from 'react'
import { Logo, cls } from '../ui'
import { DURATIONS, usePopupModel, type DurationKey, type PopupModel } from './model'

/** Fake browser toolbar + page, popup anchored under the extension icon. */
function PopupHost({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#d9d4cc]">
      <div className="flex items-center gap-3 border-b border-black/10 bg-[#ece8e1] px-4 py-2 text-[13px] text-[#555]" aria-hidden="true">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 flex-1 rounded-md bg-white px-3 py-1">github.com/tflaim/sordino/pulls</span>
        <span className="grid h-7 w-7 place-items-center rounded bg-black/10">
          <Logo size={16} />
        </span>
      </div>
      <div className="flex justify-end px-4 pt-1.5">
        <div
          data-popup-frame
          className="w-[360px] overflow-hidden rounded-xl border border-black/15 bg-bg text-fg shadow-[0_12px_40px_rgba(30,20,10,0.28)]"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function Dot({ kind }: { kind: string }) {
  const c = kind === 'on' ? 'bg-[#6e9a58]' : kind === 'paused' ? 'bg-[#c9a227]' : 'border border-control bg-transparent'
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />
}

function SettingsButton() {
  return (
    <button type="button" className="ease-colors rounded-lg px-2 py-1 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">
      Settings
    </button>
  )
}

// ---------------------------------------------------------------- A
function StatusSentence({ m }: { m: PopupModel }) {
  const durationRow = (label: string, on: (d: DurationKey) => void) => (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-[13px] text-muted">{label}</p>
      <div className="grid grid-cols-[1fr_1fr_1.45fr] gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => on(d.key)}
            className="ease-colors whitespace-nowrap rounded-lg border border-control px-2 py-2 text-[14px] hover:bg-surface-2"
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <div className="p-5">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          <Logo size={18} /> Sordino
        </span>
        <SettingsButton />
      </header>
      <div aria-live="polite" className="mt-6">
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <Dot kind={m.status.dot} />
          {m.mode === 'schedule' ? 'By schedule' : m.mode === 'mutenow' ? 'Mute now' : m.mode === 'paused' ? 'Pause' : 'No schedule right now'}
        </p>
        <h1 className="mt-1 font-display text-[30px] font-medium leading-tight">{m.status.head}</h1>
        <p className="mt-1 text-[14px] text-muted">{m.status.sub}</p>
      </div>
      <div className="mt-5 space-y-4">
        {m.overridden && (
          <button type="button" onClick={m.backToSchedule} className={`${cls.primary} w-full`}>
            Back to schedule
          </button>
        )}
        {m.muting && durationRow('Pause for', m.pause)}
        {m.mode === 'off' && durationRow('Mute now for', m.muteNow)}
      </div>
      <section aria-labelledby="pa-today" className="mt-6 border-t border-line pt-4">
        <h2 id="pa-today" className={cls.label}>
          Today
        </h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1.5 text-[14px]">
          <dt className="text-muted">Mute count</dt>
          <dd className="tnum text-right">{m.today.muted}</dd>
          <dt className="text-muted">Turned back</dt>
          <dd className="tnum text-right">{m.today.turnedBack}</dd>
          <dt className="text-muted">Bypasses</dt>
          <dd className="tnum text-right">{m.today.bypassed}</dd>
          <dt className="text-muted">Bypass budget</dt>
          <dd className="tnum text-right">
            {m.today.left} of {m.today.budget} left
          </dd>
        </dl>
      </section>
      <footer className="mt-4 flex justify-between">
        <a href="#usage" className={cls.quiet + ' -ml-3'}>
          Usage
        </a>
        <span className="py-2 text-[12px] text-muted">Stays on this device</span>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------- B
function ModeFirst({ m }: { m: PopupModel }) {
  const [picking, setPicking] = useState<null | 'mutenow' | 'paused'>(null)
  const name = useId()
  const current = picking ?? (m.overridden ? m.mode : 'schedule')
  const modes = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'mutenow', label: 'Mute now' },
    { key: 'paused', label: 'Pause' },
  ] as const
  return (
    <div>
      <header className="flex items-center justify-between px-4 pt-4">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          <Logo size={18} /> Sordino
        </span>
        <SettingsButton />
      </header>
      <fieldset className="px-4 pt-4">
        <legend className="sr-only">How muting works right now</legend>
        <div className={`grid rounded-xl bg-surface-2 p-1 ${m.overridden ? 'grid-cols-[1.5fr_1fr_1fr]' : 'grid-cols-3'}`}>
          {modes.map((x) => {
            const on = current === x.key
            return (
              <label
                key={x.key}
                className={`ease-colors cursor-pointer whitespace-nowrap rounded-lg px-1 py-2 text-center text-[14px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${
                  on
                    ? 'bg-surface font-medium text-fg shadow-sm'
                    : x.key === 'schedule' && m.overridden
                      ? 'font-medium text-brass-ink underline underline-offset-4 hover:text-fg'
                      : 'text-muted hover:text-fg'
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  checked={on}
                  onChange={() => {
                    if (x.key === 'schedule') {
                      setPicking(null)
                      m.backToSchedule()
                    } else setPicking(x.key)
                  }}
                />
                {x.key === 'schedule' && m.overridden ? 'Back to schedule' : x.label}
              </label>
            )
          })}
        </div>
      </fieldset>
      {picking ? (
        <div className="px-4 pt-4" role="group" aria-label={picking === 'paused' ? 'Pause for how long' : 'Mute now for how long'}>
          <p className="text-[14px] text-muted">{picking === 'paused' ? 'Pause everything for' : 'Mute your list for'}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {DURATIONS.map((d) => (
              <li key={d.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (picking === 'paused') m.pause(d.key)
                    else m.muteNow(d.key)
                    setPicking(null)
                  }}
                  className="ease-colors flex w-full items-center justify-between px-4 py-3 text-left text-[15px] hover:bg-surface-2"
                >
                  <span>{d.label}</span>
                  <span className="tnum text-[13px] text-muted">until {m.untilFor(d.key)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setPicking(null)} className={`${cls.quiet} -ml-3 mt-1`}>
            Cancel
          </button>
        </div>
      ) : (
        <div aria-live="polite" className="mx-4 mt-4 rounded-xl bg-surface p-4">
          <p className="flex items-center gap-2 text-[16px] font-medium">
            <Dot kind={m.status.dot} /> {m.status.head}
          </p>
          <p className="mt-1 pl-4 text-[14px] text-muted">{m.status.sub}</p>
        </div>
      )}
      <section aria-labelledby="pb-today" className="px-4 pb-5 pt-5">
        <h2 id="pb-today" className={cls.label}>
          Today
        </h2>
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ['Muted', m.today.muted],
            ['Turned back', m.today.turnedBack],
            ['Bypassed', m.today.bypassed],
            ['Paused', m.pausesToday],
          ].map(([k, v]) => (
            <div key={k as string} className="flex flex-col-reverse">
              <dt className="mt-0.5 text-[12px] leading-tight text-muted">{k}</dt>
              <dd className="tnum text-[22px] font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-muted">
          <span className="tnum text-fg">
            {m.today.left} of {m.today.budget}
          </span>{' '}
          bypasses left today. After that, a bypass waits 30 seconds.
        </p>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- C
function SiteFirst({ m }: { m: PopupModel }) {
  const [open, setOpen] = useState<null | 'pause' | 'mutenow'>(null)
  const [siteMuted, setSiteMuted] = useState(false)
  const panelId = useId()
  const row =
    'ease-colors flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] hover:bg-surface-2'
  const disclosure = (key: 'pause' | 'mutenow', label: string, on: (d: DurationKey) => void) => (
    <li>
      <button type="button" className={row} aria-expanded={open === key} aria-controls={panelId + key} onClick={() => setOpen(open === key ? null : key)}>
        <span>{label}</span>
        <span aria-hidden className="text-muted">
          {open === key ? '−' : '+'}
        </span>
      </button>
      <div id={panelId + key} hidden={open !== key} className="px-4 pb-3">
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                on(d.key)
                setOpen(null)
              }}
              className="ease-colors flex-1 rounded-lg border border-control px-2 py-2 text-[13px] hover:bg-surface-2"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </li>
  )
  return (
    <div>
      <section aria-label="This tab" className="bg-surface px-4 pb-4 pt-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[13px] font-semibold">
            gh
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">github.com</p>
            <p className="text-[13px] text-muted">
              {siteMuted ? 'Added to your list. Muted from the next visit.' : 'Not on your list.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSiteMuted(!siteMuted)}
            className="ease-colors shrink-0 rounded-lg border border-control px-3 py-1.5 text-[13px] hover:bg-surface-2"
          >
            {siteMuted ? 'Undo' : 'Mute this site'}
          </button>
        </div>
      </section>
      <div aria-live="polite" className="flex items-center gap-2 border-y border-line px-4 py-3">
        <Dot kind={m.status.dot} />
        <p className="text-[14px]">
          <span className="font-medium">{m.status.head}</span>
          {m.mode !== 'paused' && (
            <span className="text-muted"> · {m.mode === 'schedule' ? 'Work hours' : m.mode === 'mutenow' ? 'Mute now' : 'no schedule right now'}</span>
          )}
        </p>
      </div>
      <ul className="divide-y divide-line">
        {m.overridden && (
          <li>
            <button type="button" onClick={m.backToSchedule} className={`${row} font-medium text-brass-ink`}>
              <span>Back to schedule</span>
              <span aria-hidden>↩</span>
            </button>
          </li>
        )}
        {m.muting && disclosure('pause', 'Pause…', m.pause)}
        {!m.muting && disclosure('mutenow', 'Mute now…', m.muteNow)}
        <li>
          <a href="#usage" className={row}>
            <span>
              Usage
              <span className="mt-0.5 block text-[13px] text-muted">
                Today: {m.today.muted} muted, {m.today.turnedBack} turned back, {m.today.bypassed} bypass
              </span>
            </span>
            <span aria-hidden className="text-muted">→</span>
          </a>
        </li>
        <li>
          <a href="#settings" className={row}>
            <span>Settings</span>
            <span aria-hidden className="text-muted">→</span>
          </a>
        </li>
      </ul>
      <p className="border-t border-line px-4 py-3 text-[13px] text-muted">
        Bypass budget: <span className="tnum text-fg">{m.today.left} of {m.today.budget}</span> left today.
      </p>
    </div>
  )
}

const make = (V: (p: { m: PopupModel }) => ReactNode) =>
  function PopupSurface({ state }: { state: string }) {
    return (
      <PopupHost>
        <Bound key={state} state={state} V={V} />
      </PopupHost>
    )
  }
function Bound({ state, V }: { state: string; V: (p: { m: PopupModel }) => ReactNode }) {
  const m = usePopupModel(state)
  return <>{V({ m })}</>
}

export const VariantA = make((p) => <StatusSentence {...p} />)
export const VariantB = make((p) => <ModeFirst {...p} />)
export const VariantC = make((p) => <SiteFirst {...p} />)

export const popupVariants = [
  { key: 'A', label: 'Status sentence', Component: VariantA },
  { key: 'B', label: 'Mode switch', Component: VariantB },
  { key: 'C', label: 'This tab first', Component: VariantC },
]
