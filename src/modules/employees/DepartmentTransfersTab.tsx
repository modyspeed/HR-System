import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, Paperclip, Pencil, Plus, ShieldAlert, Shuffle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DepartmentTransferRecord, EmployeeFilePreview, ExportPayload } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn, formatDate } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { SoftButton } from '@/components/ui/SoftButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ExportMenu } from '@/components/ui/ExportMenu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/feedback/EmptyState'
import { TransferFormDialog } from './TransferFormDialog'

interface DepartmentTransfersTabProps {
  employeeId: string
  employeeCode?: string
  employeeName?: string
  currentDepartmentName?: string | null
  onChanged?: () => void
}

const ACCEPT = '.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.gif,.bmp'

/** معاينة قرار النقل (PDF أو صورة أو جدول Excel). */
function TransferDecisionPreviewDialog({
  open,
  transfer,
  onClose
}: {
  open: boolean
  transfer: DepartmentTransferRecord | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const previewQuery = useQuery({
    queryKey: ['employees', 'transfers', 'decision', transfer?.id],
    queryFn: () => api.employees.departmentTransfers.previewDecision(transfer!.id),
    enabled: open && transfer !== null,
    staleTime: 60_000
  })

  useEffect(() => {
    if (!open) setPdfUrl(null)
    const preview = previewQuery.data
    if (!open || !preview || preview.kind !== 'pdf' || !preview.data) return
    const url = URL.createObjectURL(new Blob([new Uint8Array(preview.data)], { type: 'application/pdf' }))
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [open, previewQuery.data])

  const preview: EmployeeFilePreview | null = previewQuery.data ?? null
  const imageUrl =
    preview?.kind === 'image' && preview.data && preview.mime
      ? URL.createObjectURL(new Blob([new Uint8Array(preview.data)], { type: preview.mime }))
      : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('employees.transferDecisionPreview')}
      description={transfer?.decisionOriginalName ?? undefined}
      size="lg"
      footer={
        <SoftButton variant="subtle" onClick={onClose}>
          {t('common.close')}
        </SoftButton>
      }
    >
      <div className="py-2">
        {previewQuery.isError ? (
          <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {t('toasts.error')}
          </p>
        ) : previewQuery.isLoading && !pdfUrl ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-accent-300" />
          </div>
        ) : preview?.kind === 'pdf' && pdfUrl ? (
          <iframe src={pdfUrl} className="h-[46vh] w-full rounded-2xl border border-line bg-white shadow-[var(--shadow-raised)]" />
        ) : preview?.kind === 'image' && imageUrl ? (
          <div className="rounded-2xl border border-line bg-white p-3">
            <img src={imageUrl} alt={t('employees.transferDecisionPreview')} className="mx-auto max-h-[46vh] rounded-xl object-contain" />
          </div>
        ) : preview?.kind === 'table' ? (
          <div className="scroll-area max-h-[46vh] overflow-auto rounded-2xl border border-line">
            <table className="w-full border-collapse">
              <tbody>
                {preview.rows?.map((row, rowIndex) => (
                  <tr key={rowIndex} className={cn('border-b border-surface-base last:border-0', rowIndex % 2 === 1 && 'bg-surface-soft/50')}>
                    <td className="sticky start-0 w-10 bg-surface-strong px-2 py-1.5 text-center text-[10px] text-ink-low">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} dir="auto" className="whitespace-nowrap px-3 py-1.5 text-xs text-ink-med">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

/**
 * التنقلات بين الأقسام: سجل تاريخي (من → إلى، الفترة، ملاحظة، قرار موثق)
 * + القسم الحالي وفق آخر كشف مرت�ن من الملف الكامل.
 */
export function DepartmentTransfersTab({
  employeeId,
  employeeCode,
  employeeName,
  currentDepartmentName,
  onChanged
}: DepartmentTransfersTabProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const queryClient = useQueryClient()
  const canEdit = usePermission('employees.edit')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DepartmentTransferRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DepartmentTransferRecord | null>(null)
  const [previewing, setPreviewing] = useState<DepartmentTransferRecord | null>(null)

  const transfersQuery = useQuery({
    queryKey: ['employees', 'transfers', employeeId],
    queryFn: () => api.employees.departmentTransfers.listByEmployee(employeeId),
    enabled: Boolean(employeeId)
  })
  const transfers = useMemo(() => transfersQuery.data ?? [], [transfersQuery.data])

  // آخر قسم من كشوف المرتبات (أحدث دفعة تحمل قسمًا مستدلًا عليه).
  const payrollQuery = useQuery({
    queryKey: ['payrolls', 'byEmployee', employeeId],
    queryFn: () => api.payrolls.listByEmployee(employeeId),
    enabled: Boolean(employeeId)
  })
  const latestPayroll = useMemo(() => {
    const entries = payrollQuery.data ?? []
    return entries.find((entry) => entry.departmentName) ?? null
  }, [payrollQuery.data])

  /** تصدير/طباعة سجل التنقلات (PDF/Excel/Word/صورة/طباعة). */
  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (transfers.length === 0) return null
    return {
      scope: 'employees',
      fileName: `transfers-${employeeCode ?? employeeId.slice(-6)}-${new Date().toISOString().slice(0, 10)}`,
      title: t('employees.transferTitle'),
      subtitle: `${employeeCode ? `[${employeeCode}] ` : ''}${employeeName ?? ''}${
        employeeName ? ' — ' : ''
      }${t('export.count', { count: transfers.length })}`.trim(),
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'from', label: t('employees.transferFromDepartment'), width: 24 },
        { key: 'to', label: t('employees.transferToDepartment'), width: 24 },
        { key: 'fromDate', label: t('employees.transferFromDate'), width: 14, align: 'center' },
        { key: 'toDate', label: t('employees.transferToDate'), width: 14, align: 'center' },
        { key: 'note', label: t('employees.transferNote'), width: 36 },
        { key: 'decision', label: t('employees.transferDecision'), width: 18, align: 'center' }
      ],
      rows: transfers.map((transfer) => [
        transfer.fromDepartmentName ?? t('employees.transferNoFrom'),
        transfer.toDepartmentName ?? '—',
        formatDate(transfer.fromDate, language),
        transfer.toDate ? formatDate(transfer.toDate, language) : t('employees.transferToNow'),
        transfer.note ?? '',
        transfer.decisionOriginalName
          ? t('employees.transferDocumentedLabel')
          : t('employees.transferMissingDecision')
      ])
    }
  }, [transfers, t, i18n, language, employeeId, employeeCode, employeeName])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees', 'transfers'] })
    void queryClient.invalidateQueries({ queryKey: ['employees'] })
    onChanged?.()
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.employees.departmentTransfers.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.transferDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const attachDecisionMutation = useMutation({
    mutationFn: async ({ transfer, file }: { transfer: DepartmentTransferRecord; file: File }) => {
      const data = await file.arrayBuffer()
      return api.employees.departmentTransfers.attachDecision({ id: transfer.id, data, fileName: file.name })
    },
    onSuccess: () => {
      toast.success(t('toasts.transferDecisionAttached'))
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const removeDecisionMutation = useMutation({
    mutationFn: (id: string) => api.employees.departmentTransfers.removeDecision(id),
    onSuccess: () => {
      toast.success(t('toasts.transferDecisionRemoved'))
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  return (
    <div className="flex flex-col gap-4">
      {/* القسم الحالي وفق الكشوف */}
      {latestPayroll && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-teal-400" />
          <span className="text-xs text-ink-low">{t('employees.transferLatestPayroll')}:</span>
          <Badge tone="teal">{latestPayroll.departmentName}</Badge>
          <span className="text-[11px] text-ink-low">
            {t('payrolls.period')} {latestPayroll.year}/{String(latestPayroll.month).padStart(2, '0')}
          </span>
          {currentDepartmentName !== null && currentDepartmentName !== latestPayroll.departmentName && (
            <span className="w-full text-[11px] text-amber-300">
              {t('employees.transferMismatch', { current: currentDepartmentName ?? '—', latest: latestPayroll.departmentName })}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-high">
          {t('employees.transferTitle')}
          <span className="ms-2 text-[11px] font-normal text-ink-low">
            {t('employees.transferCount', { count: transfers.length })}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu payload={exportPayload} />
          {canEdit && (
            <SoftButton
              variant="ghost"
              icon={<Plus className="size-4" />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              {t('employees.transferAdd')}
            </SoftButton>
          )}
        </div>
      </div>

      {transfersQuery.isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-accent-300" />
        </div>
      ) : transfers.length === 0 ? (
        <EmptyState
          icon={<Shuffle className="size-6" />}
          title={t('employees.transferEmpty')}
          body={t('employees.transferEmptyBody')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {transfers.map((transfer) => {
            const hasDecision = Boolean(transfer.decisionOriginalName)
            return (
              <li key={transfer.id} className="rounded-2xl border border-line bg-surface-soft/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gold">{transfer.fromDepartmentName ?? t('employees.transferNoFrom')}</Badge>
                  <span className="text-ink-low" aria-hidden>
                    ←
                  </span>
                  <Badge tone="teal">{transfer.toDepartmentName ?? '—'}</Badge>
                  <span dir="ltr" className="font-mono text-[11px] text-ink-low">
                    {formatDate(transfer.fromDate, language)}
                    {transfer.toDate ? ` → ${formatDate(transfer.toDate, language)}` : ` → ${t('employees.transferToNow')}`}
                  </span>
                  {transfer.note && (
                    <span dir="auto" className="min-w-0 flex-1 truncate text-xs text-ink-med">
                      {transfer.note}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {hasDecision ? (
                    <button
                      type="button"
                      onClick={() => setPreviewing(transfer)}
                      className="focus-ring flex max-w-[260px] items-center gap-1.5 rounded-full bg-teal-400/10 px-2.5 py-1 text-[10px] font-medium text-teal-400 transition-colors hover:bg-teal-400/20"
                    >
                      <CheckCircle2 className="size-3 shrink-0" />
                      {t('employees.transferDocumented')}
                      <span dir="auto" className="truncate">
                        {transfer.decisionOriginalName}
                      </span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-300">
                      <ShieldAlert className="size-3" />
                      {t('employees.transferMissingDecision')}
                    </span>
                  )}

                  <span className="ms-auto flex items-center gap-1">
                    {canEdit && (
                      <label title={t('employees.transferAttachDecision')} className="cursor-pointer">
                        <span className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300">
                          <Paperclip className="size-4" />
                        </span>
                        <input
                          type="file"
                          accept={ACCEPT}
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) attachDecisionMutation.mutate({ transfer, file })
                            event.target.value = ''
                          }}
                        />
                      </label>
                    )}
                    {hasDecision && canEdit && (
                      <button
                        type="button"
                        title={t('employees.transferRemoveDecision')}
                        onClick={() => removeDecisionMutation.mutate(transfer.id)}
                        className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        title={t('common.edit')}
                        onClick={() => {
                          setEditing(transfer)
                          setFormOpen(true)
                        }}
                        className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        title={t('common.delete')}
                        onClick={() => setConfirmDelete(transfer)}
                        className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <TransferFormDialog
        open={formOpen}
        employeeId={employeeId}
        transfer={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />

      <TransferDecisionPreviewDialog
        open={previewing !== null}
        transfer={previewing}
        onClose={() => setPreviewing(null)}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('employees.transferDeleteTitle')}
        body={t('employees.transferDeleteBody')}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
