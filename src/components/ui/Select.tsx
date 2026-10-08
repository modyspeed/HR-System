import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  containerClassName?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, hint, containerClassName, className, options, placeholder, id, ...props },
    ref
  ) => {
    const selectId = id ?? props.name ?? label

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-ink-med">
            {label}
          </label>
        )}
        <div className={cn('field flex h-12 items-center px-5', error && 'field-invalid')}>
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'h-full w-full appearance-none bg-transparent text-center text-sm text-ink-high outline-none',
              '[&>option]:bg-bg-700 [&>option]:text-center [&>option]:text-ink-high',
              className
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none size-4 shrink-0 text-ink-low" />
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
Select.displayName = 'Select'
