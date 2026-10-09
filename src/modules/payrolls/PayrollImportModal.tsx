import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { PayrollParseResult } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn, formatMoney } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { Badge } from '@/components/ui/Badge'
import { MatchBadge } from './PayrollPreviewModal'
import { periodLabel, payrollTypeTone } from './payrollMeta'

interface PayrollImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

/**
 * رفع كشف المرتبات PDF: فحص → معاينة الأظرف المستخرجة (المطابق/غير المطابق)
 * → تأكيد التوزيع على الموظفين. رفع نفس الشهر/النوع يستبدل النسخة السابقة.
 */
export function PayrollImportModal({ open, onClose, onImported }: PayrollImportModalProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ data: ArrayBuffer; fileName: string } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!open) {
      setPending(null)
    }
  }, [open])

  const readFile = async (file: File) => {
    const data = await file.arrayBuffer()
    setPending({ data, fileName: file.name })
    parseMutation.mutate({ data, fileName: file.name })
  }

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void readFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const parseMutation = useMutation({
    mutationFn: (payload: { data: ArrayBuffer; fileName: string }) => api.payrolls.parsePdf(payload)
  })

  const importMutation = useMutation({
    mutationFn: () => api.payrolls.importPdf(pending!),
    onSuccess: (summary) => {
      toast.success(t('toasts.payrollImported', { count: summary.created }))
      onImported()
    },
    onError: (error) => {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const result: PayrollParseResult | null = parseMutation.data ?? null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payrolls.importTitle')}
      description={t('payrolls.importHint')}
      size="xl"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={parseMutation.isPending || importMutation.isPending}>
            {t('common.cancel')}
          </SoftButton>
          {result && (
            <SoftButton
              variant="primary"
              icon={<Upload className="size-4" />}
              loading={importMutation.isPending}
              disabled={result.matched === 0}
              onClick={() => importMutation.mutate()}
            >
              {t('payrolls.confirmImport', { count: result.matched })}
            </SoftButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            handleFiles(event.dataTransfer.files)
          }}
          className={cn(
            'focus-ring flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-accent-400 bg-accent-500/10' : 'border-line-strong bg-surface-soft hover:border-accent-400/60',
            pending && 'pointer-events-none opacity-80'
          )}
        >
          {parseMutation.isPending ? (
            <Loader2 className="size-7 animate-spin text-accent-300" />
          ) : (
            <FileUp className="size-7 text-accent-300" />
          )}
          <span className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink-high">
              {pending ? t('payrolls.parsing') : t('payrolls.dropZone')}
            </span>
            <span className="max-w-md text-xs leading-relaxed text-ink-low">{t('payrolls.dropZoneBody')}</span>
          </span>
          {!pending && (
            <span className="rounded-full bg-surface-strong px-3 py-1 text-[11px] text-ink-low">PDF — {t('payrolls.pdfOnly')}</span>
          )}
        </button>

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={payrollTypeTone(result.type)}>{t(`payrolls.types.${result.type}`)}</Badge>
              <span className="rounded-full bg-surface-strong px-2.5 py-1 text-xs font-semibold tabular-nums">
                {periodLabel(result.period)}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-teal-400">
                <CheckCircle2 className="size-3.5" />
                {t('payrolls.matched', { count: result.matched })}
              </span>
              {result.unmatched > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-rose-400">
                  <AlertTriangle className="size-3.5" />
                  {t('payrolls.unmatched', { count: result.unmatched })}
                </span>
              )}
              <span className="ms-auto text-[11px] text-ink-low">
                {t('payrolls.slipsInFile', { count: result.pageCount, found: result.rows.length })}
              </span>
            </div>

            {result.matched === 0 && (
              <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-400">
                {t('payrolls.noMatchBody')}
              </p>
            )}

            <div className="scroll-area max-h-[46vh] overflow-auto rounded-2xl border border-line">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="sticky top-0 z-10 bg-surface-strong">
                  <tr className="text-[11px] uppercase tracking-wider text-ink-low">
                    <th className="px-4 py-2.5 text-start font-medium">{t('payrolls.page')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('payrolls.code')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('payrolls.name')}</th>
                    <th className="px-4 py-2.5 text-center font-medium">{t('payrolls.matchTitle')}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t('payrolls.basic')}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t('payrolls.net')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-base">
                  {result.rows.slice(0, 600).map((row) => (
                    <tr key={row.page} className={cn('text-xs', row.match === 'none' && 'bg-rose-500/5')}>
                      <td className="px-4 py-2 font-mono tabular-nums text-ink-low">{row.page}</td>
                      <td className="px-4 py-2 font-mono text-ink-med">{row.code || '—'}</td>
                      <td dir="auto" className="max-w-[260px] truncate px-4 py-2 text-ink-high">
                        {row.name || '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <MatchBadge match={row.match} />
                      </td>
                      <td className="px-4 py-2 text-end font-mono tabular-nums text-ink-med">
                        {formatMoney(row.basicSalary)}
                      </td>
                      <td className="px-4 py-2 text-end font-mono font-semibold tabular-nums text-accent-300">
                        {formatMoney(row.netSalary)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
