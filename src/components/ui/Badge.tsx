import { cn } from '@/lib/utils'

type Tone = 'gold' | 'teal' | 'violet' | 'rose' | 'neutral'

const TONES: Record<Tone, string> = {
  gold: 'text-accent-300 bg-accent-500/10 border-accent-500/25',
  teal: 'text-teal-400 bg-teal-400/10 border-teal-400/25',
  violet: 'text-violet-400 bg-violet-400/10 border-violet-400/25',
  rose: 'text-rose-400 bg-rose-400/10 border-rose-400/25',
  neutral: 'text-ink-med bg-surface-base border-line'
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  dot?: boolean
}

export function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold leading-none',
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />}
      {children}
    </span>
  )
}
