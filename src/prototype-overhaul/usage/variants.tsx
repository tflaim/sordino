// PROTOTYPE — three structurally different Usage tabs. Raw counts only: mute count,
// turn-backs, bypasses, pauses. Twelve Monday-start weeks. No rates, no streaks.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Logo, cls } from '../ui'
import { usage, fmtDay, fmtShort, fmtLong, times, TODAY, type DayCounts, type WeekCounts } from '../data'

/** Host context: the settings page with its Settings / Usage tabs. */
function SettingsHost({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-bg pb-24 text-fg">
      <div className={`mx-auto px-5 ${wide ? 'max-w-[1040px]' : 'max-w-[760px]'}`}>
        <header className="flex items-center justify-between pt-8">
          <span className="flex items-center gap-2 text-[15px] font-medium">
            <Logo size={20} /> Sordino
          </span>
          <nav aria-label="Sections" className="flex gap-1 rounded-xl bg-surface-2 p-1 text-[14px]">
            <a href="#settings" className="rounded-lg px-4 py-1.5 text-muted hover:text-fg">
              Settings
            </a>
            <a href="#usage" aria-current="page" className="rounded-lg bg-surface px-4 py-1.5 font-medium shadow-sm">
              Usage
            </a>
          </nav>
        </header>
        {children}
        <p className="mt-16 text-[13px] text-muted">
          Counted on this device only. Twelve weeks are kept; older weeks are dropped.
        </p>
      </div>
    </div>
  )
}

const todayCounts = usage[0].days.find((d) => d.date.getTime() === TODAY.getTime())!
const isEmpty = (x: { muted: number; paused: number }) => x.muted === 0 && x.paused === 0

