import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

interface SoftButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  block?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'btn-sheen text-accent-ink font-bold bg-gradient-to-b from-accent-300 to-accent-500 ' +
    'shadow-[var(--shadow-cta),var(--shadow-rim)] hover:from-accent-400 hover:to-accent-600',
  ghost:
    'text-ink-high bg-surface-soft border border-line shadow-[var(--shadow-raised),var(--shadow-rim)] hover:bg-surface-strong hover:border-line-strong',
  subtle: 'text-ink-med bg-transparent border border-transparent hover:bg-surface-soft hover:text-ink-high',
  danger:
    'text-rose-400 bg-rose-500/[0.08] border border-rose-400/30 hover:bg-rose-500/[0.16] hover:border-rose-400/55'
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-[52px] px-6 text-[15px] gap-2.5'
}

export const SoftButton = forwardRef<HTMLButtonElement, SoftButtonProps>(
  ({ className, variant = 'ghost', size = 'md', loading = false, icon, block, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cn(
          'btn-3d focus-ring inline-flex select-none items-center justify-center whitespace-nowrap',
          VARIANTS[variant],
          SIZES[size],
          block && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
        {children}
      </button>
    )
  }
)
SoftButton.displayName = 'SoftButton'
