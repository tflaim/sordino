// PROTOTYPE — three structurally different overlays. Always dark (`force-dark`),
// sitting on top of a light host feed. State comes from ?state=normal|spent|armed.
import { useEffect, useRef, useState, type ComponentType, type RefObject } from 'react'
import { HostFeed } from './HostFeed'
import { Logo, cls } from '../ui'
import { bypass, quote } from '../data'

export type OverlayState = 'normal' | 'spent' | 'armed'
export const overlayStates = [
  { key: 'normal', label: 'normal (5 s wait)' },
  { key: 'spent', label: 'budget spent (30 s wait)' },
  { key: 'armed', label: 'bypass armed' },
]

interface OverlayProps {
  wait: number
  ready: boolean
  spent: boolean
  left: number
  onTurnBack: () => void
  onBypass: () => void
  turnBackRef: RefObject<HTMLButtonElement | null>
}

const SITE = 'reddit.com'
const UNTIL = '17:00'

function budgetLine(p: OverlayProps) {
  return p.spent
    ? `Today's ${bypass.budget} bypasses are used. You can still bypass after a ${bypass.spentWait}-second wait.`
    : `${p.left} of ${bypass.budget} bypasses left today`
}

/** Bypass button: the wait is a plain number on the button; never a dead end. */
function BypassButton({ p, className }: { p: OverlayProps; className: string }) {
  return (
    <button
      type="button"
      aria-disabled={!p.ready}
      aria-describedby="ov-budget"
      onClick={() => p.ready && p.onBypass()}
      className={`${className} tnum ${p.ready ? '' : 'cursor-default text-muted'}`}
    >
      {p.ready ? `Bypass for ${bypass.minutes} min` : `Bypass in ${p.wait}`}
    </button>
  )
}

function Announce({ p }: { p: OverlayProps }) {
  return (
    <span className="sr-only" aria-live="polite">
      {p.ready ? `Bypass is available. A bypass lasts ${bypass.minutes} minutes.` : ''}
    </span>
  )
}