// ---------------------------------------------------------------- A
function Ledger() {
  const [open, setOpen] = useState<number | null>(0)
  const uid = useId()
  const num = 'tnum px-3 py-3 text-right text-[15px]'
  return (
    <SettingsHost>
      <h1 className="mt-12 font-display text-[36px] font-medium leading-tight">Usage</h1>
      <p className="mt-2 text-[15px] text-muted">
        Today, {fmtLong(TODAY)}: {todayCounts.muted} muted, {todayCounts.turnedBack} turned back,{' '}
        {todayCounts.bypassed} bypassed, {todayCounts.paused} paused.
      </p>
      <table className="mt-8 w-full border-collapse text-left">
        <caption className="sr-only">Daily counts by week, newest first</caption>
        <thead>
          <tr className="border-b border-control text-[13px] text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              Week of
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Mute count
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Turned back
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Bypasses
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              Pauses
            </th>
          </tr>
        </thead>
        {usage.map((w, i) => (
          <tbody key={i} className="border-b border-line">
            <tr className={open === i ? 'bg-surface' : ''}>
              <th scope="row" className="py-1 pr-3 font-normal">
                <button
                  type="button"
                  aria-expanded={open === i}
                  aria-controls={`${uid}-${i}`}
                  onClick={() => setOpen(open === i ? null : i)}
                  className="ease-colors -ml-2 flex items-center gap-2 rounded-md px-2 py-2 text-[15px] hover:bg-surface-2"
                >
                  <span aria-hidden className="w-3 text-muted">
                    {open === i ? '▾' : '▸'}
                  </span>
                  {fmtShort(w.start)}
                  {i === 0 && <span className="text-[13px] text-muted">this week</span>}
                </button>
              </th>
              {isEmpty(w) ? (
                <td colSpan={4} className="py-3 text-right text-[14px] text-muted">
                  Nothing muted this week
                </td>
              ) : (
                <>
                  <td className={num}>{w.muted}</td>
                  <td className={num}>{w.turnedBack}</td>
                  <td className={num}>{w.bypassed}</td>
                  <td className={`${num} pr-0`}>{w.paused}</td>
                </>
              )}
            </tr>
            {w.days.map((d, j) => (
              <tr key={j} id={j === 0 ? `${uid}-${i}` : undefined} hidden={open !== i} className="bg-surface text-muted">
                <th scope="row" className="py-1.5 pl-7 pr-3 text-[14px] font-normal">
                  {fmtDay(d.date)}
                </th>
                {d.future ? (
                  <td colSpan={4} className="py-1.5 text-right text-[13px]">
                    Not yet
                  </td>
                ) : (
                  <>
                    <td className="tnum px-3 py-1.5 text-right text-[14px]">{d.muted}</td>
                    <td className="tnum px-3 py-1.5 text-right text-[14px]">{d.turnedBack}</td>
                    <td className="tnum px-3 py-1.5 text-right text-[14px]">{d.bypassed}</td>
                    <td className="tnum py-1.5 pl-3 text-right text-[14px]">{d.paused}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </SettingsHost>
  )
}

// ---------------------------------------------------------------- B
const METRICS = [
  { key: 'muted', label: 'Mute count', noun: 'muted' },
  { key: 'turnedBack', label: 'Turned back', noun: 'turned back' },
  { key: 'bypassed', label: 'Bypasses', noun: 'bypassed' },
  { key: 'paused', label: 'Pauses', noun: 'paused' },
] as const
type MetricKey = (typeof METRICS)[number]['key']

// Fixed buckets per metric so a shade always means the same count range.
const BUCKETS: Record<MetricKey, number[]> = {
  muted: [1, 4, 8, 12],
  turnedBack: [1, 3, 5, 8],
  bypassed: [1, 2, 4, 6],
  paused: [1, 1, 1, 1],
}
const SHADES = [
  'bg-[color-mix(in_oklab,var(--brass)_35%,var(--surface))]',
  'bg-[color-mix(in_oklab,var(--brass)_58%,var(--surface))]',
  'bg-[color-mix(in_oklab,var(--brass)_80%,var(--surface))]',
  'bg-brass',
]
const ZERO = 'border border-control/50 bg-transparent'
function shade(metric: MetricKey, v: number) {
  if (v <= 0) return ZERO
  const b = BUCKETS[metric]
  let i = 0
  while (i < 3 && v >= b[i + 1]) i++
  return SHADES[i]
}
function bucketLabels(metric: MetricKey) {
  const b = BUCKETS[metric]
  if (metric === 'paused') return ['0', '1 or more']
  return ['0', `${b[0]}–${b[1] - 1}`, `${b[1]}–${b[2] - 1}`, `${b[2]}–${b[3] - 1}`, `${b[3]}+`]
}

function Strip() {
  const [metric, setMetric] = useState<MetricKey>('muted')
  const weeks = [...usage].reverse() // oldest → newest, left → right
  const [focus, setFocus] = useState<[number, number]>([weeks.length - 1, 5])
  const [table, setTable] = useState(false)
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  const name = useId()
  const sel: DayCounts = weeks[focus[0]].days[focus[1]]
  const m = METRICS.find((x) => x.key === metric)!
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const move = (e: KeyboardEvent, w: number, d: number) => {
    let [nw, nd] = [w, d]
    if (e.key === 'ArrowRight') nw++
    else if (e.key === 'ArrowLeft') nw--
    else if (e.key === 'ArrowDown') nd++
    else if (e.key === 'ArrowUp') nd--
    else return
    e.preventDefault() // keeps the prototype switcher from changing variant
    nw = Math.max(0, Math.min(weeks.length - 1, nw))
    nd = Math.max(0, Math.min(6, nd))
    if (weeks[nw].days[nd].future) return
    setFocus([nw, nd])
    cells.current[nw * 7 + nd]?.focus()
  }

  const legend = bucketLabels(metric)
  return (
    <SettingsHost wide>
      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[36px] font-medium leading-tight">Usage</h1>
        <fieldset>
          <legend className="sr-only">Count to show</legend>
          <div className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
            {METRICS.map((x) => (
              <label
                key={x.key}
                className={`ease-colors cursor-pointer rounded-lg px-3 py-1.5 text-[14px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${
                  metric === x.key ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                <input type="radio" name={name} className="sr-only" checked={metric === x.key} onChange={() => setMetric(x.key)} />
                {x.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[auto_1fr]">
        <div>
          <div className="overflow-x-auto pb-2">
            <div role="grid" aria-label={`${m.label} per day, last twelve weeks`} className="inline-grid grid-cols-[36px_repeat(12,32px)] gap-[3px]">
              <div role="row" className="contents">
                <span role="columnheader" aria-hidden />
                {weeks.map((w, i) => (
                  <span key={i} role="columnheader" className="h-5 text-[11px] text-muted">
                    {i === 0 || w.start.getDate() <= 7 ? w.start.toLocaleDateString('en-GB', { month: 'short' }) : ''}
                  </span>
                ))}
              </div>
              {DOW.map((dn, d) => (
                <div role="row" key={dn} className="contents">
                  <span role="rowheader" className="flex h-8 items-center text-[12px] text-muted">
                    {dn}
                  </span>
                  {weeks.map((w, wi) => {
                    const day = w.days[d]
                    const v = day[metric]
                    const isSel = focus[0] === wi && focus[1] === d
                    return (
                      <span role="gridcell" key={wi}>
                        <button
                          ref={(el) => {
                            cells.current[wi * 7 + d] = el
                          }}
                          type="button"
                          tabIndex={isSel ? 0 : -1}
                          disabled={day.future}
                          aria-label={
                            day.future
                              ? `${fmtLong(day.date)}, not yet`
                              : `${fmtLong(day.date)}: ${day.muted} muted, ${day.turnedBack} turned back, ${day.bypassed} bypassed, ${day.paused} paused`
                          }
                          aria-pressed={isSel}
                          onClick={() => setFocus([wi, d])}
                          onFocus={() => setFocus([wi, d])}
                          onMouseEnter={() => !day.future && setFocus([wi, d])}
                          onKeyDown={(e) => move(e, wi, d)}
                          className={`block h-8 w-8 rounded-[5px] ${day.future ? 'border border-dashed border-line bg-transparent' : shade(metric, v)} ${
                            isSel ? 'outline-2 outline-offset-1 outline-fg' : ''
                          }`}
                        />
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-muted" aria-label={`Legend for ${m.label}`}>
            {legend.map((l, i) => (
              <span key={l} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-3.5 w-3.5 rounded-[3px] ${
                    i === 0 ? ZERO : metric === 'paused' ? SHADES[3] : SHADES[i - 1]
                  }`}
                />
                {l}
              </span>
            ))}
          </div>
        </div>

        <section aria-live="polite" aria-label="Selected day" className="self-start rounded-2xl bg-surface p-6 lg:min-w-[300px]">
          <p className="text-[14px] text-muted">{fmtLong(sel.date)}</p>
          {isEmpty(sel) ? (
            <p className="mt-3 text-[16px]">Nothing muted that day.</p>
          ) : (
            <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-[15px]">
              {METRICS.map((x) => (
                <div key={x.key} className="contents">
                  <dt className={x.key === metric ? 'text-fg' : 'text-muted'}>{x.label}</dt>
                  <dd className={`tnum text-right ${x.key === metric ? 'font-medium' : ''}`}>{sel[x.key]}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
            Week of {fmtShort(weeks[focus[0]].start)}: {weeks[focus[0]].muted} muted, {weeks[focus[0]].turnedBack} turned
            back, {weeks[focus[0]].bypassed} bypassed, {weeks[focus[0]].paused} paused.
          </p>
        </section>
      </div>

      <button type="button" aria-expanded={table} onClick={() => setTable(!table)} className={`${cls.quiet} -ml-3 mt-8`}>
        {table ? 'Hide the table' : 'Show as a table'}
      </button>
      {table && <PlainTable weeks={usage} />}
    </SettingsHost>
  )
}

function PlainTable({ weeks }: { weeks: WeekCounts[] }) {
  return (
    <table className="mt-2 w-full max-w-[640px] text-[14px]">
      <caption className="sr-only">Weekly totals</caption>
      <thead className="text-muted">
        <tr>
          <th scope="col" className="py-1 text-left font-medium">Week of</th>
          {METRICS.map((m) => (
            <th key={m.key} scope="col" className="py-1 text-right font-medium">{m.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((w, i) => (
          <tr key={i} className="border-t border-line">
            <th scope="row" className="py-1.5 text-left font-normal">{fmtShort(w.start)}</th>
            {METRICS.map((m) => (
              <td key={m.key} className="tnum py-1.5 text-right">{w[m.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------- C
function weekSentence(w: WeekCounts, current: boolean) {
  if (isEmpty(w)) return current ? 'Nothing muted yet this week.' : 'Nothing was muted this week.'
  const lead = current ? 'So far this week, sites were muted' : 'Sites were muted'
  const parts = [`${lead} ${times(w.muted)}.`]
  parts.push(`You turned back ${times(w.turnedBack)} and bypassed ${times(w.bypassed)}.`)
  parts.push(w.paused === 0 ? 'No pauses.' : `You paused ${times(w.paused)}.`)
  return parts.join(' ')
}

function Sentences() {
  const [open, setOpen] = useState<number | null>(null)
  const uid = useId()
  return (
    <SettingsHost>
      <h1 className="mt-12 font-display text-[36px] font-medium leading-tight">Usage</h1>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-muted">
        Each week in a sentence, newest first. Today so far: {todayCounts.muted} muted, {todayCounts.turnedBack}{' '}
        turned back, {todayCounts.bypassed} bypassed.
      </p>
      <ol className="mt-10">
        {usage.map((w, i) => (
          <li key={i} className="grid grid-cols-[96px_1fr] gap-x-6 border-t border-line py-5 sm:grid-cols-[132px_1fr]">
            <h2 className="pt-0.5 text-[14px] text-muted">
              <span className="block text-[12px]">{i === 0 ? 'This week, from' : 'Week of'}</span>
              <span className="text-fg">{fmtShort(w.start)}</span>
            </h2>
            <div>
              <p className="max-w-[60ch] text-[17px] leading-relaxed">{weekSentence(w, i === 0)}</p>
              {!isEmpty(w) && (
                <>
                  <button
                    type="button"
                    aria-expanded={open === i}
                    aria-controls={`${uid}-${i}`}
                    onClick={() => setOpen(open === i ? null : i)}
                    className={`${cls.quiet} -ml-3 mt-1 text-[13px]`}
                  >
                    {open === i ? 'Hide the days' : 'Day by day'}
                  </button>
                  <ul id={`${uid}-${i}`} hidden={open !== i} className="mt-1 space-y-1 text-[14px] text-muted">
                    {w.days
                      .filter((d) => !d.future)
                      .map((d, j) => (
                        <li key={j} className="tnum">
                          <span className="inline-block w-[110px] text-fg">{fmtDay(d.date)}</span>
                          {isEmpty(d)
                            ? 'nothing muted'
                            : `${d.muted} muted · ${d.turnedBack} turned back · ${d.bypassed} bypassed${d.paused ? ` · ${d.paused} paused` : ''}`}
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </SettingsHost>
  )
}

export const VariantA = Ledger
export const VariantB = Strip
export const VariantC = Sentences

export const usageVariants = [
  { key: 'A', label: 'Weekly ledger', Component: VariantA },
  { key: 'B', label: 'Calendar strip', Component: VariantB },
  { key: 'C', label: 'Week in a sentence', Component: VariantC },
]
