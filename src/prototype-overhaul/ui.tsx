// PROTOTYPE — the only shared bits: the logo mark and a few class strings.
// Layout is deliberately NOT shared between variants.
import logoUrl from '../../public/icons/logo.png'

export function Logo({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <img src={logoUrl} width={size} height={size} alt="" className={className} />
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Logo size={20} />
      <span className="text-[15px] font-medium tracking-wide">Sordino</span>
    </span>
  )
}

export const cls = {
  primary:
    'ease-colors inline-flex items-center justify-center rounded-xl bg-brass px-4 py-2.5 text-[15px] font-medium text-on-brass hover:brightness-105',
  secondary:
    'ease-colors inline-flex items-center justify-center rounded-xl border border-control bg-transparent px-4 py-2.5 text-[15px] font-medium text-fg hover:bg-surface-2',
  quiet:
    'ease-colors inline-flex items-center justify-center rounded-lg px-3 py-2 text-[14px] text-muted underline-offset-4 hover:text-fg hover:underline',
  label: 'text-[12px] font-medium uppercase tracking-[0.08em] text-muted',
}

/** A labelled switch with a visible text state, not colour alone. */
export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`ease-colors relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border ${
        checked ? 'border-brass bg-brass' : 'border-control bg-surface-2'
      }`}
    >
      <span
        aria-hidden
        className={`ease-colors absolute h-[18px] w-[18px] rounded-full ${
          checked ? 'left-[22px] bg-on-brass' : 'left-[2px] bg-control'
        }`}
      />
    </button>
  )
}
