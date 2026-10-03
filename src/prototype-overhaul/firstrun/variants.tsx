// PROTOTYPE — three structurally different First run pages. Defaults pre-selected
// from src/shared/types.ts; nothing is muted until Start.
import { useId, useState, type ReactNode } from 'react'
import { Logo, Switch, cls } from '../ui'
import { categories as defaultCats, schedules as defaultScheds, describeDays, describeHours, bypass } from '../data'

const PRIVATE_LINE =
  "Private windows aren't covered. You can allow Sordino there in your browser's extension settings."

function useFirstRun() {
  const [cats, setCats] = useState(() => Object.fromEntries(defaultCats.map((c) => [c.id, c.enabled])))
  const [scheds, setScheds] = useState(() => Object.fromEntries(defaultScheds.map((s) => [s.id, s.enabled])))
  const [budget, setBudget] = useState(bypass.budget)
  const [wait, setWait] = useState(bypass.wait)
  const [started, setStarted] = useState(false)
  const onCats = defaultCats.filter((c) => cats[c.id])
  const onScheds = defaultScheds.filter((s) => scheds[s.id])
  const siteCount = onCats.reduce((n, c) => n + c.sites.length, 0)
  return {
    cats, scheds, budget, wait, started, onCats, onScheds, siteCount,
    toggleCat: (id: string) => setCats((c) => ({ ...c, [id]: !c[id] })),
    toggleSched: (id: string) => setScheds((s) => ({ ...s, [id]: !s[id] })),
    setBudget, setWait, start: () => setStarted(true), reset: () => setStarted(false),
  }
}
type FR = ReturnType<typeof useFirstRun>

const joinAnd = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

function whenText(f: FR) {
  if (f.onScheds.length === 0) return 'only when you choose Mute now'
  return joinAnd(
    f.onScheds.map((s) => {
      const d = describeDays(s.days)
      const days = d === 'Weekdays' ? 'on weekdays' : d === 'Every day' ? 'every day' : `on ${d}`
      return `${days}, ${describeHours(s.startTime, s.endTime)}`
    }),
  )
}

function Started({ f }: { f: FR }) {
  return (
    <div role="status" className="enter-fade rounded-xl border border-line bg-surface p-5">
      <p className="text-[16px] font-medium">Sordino is on.</p>
      <p className="mt-1 text-[14px] text-muted">
        {f.siteCount} sites will be muted {whenText(f)}. The toolbar icon has everything else.
      </p>
      <button type="button" onClick={f.reset} className={`${cls.quiet} -ml-3 mt-2`}>
        Prototype: back to First run
      </button>
    </div>
  )
}

function SiteList({ sites, id, hidden }: { sites: string[]; id: string; hidden: boolean }) {
  return (
    <p id={id} hidden={hidden} className="mt-2 text-[13px] leading-relaxed text-muted">
      {sites.join(', ')}
    </p>
  )
}

