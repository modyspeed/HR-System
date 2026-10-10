import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { EmployeeFilePreview, SalaryGradeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { SalaryGradeFormDialog } from './SalaryGradeFormDialog'

interface SalaryGradeTimelineProps {
  employeeId: string
  onChanged?: () => void
}

const ACCEPT = '.pdf,.xlsx,.xls,.csv'

/** معاينة مستند التدرج (PDF أو جدول Excel) داخل نافذة صغيرة. */
function GradeFilePreviewDialog({
  open,
  grade,
  onClose
}: {
  open: boolean
  grade: SalaryGradeRecord | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const previewQuery = useQuery({
    queryKey: ['payrolls', 'salaryGrades', 'preview', grade?.id],
    queryFn: () => api.payrolls.salaryGrades.previewFile(grade!.id),
    enabled: open && grade !== null,
    staleTime: 60_000
  })

  useEffect(() => {
    if (!open) setPdfUrl(null)
    const preview = previewQuery.data
    if (!open || !preview || preview.kind !== 'pdf' || !preview.data) return
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(preview.data)], { type: 'application/pdf' })
    )
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [open, previewQuery.data])

  const preview: EmployeeFilePreview | null = previewQuery.data ?? null
  const failed = previewQuery.isError

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payrolls.gradeFilePreview')}
      description={grade?.fileOriginalName ?? undefined}
      size="lg"
      footer={
        <SoftButton variant="subtle" onClick={onClose}>
          {t('common.close')}
        </SoftButton>
      }
    >
      <div className="py-2">
        {failed ? (
          <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {t('toasts.error')}
          </p>
        ) : previewQuery.isLoading && !pdfUrl ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-accent-300" />
          </div>
        ) : preview?.kind === 'pdf' && pdfUrl ? (
          <iframe src={pdfUrl} className="h-[46vh] w-full rounded-2xl border border-line bg-white shadow-[var(--shadow-raised)]" />
        ) : preview?.kind === 'table' ? (
          <div className="rounded-2xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-soft px-4 py-2.5 text-[11px] text-ink-low">
              <span dir="auto">
                {t('payrolls.gradeSheet', { name: preview.sheetName ?? '—', count: preview.totalRows ?? 0 })}
              </span>
              {preview.truncated && <span className="text-amber-300">{t('payrolls.gradeTruncated')}</span>}
            </div>
            <div className="scroll-area max-h-[42vh] overflow-auto">
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
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

/**
 * تدرج الأساسي حسب التاريخ: سجل لكل قيمة أساسي مع تاريخ سريانها وملاحظات
 * ومستند استحقاق اختياري (PDF/Excel) — إضافة/تعديل/حذف مباشرة.
 */
export function SalaryGradeTimeline({ employeeId, onChanged }: SalaryGradeTimelineProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const queryClient = useQueryClient()
  const canCreate = usePermission('payrolls.create')
  const canEdit = usePermission('payrolls.edit')
  const canDelete = usePermission('payrolls.delete')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryGradeRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SalaryGradeRecord | null>(null)
  const [previewing, setPreviewing] = useState<SalaryGradeRecord | null>(null)

  const gradesQuery = useQuery({
    queryKey: ['payrolls', 'salaryGrades', employeeId],
    queryFn: () => api.payrolls.salaryGrades.listByEmployee(employeeId),
    enabled: Boolean(employeeId)
  })
  const grades = useMemo(() => gradesQuery.data ?? [], [gradesQuery.data])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['payrolls', 'salaryGrades'] })
    onChanged?.()
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.payrolls.salaryGrades.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.salaryGradeDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const attachMutation = useMutation({
    mutationFn: async ({ grade, file }: { grade: SalaryGradeRecord; file: File }) => ({
      grade: await api.payrolls.salaryGrades.attachFile({
        id: grade.id,
        data: await file.arrayBuffer(),
        fileName: file.name
      })
    }),
    onSuccess: ({ grade }) => {
      toast.success(t('toasts.salaryGradeFileAttached'))
      void queryClient.invalidateQueries({ queryKey: ['payrolls', 'salaryGrades'] })
      onChanged?.()
      // فتح المعاينة مباشرة بعد الربط عند توفر الصلاحية
      setPreviewing(grade)
    },
    onError: (error) => {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const removeFileMutation = useMutation({
    mutationFn: (id: string) => api.payrolls.salaryGrades.removeFile(id),
    onSuccess: () => {
      toast.success(t('toasts.salaryGradeFileRemoved'))
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const handleFile = (grade: SalaryGradeRecord, file: File | undefined) => {
    if (file) attachMutation.mutate({ grade, file })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-high">
          {t('payrolls.gradeTitle')}
          <span className="ms-2 text-[11px] font-normal text-ink-low">
            {t('payrolls.gradeCount', { count: grades.length })}
          </span>
        </p>
        {canCreate && (
          <SoftButton
            variant="ghost"
            icon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t('payrolls.gradeAdd')}
          </SoftButton>
        )}
      </div>

      {gradesQuery.isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-accent-300" />
        </div>
      ) : grades.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title={t('payrolls.gradeEmpty')}
          body={t('payrolls.gradeEmptyBody')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {grades.map((grade) => {
            const hasFile = Boolean(grade.fileOriginalName)
            return (
              <li
                key={grade.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-soft/60 px-4 py-2.5"
              >
                <span className="rounded-full bg-surface-strong px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                  {formatDate(grade.date, language)}
                </span>
                <span dir="ltr" className="font-mono text-sm font-bold tabular-nums text-accent-300">
                  {formatMoney(grade.amount)}
                </span>
                {grade.note && (
                  <span dir="auto" className="min-w-0 flex-1 truncate text-xs text-ink-med">
                    {grade.note}
                  </span>
                )}
                {hasFile && (
                  <button
                    type="button"
                    title={t('payrolls.gradeFilePreview')}
                    onClick={() => setPreviewing(grade)}
                    className="focus-ring flex items-center gap-1 rounded-full bg-surface-strong px-2.5 py-1 text-[10px] text-teal-400 transition-colors hover:bg-surface-base"
                  >
                    <Paperclip className="size-3" />
                    <span dir="auto" className="max-w-[140px] truncate">
                      {grade.fileOriginalName}
                    </span>
                  </button>
                )}
                <div className="ms-auto flex items-center gap-1">
                  {canEdit && (
                    <label
                      title={hasFile ? t('payrolls.gradeFileReplace') : t('payrolls.gradeFileAttach')}
                      className="cursor-pointer"
                    >
                      <span className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300">
                        <Paperclip className="size-4" />
                      </span>
                      <input
                        type="file"
                        accept={ACCEPT}
                        className="hidden"
                        onChange={(event) => {
                          handleFile(grade, event.target.files?.[0])
                          event.target.value = ''
                        }}
                      />
                    </label>
                  )}
                  {hasFile && canEdit && (
                    <button
                      type="button"
                      title={t('payrolls.gradeFileRemove')}
                      onClick={() => removeFileMutation.mutate(grade.id)}
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
                        setEditing(grade)
                        setFormOpen(true)
                      }}
                      className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                    >
                      <Pencil className="size-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      title={t('common.delete')}
                      onClick={() => setConfirmDelete(grade)}
                      className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <SalaryGradeFormDialog
        open={formOpen}
        employeeId={employeeId}
        grade={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />

      <GradeFilePreviewDialog
        open={previewing !== null}
        grade={previewing}
        onClose={() => setPreviewing(null)}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('payrolls.gradeDeleteTitle')}
        body={
          confirmDelete
            ? t('payrolls.gradeDeleteBody', { amount: formatMoney(confirmDelete.amount) })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
