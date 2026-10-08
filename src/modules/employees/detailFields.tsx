import { cn } from '@/lib/utils'

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 mt-6 text-[11px] font-semibold uppercase tracking-wider text-accent-300 first:mt-0">
      {children}
    </h3>
  )
}

export function DetailField({
  label,
  value,
  ltr = false,
  mono = false
}: {
  label: string
  value: string
  ltr?: boolean
  mono?: boolean
}) {
  return (
    <div className="rounded-2xl bg-surface-soft px-4 py-3 shadow-[var(--shadow-inset)]">
      <p className="text-[11px] text-ink-low">{label}</p>
      <p
        dir={ltr ? 'ltr' : 'auto'}
        className={cn(
          'mt-1 text-sm font-medium break-words text-ink-high',
          mono && 'font-mono text-[13px]',
          !value && 'text-ink-low'
        )}
      >
        {value || '—'}
      </p>
    </div>
  )
}
