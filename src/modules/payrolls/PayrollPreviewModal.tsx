import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Eye, Loader2 } from 'lucide-react'
import type { PayrollRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { cn, formatMoney } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { payrollTypeTone, periodLabel } from './payrollMeta'

interface PayrollPreviewModalProps {
  open: boolean
  entry: PayrollRecord | null
  onClose?: () => void
}

/** غلاف نافذة منبثقة يعرض ظرف الموظف — يفتح فوق القوائم أو ملف الموظف. */
export function PayrollPreviewDialog({
  open,
  entry,
  onClose
}: {
  open: boolean
  entry: PayrollRecord | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payrolls.preview')}
      description={
        entry
          ? `${entry.employeeName} — ${entry.employeeCode} · ${periodLabel(entry.period)} · ${t(`payrolls.types.${entry.type}`)}`
          : undefined
      }
      size="xl"
      footer={
        <SoftButton variant="subtle" onClick={onClose}>
          {t('common.close')}
        </SoftButton>
      }
    >
      {entry && <PayrollPreviewModal open={open} entry={entry} onClose={onClose} />}
    </Modal>
  )
}

/**
 * ظرف الموظف: يعرض صفحة الكشف الأصلية (PDF بصفحة واحدة) بجانب الأرقام
 * المستخرجة (أساسي / استحقاقات / استقطاعات / صافي).
 */
export function PayrollPreviewModal({ open, entry, onClose: _onClose }: PayrollPreviewModalProps) {
  const { t } = useTranslation()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const previewQuery = useQuery({
    queryKey: ['payrolls', 'preview', entry?.id],
    queryFn: () => api.payrolls.previewEntry(entry!.id),
    enabled: open && entry !== null,
    staleTime: 60_000
  })

  useEffect(() => {
    if (!open) setPdfUrl(null)
    if (!open || !previewQuery.data) return
    const bytes = new Uint8Array(previewQuery.data.data)
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [open, previewQuery.data])

  const numbers = entry
    ? [
        { key: 'basic', label: t('payrolls.basic'), value: formatMoney(entry.basicSalary) },
        { key: 'earned', label: t('payrolls.totalEarned'), value: formatMoney(entry.totalEarned) },
        { key: 'deductions', label: t('payrolls.deductions'), value: formatMoney(entry.totalDeductions) },
        { key: 'net', label: t('payrolls.net'), value: formatMoney(entry.netSalary) }
      ]
    : []

  const loading = previewQuery.isLoading || previewQuery.isFetching
  const failed = previewQuery.isError

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numbers.map((item) => (
          <div
            key={item.key}
            className={cn(
              'rounded-2xl border border-line bg-surface-soft px-4 py-3',
              item.key === 'net' && 'border-accent-500/40 bg-accent-500/10'
            )}
          >
            <p className="text-[11px] text-ink-low">{item.label}</p>
            <p
              dir="ltr"
              className={cn(
                'mt-1 truncate text-start font-mono text-base font-bold tabular-nums',
                item.key === 'net' ? 'text-accent-300' : 'text-ink-high'
              )}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {entry?.fileName && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-low">
          <span className="text-ink-med">{t('payrolls.document')}:</span>
          <span dir="auto" className="truncate">
            {entry.fileName}
          </span>
        </p>
      )}

      <div className="mt-4">
        {failed ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {t('toasts.error')}
          </div>
        ) : loading && !pdfUrl ? (
          <div className="flex h-[46vh] items-center justify-center rounded-2xl bg-surface-soft">
            <Loader2 className="size-5 animate-spin text-accent-300" />
          </div>
        ) : pdfUrl ? (
          <iframe
            title="payroll-slip"
            src={pdfUrl}
            className="h-[52vh] w-full rounded-2xl border border-line bg-white shadow-[var(--shadow-raised)]"
          />
        ) : null}
      </div>
    </div>
  )
}

/** شارة التوافق: بالكود / بالاسم / غير مطابق. */
export function MatchBadge({ match }: { match: 'code' | 'name' | 'none' }) {
  const { t } = useTranslation()
  if (match === 'code') return <Badge tone="teal">{t('payrolls.matchCode')}</Badge>
  if (match === 'name') return <Badge tone="gold">{t('payrolls.matchName')}</Badge>
  return <Badge tone="rose">{t('payrolls.matchNone')}</Badge>
}

/** زر معاينة ظرف موظف. */
export function PreviewButton({ entry: _entry, onOpen }: { entry: PayrollRecord; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      title={t('payrolls.preview')}
      onClick={onOpen}
      className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
    >
      <Eye className="size-4" />
    </button>
  )
}

export { periodLabel, payrollTypeTone }
export default PayrollPreviewModal
