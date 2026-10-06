import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { spring } from '@/lib/motion'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  className?: string
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onChange, label, description, disabled = false, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors',
          'hover:bg-surface-soft',
          disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
          className
        )
      }>
        <motion.span
          layout
          transition={spring}
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-md border transition-all duration-200',
            checked
              ? 'border-accent-400 bg-gradient-to-b from-accent-300 to-accent-500 shadow-[0_4px_12px_-4px_var(--accent-glow)]'
              : 'border-line-strong bg-surface-soft group-hover:border-line-strong'
          )}
        >
          {checked && <Check className="size-3.5 text-accent-ink" strokeWidth={3.5} />}
        </motion.span>
        {(label || description) && (
          <span className="flex min-w-0 flex-col">
            {label && <span className="text-sm text-ink-high">{label}</span>}
            {description && <span className="text-[11px] text-ink-low">{description}</span>}
          </span>
        )}
      </button>
    )
  }
)
Checkbox.displayName = 'Checkbox'
