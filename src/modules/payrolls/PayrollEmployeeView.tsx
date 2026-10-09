import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Banknote, Eye } from 'lucide-react'
import { api } from '@/lib/ipc'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PAYROLL_TYPE_KEYS } from './payrollMeta'
import { PayrollSlipPickerDialog } from './PayrollSlipPickerDialog'

interface PayrollEmployeeViewProps {
  employeeId: string
  onChanged?: () => void
}

/**
 * رواتب موظف واحد: ملخص الدفعات (مرتب/حافز/أخرى) واختيار كل شيء من نافذة
 * المعاينة (النوع + الشهر + الظرف + الحذف) — يُستخدم في تبويب «الرواتب»
 * بالملف الكامل وداخل نافذة من قائمة الموظفين.
 */
export function PayrollEmployeeView({ employeeId, onChanged }: PayrollEmployeeViewProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [pickerOpen, setPickerOpen] = useState(false)

  const entriesQuery = useQuery({
    queryKey: ['payrolls', 'byEmployee', employeeId],
    queryFn: () => api.payrolls.listByEmployee(employeeId),
    enabled: Boolean(employeeId)
  })
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])

  const counts = useMemo(() => {
    const byType = new Map<string, number>()
    for (const entry of entries) byType.set(entry.type, (byType.get(entry.type) ?? 0) + 1)
    return byType
  }, [entries])

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Banknote className="size-7" />}
        title={t('payrolls.empty')}
        body={t('payrolls.emptyEmployeeBody')}
      />
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface-soft px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-surface-strong text-accent-300">
          <Banknote className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-ink-high">
            {t('payrolls.entriesCount', { count: entries.length })}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {PAYROLL_TYPE_KEYS.filter((key) => counts.has(key)).map((key) => (
              <span
                key={key}
                className="rounded-full bg-surface-strong px-2.5 py-0.5 text-[11px] font-medium text-ink-med"
              >
                {t(`payrolls.types.${key}`)} · {counts.get(key)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <SoftButton variant="primary" icon={<Eye className="size-4" />} onClick={() => setPickerOpen(true)}>
        {t('payrolls.preview')}
      </SoftButton>

      {pickerOpen && (
        <PayrollSlipPickerDialog
          open
          employeeId={employeeId}
          initial={entries[0]}
          onClose={() => setPickerOpen(false)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ['payrolls'] })
            onChanged?.()
          }}
        />
      )}
    </div>
  )
}

/** نافذة «المرتبات» من قائمة الموظفين — غلاف Modal لعرض الموظف نفسه. */
export function PayrollByEmployeeModal({
  open,
  employeeId,
  employeeName,
  onClose
}: {
  open: boolean
  employeeId: string | null
  employeeName: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payrolls.employeePayrolls')}
      description={employeeName ?? undefined}
      size="md"
      footer={
        <SoftButton variant="subtle" onClick={onClose}>
          {t('common.close')}
        </SoftButton>
      }
    >
      {employeeId && <PayrollEmployeeView employeeId={employeeId} />}
    </Modal>
  )
}