// ---------------------------------------------------------------- A
function Letter() {
  const f = useFirstRun()
  const [shown, setShown] = useState<string | null>(null)
  const uid = useId()
  return (
    <div className="min-h-screen bg-bg text-fg">
      <main className="mx-auto max-w-[620px] px-5 py-14 sm:py-20">
        <span className="flex items-center gap-2 text-[14px] text-muted">
          <Logo size={20} /> Sordino
        </span>
        <h1 className="mt-8 font-display text-[clamp(32px,6vw,44px)] font-medium leading-[1.1]">
          Sordino mutes the sites you pick, during the hours you pick.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          A muted site opens behind a short pause. From there you can turn back, or bypass it after a few seconds.
          These are the defaults. Change what you like, then press Start.
        </p>

        <section aria-labelledby={uid + 'what'} className="mt-12">
          <h2 id={uid + 'what'} className="text-[17px] font-medium">
            What gets muted
          </h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {defaultCats.map((c) => (
              <li key={c.id} className="py-3.5">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <span className="text-[15px]">{c.name}</span>
                    <span className="ml-2 text-[14px] text-muted">{c.sites.length} sites</span>
                  </div>
                  <button
                    type="button"
                    aria-expanded={shown === c.id}
                    aria-controls={uid + c.id}
                    onClick={() => setShown(shown === c.id ? null : c.id)}
                    className={cls.quiet}
                  >
                    {shown === c.id ? 'Hide sites' : 'Show sites'}
                  </button>
                  <Switch checked={f.cats[c.id]} onChange={() => f.toggleCat(c.id)} label={`Mute ${c.name}`} />
                </div>
                <SiteList id={uid + c.id} sites={c.sites} hidden={shown !== c.id} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-muted">You can add your own sites later, or right-click any page.</p>
        </section>

        <section aria-labelledby={uid + 'when'} className="mt-10">
          <h2 id={uid + 'when'} className="text-[17px] font-medium">
            When
          </h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {defaultScheds.map((s) => (
              <li key={s.id} className="flex items-center gap-4 py-3.5">
                <div className="flex-1">
                  <span className="text-[15px]">{s.name}</span>
                  <span className="ml-2 text-[14px] text-muted">
                    {describeDays(s.days)}, {describeHours(s.startTime, s.endTime)}
                  </span>
                </div>
                <Switch checked={f.scheds[s.id]} onChange={() => f.toggleSched(s.id)} label={`Use ${s.name}`} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={uid + 'bp'} className="mt-10">
          <h2 id={uid + 'bp'} className="text-[17px] font-medium">
            Bypasses
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {f.budget} a day, {bypass.minutes} minutes each, after a {f.wait}{'‑'}second wait. Once they're used, a bypass
            is still there after {bypass.spentWait} seconds. Change this in Settings.
          </p>
        </section>

        <p className="mt-10 rounded-xl border border-line px-4 py-3 text-[14px] leading-relaxed">{PRIVATE_LINE}</p>

        <div className="mt-10">
          {f.started ? (
            <Started f={f} />
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={f.start} className={`${cls.primary} px-8 py-3 text-[16px]`}>
                Start
              </button>
              <p className="text-[14px] text-muted">Nothing is muted until you press Start.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------- B
function ChoicesSummary() {
  const f = useFirstRun()
  const uid = useId()
  const check = (on: boolean, toggle: () => void, label: ReactNode, sub: string, key: string) => (
    <label key={key} className="ease-colors flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
      <input type="checkbox" checked={on} onChange={toggle} className="mt-1 h-4 w-4 accent-[var(--brass)]" />
      <span>
        <span className="block text-[15px]">{label}</span>
        <span className="block text-[13px] leading-snug text-muted">{sub}</span>
      </span>
    </label>
  )
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex max-w-[1080px] items-center gap-2 px-5 pt-8 text-[14px] text-muted">
        <Logo size={20} /> Sordino · First run
      </header>
      <main className="mx-auto grid max-w-[1080px] gap-10 px-5 py-10 md:grid-cols-[1fr_420px]">
        <div>
          <h1 className="font-display text-[clamp(30px,4.5vw,40px)] font-medium leading-tight">Here's what Sordino will do.</h1>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            The defaults are already ticked. The summary changes as you do.
          </p>
          <fieldset className="mt-8">
            <legend className={cls.label}>Sites</legend>
            <div className="mt-2 -mx-3">
              {defaultCats.map((c) =>
                check(f.cats[c.id], () => f.toggleCat(c.id), c.name, c.sites.join(', '), c.id),
              )}
            </div>
          </fieldset>
          <fieldset className="mt-8">
            <legend className={cls.label}>Schedules</legend>
            <div className="mt-2 -mx-3">
              {defaultScheds.map((s) =>
                check(
                  f.scheds[s.id],
                  () => f.toggleSched(s.id),
                  s.name,
                  `${describeDays(s.days)}, ${describeHours(s.startTime, s.endTime)}`,
                  s.id,
                ),
              )}
            </div>
          </fieldset>
        </div>
        <aside aria-labelledby={uid + 's'} className="md:sticky md:top-8 md:self-start">
          <div className="rounded-2xl bg-surface p-6">
            <h2 id={uid + 's'} className="sr-only">
              Summary
            </h2>
            <p aria-live="polite" className="text-[18px] leading-relaxed">
              {f.siteCount === 0 ? (
                'No sites are ticked, so nothing will be muted.'
              ) : (
                <>
                  <b className="font-medium">{f.siteCount} sites</b> in {joinAnd(f.onCats.map((c) => c.name))} will be
                  muted {whenText(f)}.
                </>
              )}
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              You'll have {f.budget} bypasses a day, {bypass.minutes} minutes each, after a {f.wait}{'‑'}second wait.
            </p>
            {/* A small, honest preview of what a muted site looks like. */}
            <figure className="mt-5">
              <div aria-hidden className="force-dark rounded-xl border border-line bg-bg p-4 text-center text-fg">
                <p className="font-display text-[24px] leading-none">Fermata</p>
                <p className="mt-1 text-[11px] text-muted">reddit.com is muted until 17:00</p>
                <div className="mx-auto mt-3 flex max-w-[220px] flex-col gap-1.5">
                  <span className="rounded-lg bg-brass py-1.5 text-[12px] font-medium text-on-brass">Turn back</span>
                  <span className="rounded-lg border border-control py-1.5 text-[12px] text-muted">Bypass in {f.wait}</span>
                </div>
              </div>
              <figcaption className="mt-2 text-[13px] text-muted">What a muted site shows.</figcaption>
            </figure>
            <p className="mt-5 border-t border-line pt-4 text-[14px] leading-relaxed">{PRIVATE_LINE}</p>
            <div className="mt-5">
              {f.started ? (
                <Started f={f} />
              ) : (
                <>
                  <button type="button" onClick={f.start} className={`${cls.primary} w-full py-3 text-[16px]`}>
                    Start
                  </button>
                  <p className="mt-2 text-center text-[13px] text-muted">Nothing is muted until you press Start.</p>
                </>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------- C
function OneSentence() {
  const f = useFirstRun()
  const [open, setOpen] = useState<null | 'sites' | 'when' | 'budget' | 'wait'>(null)
  const uid = useId()
  const tok = (key: NonNullable<typeof open>, text: string, label: string) => (
    <button
      type="button"
      aria-expanded={open === key}
      aria-controls={uid + 'panel'}
      aria-label={`${label}: ${text}. Change`}
      onClick={() => setOpen(open === key ? null : key)}
      className={`ease-colors -mx-[0.12em] rounded-md px-[0.12em] text-brass-ink underline decoration-dotted decoration-1 underline-offset-[6px] hover:bg-brass-tint ${
        open === key ? 'bg-brass-tint' : ''
      }`}
    >
      {text}
    </button>
  )
  const opt = (on: boolean, label: string, onClick: () => void, role: 'checkbox' | 'radio' = 'checkbox') => (
    <button
      key={label}
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      className={`ease-colors rounded-full border px-4 py-2 text-[14px] ${
        on ? 'border-brass bg-brass text-on-brass' : 'border-control hover:bg-surface-2'
      }`}
    >
      {on && role === 'checkbox' ? '✓ ' : ''}
      {label}
    </button>
  )
  const sitesText = f.onCats.length ? `${joinAnd(f.onCats.map((c) => c.name))}` : 'nothing'
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="flex items-center gap-2 px-6 pt-8 text-[14px] text-muted sm:px-10">
        <Logo size={20} /> Sordino
      </header>
      <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        <p className={cls.label}>Before anything is muted</p>
        <h1 className="mt-4 font-display text-[clamp(30px,5vw,48px)] font-medium leading-[1.3]">
          Mute {tok('sites', sitesText, 'Sites')} ({f.siteCount} sites) {tok('when', whenText(f), 'When')}. Allow{' '}
          {tok('budget', `${f.budget} bypasses`, 'Bypasses per day')} a day, each after a{' '}
          {tok('wait', `${f.wait}‑second`, 'Bypass wait')} wait.
        </h1>
        <div id={uid + 'panel'} role="group" aria-label="Change this part" className="mt-6 min-h-[64px]">
          {open === 'sites' && (
            <div className="enter-fade flex flex-wrap gap-2">
              {defaultCats.map((c) => opt(f.cats[c.id], `${c.name} · ${c.sites.length}`, () => f.toggleCat(c.id)))}
            </div>
          )}
          {open === 'when' && (
            <div className="enter-fade flex flex-wrap gap-2">
              {defaultScheds.map((s) =>
                opt(f.scheds[s.id], `${s.name} · ${describeDays(s.days)} ${describeHours(s.startTime, s.endTime)}`, () =>
                  f.toggleSched(s.id),
                ),
              )}
            </div>
          )}
          {open === 'budget' && (
            <div className="enter-fade flex flex-wrap gap-2">
              {[1, 2, 3, 5, 10].map((n) => opt(f.budget === n, `${n} a day`, () => f.setBudget(n), 'radio'))}
            </div>
          )}
          {open === 'wait' && (
            <div className="enter-fade flex flex-wrap gap-2">
              {[0, 3, 5, 10, 15].map((n) =>
                opt(f.wait === n, n === 0 ? 'No wait' : `${n} seconds`, () => f.setWait(n), 'radio'),
              )}
            </div>
          )}
          {!open && (
            <p className="text-[14px] text-muted">The underlined parts are the defaults. Tap one to change it.</p>
          )}
        </div>
        <p className="mt-8 max-w-[60ch] text-[15px] leading-relaxed text-muted">{PRIVATE_LINE}</p>
        <div className="mt-8">
          {f.started ? (
            <Started f={f} />
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={f.start} className={`${cls.primary} px-10 py-3 text-[16px]`}>
                Start
              </button>
              <p className="text-[14px] text-muted">Nothing is muted until you press Start.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export const VariantA = Letter
export const VariantB = ChoicesSummary
export const VariantC = OneSentence

export const firstrunVariants = [
  { key: 'A', label: 'Letter', Component: VariantA },
  { key: 'B', label: 'Choices + live summary', Component: VariantB },
  { key: 'C', label: 'One sentence', Component: VariantC },
]
