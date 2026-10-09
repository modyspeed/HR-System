import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PayrollRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { usePermission } from '@/hooks/usePermission'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { periodLabel } from './payrollMeta'
import { PayrollPreviewModal } from './PayrollPreviewModal'

interface PayrollSlipPickerDialogProps {
  open: boolean
  employeeId: string | null
  /** الدفعة المُحدَّدة مسبقًا عند الفتح (نوعها وشهرها) — اختياري. */
  initial?: PayrollRecord | null
  onClose: () => void
  /** بعد حذف دفعة من داخل النافذة. */
  onChanged?: () => void
}

/**
 * بوب أب معاينة الظرف: يختار المستخدم **نوع المرتب** (مرتب/حافز/أخرى) ثم
 * **الشهر** من كل رواتب الموظف، ويتعرض ظرف الاختيار مباشرة (أرقام + PDF)،
 * مع إمكانية حذف الدفعة المعروضة من هنا.
 */
export function PayrollSlipPickerDialog({
  open,
  employeeId,
  initial,
  onClose,
  onChanged
}: PayrollSlipPickerDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const canDelete = usePermission('payrolls.delete')
  // تُهيّأ مرة واحدة عند فتح النافذة (تُركَّب بشكل مشروط) — لا تتغيّر مع تحديثات
  // البيانات أثناء الفتح، فيبقى اختيار المستخدم سليمًا.
  const [type, setType] = useState(() => initial?.type ?? '')
  const [period, setPeriod] = useState(() => initial?.period ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const entriesQuery = useQuery({
    queryKey: ['payrolls', 'byEmployee', employeeId],
    queryFn: () => api.payrolls.listByEmployee(employeeId!),
    enabled: open && employeeId !== null,
    staleTime: 30_000
  })
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])

  const selected = useMemo(
    () => entries.find((entry) => entry.type === type && entry.period === period) ?? null,
    [entries, type, period]
  )

  const typesPresent = useMemo(() => [...new Set(entries.map((entry) => entry.type))], [entries])

  const periodsOfType = useMemo(() => {
    if (!type) return []
    const values = [...new Set(entries.filter((entry) => entry.type === type).map((entry) => entry.period))]
    values.sort((a, b) => (a < b ? 1 : -1))
    return values
  }, [entries, type])

  // إن اختفى الاختيار الحالي (حذف أو استبدال) ننتقل لأحدث دفعة متبقية.
  useEffect(() => {
    if (!open || entries.length === 0) return
    const exists = entries.some((entry) => entry.type === type && entry.period === period)
    if (!exists || type === '') {
      setType(entries[0].type)
      setPeriod(entries[0].period)
    }
  }, [open, entries, type, period])

  const deleteMutation = useMutation({
    mutationFn: () => api.payrolls.remove(selected!.id),
    onSuccess: () => {
      toast.success(t('toasts.payrollDeleted'))
      setConfirmDelete(false)
      void queryClient.invalidateQueries({ queryKey: ['payrolls'] })
      onChanged?.()
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('payrolls.chooseSlip')}
        description={selected ? `${selected.employeeCode} · ${selected.employeeName}` : undefined}
        size="xl"
        footer={
          <>
            {selected && canDelete && (
              <SoftButton
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConfirmDelete(true)}
              >
                {t('common.delete')}
              </SoftButton>
            )}
            <SoftButton variant="subtle" onClick={onClose}>
              {t('common.close')}
            </SoftButton>
          </>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-wrap items-end gap-3">
            <Select
              containerClassName="lg:w-56"
              label={t('payrolls.pickType')}
              value={type}
              onChange={(event) => {
                const nextType = event.target.value
                setType(nextType)
                const firstOfType = entries.find((entry) => entry.type === nextType)
                setPeriod(firstOfType?.period ?? '')
              }}
              options={typesPresent.map((key) => ({ value: key, label: t(`payrolls.types.${key}`) }))}
            />
            <Select
              containerClassName="lg:w-48"
              label={t('payrolls.pickPeriod')}
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              options={periodsOfType.map((value) => ({ value, label: periodLabel(value) }))}
            />
          </div>

          {selected ? (
            <PayrollPreviewModal open={open} entry={selected} onClose={onClose} />
          ) : (
            <p className="rounded-2xl border border-line bg-surface-soft px-4 py-6 text-center text-sm text-ink-low">
              {t('payrolls.noEntriesForSelection')}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        danger
        loading={deleteMutation.isPending}
        title={t('payrolls.deleteTitle')}
        body={
          selected
            ? t('payrolls.deleteBody', {
                name: selected.employeeName,
                type: t(`payrolls.types.${selected.type}`),
                period: periodLabel(selected.period)
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}
