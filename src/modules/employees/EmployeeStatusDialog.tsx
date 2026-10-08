import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BadgeCheck, History } from 'lucide-react'
import type { EmployeeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { Badge } from '@/components/ui/Badge'
import { EMPLOYEE_STATUS_KEYS, employeeStatusTone } from './employeeStatusMeta'

interface EmployeeStatusDialogProps {
  open: boolean
  employee: EmployeeRecord | null
  onClose: () => void
  /** Called after a successful transition so the list/profile refresh. */
  onChanged: () => void
}

/**
 * إدارة الحالة الوظيفية للموظف: تغيير الحالة (نشط، معاش، وفاة، استقالة…)
 * مع سبب اختياري — كل انتقال يُسجَّل في السجل التاريخي تلقائيًا.
 */
export function EmployeeStatusDialog({
  open,
  employee,
  onClose,
  onChanged
}: EmployeeStatusDialogProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    setStatus(employee?.status ?? '')
    setReason('')
  }, [open, employee?.status])

  const mutation = useMutation({
    mutationFn: () =>
      api.employees.setStatus(employee!.id, {
        status,
        reason: reason.trim() || undefined
      }),
    onSuccess: () => {
      toast.success(t('toasts.employeeStatusChanged'))
      onChanged()
      onClose()
    },
    onError: (error) => {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const unchanged = status === (employee?.status ?? '')
  const busy = mutation.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('employees.statusTitle')}
      description={employee ? `${employee.name} — ${employee.code}` : undefined}
      size="md"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </SoftButton>
          <SoftButton
            variant="primary"
            icon={<BadgeCheck className="size-4" />}
            loading={busy}
            disabled={unchanged}
            onClick={() => mutation.mutate()}
          >
            {t('employees.statusSave')}
          </SoftButton>
        </>
      }
    >
      {employee && (
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <History className="size-4 shrink-0 text-accent-300" />
            <span className="text-xs text-ink-low">{t('employees.statusCurrent')}</span>
            <Badge tone={employeeStatusTone(employee.status)} dot>
              {t(`employeeStatuses.${employee.status}`)}
            </Badge>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-med">{t('employees.statusNew')}</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EMPLOYEE_STATUS_KEYS.map((key) => {
                const active = status === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-start transition-colors',
                      active
                        ? 'border-accent-500/50 bg-accent-500/10'
                        : 'border-line bg-surface-soft/60 hover:border-line-strong'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1 grid size-4 shrink-0 place-items-center rounded-full border',
                        active ? 'border-accent-400' : 'border-ink-low/40'
                      )}
                    >
                      {active && <span className="size-2 rounded-full bg-accent-400" />}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-ink-high">
                        {t(`employeeStatuses.${key}`)}
                      </span>
                      <span className="text-[10px] leading-tight text-ink-low">
                        {t(`employeeStatuses.hints.${key}`)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="status-reason" className="text-xs font-medium text-ink-med">
              {t('employees.statusReason')}
              <span className="ms-1 text-[10px] text-ink-low">({t('common.optional')})</span>
            </label>
            <div className="field flex items-start gap-2.5 px-5 py-3.5">
              <textarea
                id="status-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('employees.statusReasonPlaceholder')}
                className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-ink-high placeholder:text-ink-low outline-none"
              />
            </div>
          </div>

          <p className="rounded-2xl border border-line bg-surface-soft px-4 py-3 text-[11px] leading-relaxed text-ink-low">
            {t('employees.statusNote')}
          </p>
        </div>
      )}
    </Modal>
  )
}
