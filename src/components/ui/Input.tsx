import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, containerClassName, className, type = 'text', id, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false)
    const isPassword = type === 'password'
    const inputId = id ?? props.name ?? label
    const inputType = isPassword ? (revealed ? 'text' : 'password') : type

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-ink-med">
            {label}
          </label>
        )}
        <div
          className={cn(
            'field flex h-12 items-center gap-2.5 px-5',
            error && 'field-invalid',
            containerClassName
          )}
        >
          {icon && <span className="shrink-0 text-ink-low">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={cn(
              'h-full w-full bg-transparent text-sm text-ink-high placeholder:text-ink-low outline-none',
              isPassword && 'font-mono tracking-[0.18em]',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setRevealed((value) => !value)}
              className="shrink-0 text-ink-low transition-colors hover:text-ink-high"
              aria-label={revealed ? 'Hide password' : 'Show password'}
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : hint ? (
          <p className="text-[11px] leading-relaxed text-ink-low">{hint}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'