// ---------------------------------------------------------------- A
function CentredColumn(p: OverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ov-title"
      aria-describedby="ov-desc"
      lang="en"
      className="force-dark enter-fade fixed inset-0 z-50 overflow-y-auto bg-bg text-fg"
    >
      <div className="mx-auto flex min-h-full max-w-[560px] flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-10 flex items-center gap-2 text-[14px] text-muted">
          <Logo size={18} /> Sordino
        </span>
        <h1 id="ov-title" className="font-display text-[48px] font-medium leading-none">
          Fermata
        </h1>
        <p id="ov-desc" className="mt-4 text-[16px] text-muted">
          A held note. <span className="text-fg">{SITE}</span> is muted until {UNTIL}, for Work hours.
        </p>
        <figure className="mt-12 max-w-[440px]">
          <blockquote className="font-display text-[26px] italic leading-snug">
            “{quote.text}”
          </blockquote>
          <figcaption className="mt-3 text-[14px] text-muted">
            — {quote.author}, <cite className="not-italic">{quote.source}</cite>
          </figcaption>
        </figure>
        <div className="mt-12 flex w-full max-w-[320px] flex-col gap-3">
          <button ref={p.turnBackRef} type="button" onClick={p.onTurnBack} className={`${cls.primary} py-3.5 text-[16px]`}>
            Turn back
          </button>
          <BypassButton p={p} className={cls.secondary} />
        </div>
        <p id="ov-budget" className="mt-4 max-w-[320px] text-[13px] text-muted">
          {budgetLine(p)}
        </p>
        <Announce p={p} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- B
function DecisionPanel(p: OverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ov-title"
      aria-describedby="ov-desc"
      lang="en"
      // Pushes past DESIGN.md: a card held over the page, which stays as an
      // unreadable blur so you keep your bearings without seeing the feed.
      className="force-dark enter-fade fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[rgba(26,22,18,0.72)] p-6 text-fg backdrop-blur-[28px]"
    >
      <div className="grid w-full max-w-[1000px] items-center gap-12 rounded-3xl bg-bg px-10 py-12 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1.25fr_1fr]">
        <section className="flex flex-col">
          <span className="flex items-center gap-2 text-[14px] text-muted">
            <Logo size={18} /> Sordino
          </span>
          <h1 id="ov-title" className="mt-8 font-display text-[64px] font-medium leading-none">
            Tacet
          </h1>
          <p id="ov-desc" className="mt-4 max-w-[30ch] text-[18px] leading-relaxed text-muted">
            In a score, it means the instrument is silent. Here it means{' '}
            <span className="text-fg">{SITE}</span> is, until {UNTIL}.
          </p>
          <figure className="mt-12 border-t border-line pt-6">
            <blockquote className="max-w-[28ch] font-display text-[26px] italic leading-snug">
              “{quote.text}”
            </blockquote>
            <figcaption className="mt-3 text-[14px] text-muted">
              — {quote.author}, <cite className="not-italic">{quote.source}</cite>
            </figcaption>
          </figure>
        </section>
        <section aria-label="Your choice" className="rounded-2xl bg-surface p-6 md:self-stretch md:content-center">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[14px]">
            <dt className="text-muted">Site</dt>
            <dd>{SITE}</dd>
            <dt className="text-muted">Muted by</dt>
            <dd>Work hours · weekdays 09:00–17:00</dd>
            <dt className="text-muted">Until</dt>
            <dd className="tnum">{UNTIL}</dd>
            <dt className="text-muted">A bypass</dt>
            <dd>{bypass.minutes} minutes, this site only</dd>
            <dt className="text-muted">Left today</dt>
            <dd className="tnum">
              {p.spent ? `0 of ${bypass.budget}` : `${p.left} of ${bypass.budget}`}
            </dd>
          </dl>
          <div className="mt-6 flex flex-col gap-3">
            <button ref={p.turnBackRef} type="button" onClick={p.onTurnBack} className={`${cls.primary} py-3.5 text-[16px]`}>
              Turn back
            </button>
            <BypassButton p={p} className={cls.secondary} />
          </div>
          <p id="ov-budget" className="mt-4 text-[13px] leading-relaxed text-muted">
            {p.spent
              ? `The budget is spent, so the wait is ${bypass.spentWait} seconds. The bypass is still yours.`
              : `The ${bypass.wait}-second wait is the whole cost. Turning back is instant.`}
          </p>
          <Announce p={p} />
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- C
function SentenceBar(p: OverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ov-title"
      aria-describedby="ov-desc"
      lang="en"
      className="force-dark enter-fade fixed inset-0 z-50 flex flex-col bg-bg text-fg"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[1040px] flex-col justify-center px-8 py-14">
          <span className="flex items-center gap-2 text-[14px] text-muted">
            <Logo size={18} /> Sordino · Rest measure
          </span>
          <h1 id="ov-title" className="mt-8 max-w-[18ch] font-display text-[clamp(40px,6vw,72px)] font-medium leading-[1.05]">
            {SITE} is muted until {UNTIL}.
          </h1>
          <p id="ov-desc" className="mt-5 text-[17px] text-muted">
            Work hours, weekdays 09:00–17:00. You opened it at 11:12.
          </p>
          <figure className="mt-14 max-w-[520px]">
            <blockquote className="font-display text-[24px] italic leading-snug text-fg/90">
              “{quote.text}”
            </blockquote>
            <figcaption className="mt-2 text-[14px] text-muted">
              — {quote.author}, <cite className="not-italic">{quote.source}</cite>
            </figcaption>
          </figure>
        </div>
      </div>
      <div className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-4 px-8 py-5">
          <button
            ref={p.turnBackRef}
            type="button"
            onClick={p.onTurnBack}
            className={`${cls.primary} min-w-[220px] py-3.5 text-[16px]`}
          >
            Turn back
          </button>
          <BypassButton p={p} className={`${cls.secondary} min-w-[180px] py-3.5`} />
          <p id="ov-budget" className="min-w-[240px] flex-1 text-[14px] leading-relaxed text-muted sm:pl-4">
            {budgetLine(p)}
          </p>
          <Announce p={p} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- stage
function OverlayStage({ Variant, state }: { Variant: ComponentType<OverlayProps>; state: OverlayState }) {
  const spent = state === 'spent'
  const start = state === 'armed' ? 0 : spent ? bypass.spentWait : bypass.wait
  const [wait, setWait] = useState(start)
  const [outcome, setOutcome] = useState<null | 'back' | 'bypassed'>(null)
  const turnBackRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (outcome || wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait, outcome])

  useEffect(() => {
    if (!outcome) turnBackRef.current?.focus()
  }, [outcome])

  const reset = () => {
    setOutcome(null)
    setWait(start)
  }

  if (outcome === 'back')
    return (
      <div className="grid min-h-screen place-items-center bg-[#f3f3f3] p-8 text-center text-[#333]">
        <div>
          <p className="text-[15px]">Turned back. In 2.0 the tab returns to where you came from, or to a new tab.</p>
          <button type="button" onClick={reset} className="mt-4 rounded bg-[#333] px-3 py-1.5 text-[13px] text-white">
            Prototype: show the overlay again
          </button>
        </div>
      </div>
    )

  return (
    <div className="relative">
      <HostFeed />
      {outcome === 'bypassed' ? (
        <div className="fixed right-4 top-14 z-40 rounded-lg bg-slate-900 px-3 py-2 font-mono text-[12px] text-slate-100 shadow-lg">
          Bypassed: {SITE} open for {bypass.minutes} min (toolbar badge in 2.0).{' '}
          <button type="button" onClick={reset} className="underline">
            show overlay again
          </button>
        </div>
      ) : (
        <Variant
          wait={wait}
          ready={wait <= 0}
          spent={spent}
          left={bypass.budget - bypass.used}
          onTurnBack={() => setOutcome('back')}
          onBypass={() => setOutcome('bypassed')}
          turnBackRef={turnBackRef}
        />
      )}
    </div>
  )
}

const make = (V: ComponentType<OverlayProps>) =>
  function OverlaySurface({ state }: { state: string }) {
    return <OverlayStage key={state} Variant={V} state={(state as OverlayState) || 'normal'} />
  }

export const VariantA = make(CentredColumn)
export const VariantB = make(DecisionPanel)
export const VariantC = make(SentenceBar)

export const overlayVariants = [
  { key: 'A', label: 'Centred column', Component: VariantA },
  { key: 'B', label: 'Card over blurred page', Component: VariantB },
  { key: 'C', label: 'Sentence + action bar', Component: VariantC },
]
