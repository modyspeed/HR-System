import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Search } from 'lucide-react'
import type { EmployeeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { cn } from '@/lib/utils'

interface EmployeePickerProps {
  /** Selected employee id ('' when none). */
  value: string
  onSelect: (employeeId: string) => void
  error?: string
}

/**
 * Type-ahead employee picker: write the employee code (or part of the name)
 * and the matching name appears live. Typing a complete code selects the
 * employee immediately; the dropdown covers fuzzy name matches.
 * Shares the employees list cache with the employee module's queries.
 */
const EMPLOYEE_LIST_QUERY = {
  search: undefined,
  isActive: null,
  sort: 'code',
  order: 'asc'
} as const

function displayOf(employee: EmployeeRecord): string {
  return `${employee.code} — ${employee.name}`
}

export function EmployeePicker({ value, onSelect, error }: EmployeePickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const blurTimer = useRef<number | null>(null)

  const employeesQuery = useQuery({
    queryKey: ['employees', 'list', EMPLOYEE_LIST_QUERY],
    queryFn: () => api.employees.list({}),
    staleTime: 60_000
  })
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data])

  // Prefill the display on edit (only while the field is untouched).
  useEffect(() => {
    if (!value || query.trim()) return
    const employee = employees.find((item) => item.id === value)
    if (employee) setQuery(displayOf(employee))
  }, [value, employees, query])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return employees.slice(0, 60)
    return employees
      .filter(
        (employee) =>
          employee.code.toLowerCase().startsWith(needle) ||
          employee.name.toLowerCase().includes(needle)
      )
      .slice(0, 60)
  }, [employees, query])

  const selected = employees.find((employee) => employee.id === value) ?? null
  const showingSelected = selected !== null && query.trim() === displayOf(selected)

  // Typing the complete code resolves the employee dynamically.
  useEffect(() => {
    if (showingSelected) return
    const needle = query.trim()
    if (!needle) {
      if (value) onSelect('')
      return
    }
    const exact = employees.find((employee) => employee.code === needle)
    if (exact) onSelect(exact.id)
    else if (value) onSelect('')
  }, [query, employees, value, onSelect, showingSelected])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current)
    },
    []
  )

  const pick = (employee: EmployeeRecord) => {
    setQuery(displayOf(employee))
    onSelect(employee.id)
    setOpen(false)
  }

  return (
    <div className="relative flex flex-col gap-1.5 sm:col-span-2" ref={containerRef}>
      <label className="text-xs font-medium text-ink-med">{t('leaves.employee')}</label>
      <div className={cn('field flex h-12 items-center gap-2.5 px-5', error && 'field-invalid')}>
        {employeesQuery.isLoading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-ink-low" />
        ) : (
          <Search className="size-4 shrink-0 text-ink-low" />
        )}
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 140)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]) {
              event.preventDefault()
              pick(matches[0])
            }
            if (event.key === 'Escape') setOpen(false)
          }}
          placeholder={t('leaves.selectEmployee')}
          dir="auto"
          className="h-full w-full bg-transparent text-center text-sm text-ink-high placeholder:text-ink-low outline-none"
        />
      </div>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}

      {selected && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-teal-400">
          <Check className="size-3" />
          <span dir="auto">{selected.name}</span>
          <span dir="ltr" className="font-mono text-ink-low">
            {selected.code}
          </span>
        </p>
      )}

      {open && matches.length > 0 && (
        <div className="scroll-area absolute top-full z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-line bg-surface-soft p-1.5 shadow-[var(--shadow-pop)]">
          {matches.map((employee) => (
            <button
              key={employee.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                pick(employee)
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors hover:bg-surface-strong',
                selected?.id === employee.id && 'bg-accent-500/10'
              )}
            >
              <span dir="ltr" className="shrink-0 font-mono text-xs text-ink-low">
                {employee.code}
              </span>
              <span dir="auto" className="truncate text-sm font-medium text-ink-high">
                {employee.name}
              </span>
              {selected?.id === employee.id && <Check className="ms-auto size-3.5 shrink-0 text-accent-300" />}
            </button>
          ))}
        </div>
      )}

      {open && query.trim() !== '' && matches.length === 0 && (
        <div className="absolute top-full z-30 mt-1 w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-center text-xs text-ink-low shadow-[var(--shadow-pop)]">
          {t('leaves.noResults')}
        </div>
      )}
    </div>
  )
}
