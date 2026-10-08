import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Trash2,
  Upload
} from 'lucide-react'
import type { EmployeeFilePreview, EmployeeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn, formatDate, formatFileSize } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface EmployeeFileModalProps {
  open: boolean
  employee: EmployeeRecord | null
  onClose: () => void
  /** Called after attach/remove so the list can refetch. */
  onChanged: () => void
}

const ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.csv'

function extensionOf(name: string | null): string {
  if (!name) return ''
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

export function EmployeeFileModal({ open, employee, onClose, onChanged }: EmployeeFileModalProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const canEdit = usePermission('employees.edit')

  const inputRef = useRef<HTMLInputElement>(null)
  const pdfUrlRef = useRef<string | null>(null)

  const [preview, setPreview] = useState<EmployeeFilePreview | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [dragging, setDragging] = useState(false)

  const employeeId = employee?.id ?? null
  const hasFile = Boolean(employee?.fileOriginalName)
  const ext = extensionOf(employee?.fileOriginalName ?? null)
  const isPdf = ext === '.pdf'

  // load (or reload) the preview whenever the modal opens or the file changes
  useEffect(() => {
    if (!open || !employeeId || !hasFile) return

    let cancelled = false
    setLoading(true)
    setError(null)

    api.employees
      .previewFile(employeeId)
      .then((result) => {
        if (cancelled) return
        if (pdfUrlRef.current) {
          URL.revokeObjectURL(pdfUrlRef.current)
          pdfUrlRef.current = null
        }
        setPdfUrl(null)
        if (result.kind === 'pdf' && result.data) {
          // fresh ArrayBuffer-backed copy so the blob is strictly typed
          const bytes = new Uint8Array(result.data)
          const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
          pdfUrlRef.current = url
          setPdfUrl(url)
        }
        setPreview(result)
      })
      .catch((err) => {
        if (cancelled) return
        setPreview(null)
        setError(resolveApiError(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, employeeId, hasFile, refreshToken])

  // release the blob URL on unmount
  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
    },
    []
  )

  const clearPreview = () => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = null
    }
    setPdfUrl(null)
    setPreview(null)
    setError(null)
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!employeeId) throw new Error('No employee')
      const data = await file.arrayBuffer()
      return api.employees.attachFile({ id: employeeId, data, fileName: file.name })
    },
    onSuccess: () => {
      toast.success(t('employees.file.uploaded'))
      onChanged()
      setRefreshToken((token) => token + 1)
    },
    onError: (err) => {
      toast.error(t('employees.file.uploadFailed'), { description: resolveApiError(err) })
    }
  })

  const removeMutation = useMutation({
    mutationFn: () => {
      if (!employeeId) throw new Error('No employee')
      return api.employees.removeFile(employeeId)
    },
    onSuccess: () => {
      toast.success(t('employees.file.removed'))
      setConfirmRemove(false)
      clearPreview()
      onChanged()
    },
    onError: (err) => {
      setConfirmRemove(false)
      toast.error(t('toasts.error'), { description: resolveApiError(err) })
    }
  })

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) uploadMutation.mutate(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const skeleton = <div className="h-[46vh] w-full animate-pulse rounded-2xl bg-surface-soft" />

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <span>{t('employees.file.title')}</span>
            {hasFile && (
              <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[10px] font-medium text-accent-300">
                {ext.replace('.', '').toUpperCase()}
              </span>
            )}
          </span>
        }
        description={
          employee ? `${employee.name} — ${employee.code}` : undefined
        }
        size="xl"
        footer={
          <>
            <SoftButton
              variant="subtle"
              icon={<FolderOpen className="size-4" />}
              onClick={() => void api.employees.revealFilesDir()}
            >
              {t('employees.file.openFolder')}
            </SoftButton>
            {hasFile && canEdit && (
              <SoftButton
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConfirmRemove(true)}
              >
                {t('employees.file.remove')}
              </SoftButton>
            )}
            {canEdit && (
              <SoftButton
                variant={hasFile ? 'ghost' : 'primary'}
                icon={<Upload className="size-4" />}
                loading={uploadMutation.isPending}
                onClick={() => inputRef.current?.click()}
              >
                {hasFile ? t('employees.file.replace') : t('employees.file.attach')}
              </SoftButton>
            )}
            <SoftButton variant="subtle" onClick={onClose}>
              {t('common.close')}
            </SoftButton>
          </>
        }
      >
        <div className="py-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />

          {!hasFile ? (
            /* ---------- empty state: dropzone ---------- */
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
                'focus-ring flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center transition-colors',
                dragging
                  ? 'border-accent-400 bg-accent-500/10'
                  : 'border-line-strong bg-surface-soft hover:border-accent-400/60'
              )}
            >
              <span className="grid size-14 place-items-center rounded-full bg-surface-strong text-accent-300 shadow-[var(--shadow-raised),var(--shadow-rim)]">
                <FolderOpen className="size-6" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-ink-high">
                  {t('employees.file.none')}
                </span>
                <span className="max-w-md text-xs leading-relaxed text-ink-low">
                  {t('employees.file.noneBody')}
                </span>
              </span>
              <span className="rounded-full bg-surface-strong px-3 py-1 text-[11px] text-ink-low">
                {t('employees.file.formats')}
              </span>
            </button>
          ) : (
            <>
              {/* ---------- file info card ---------- */}
              <div className="flex items-center gap-4 rounded-2xl bg-surface-soft p-4 shadow-[var(--shadow-inset)]">
                <span
                  className={cn(
                    'grid size-12 shrink-0 place-items-center rounded-xl border',
                    isPdf
                      ? 'border-rose-400/25 bg-rose-500/10 text-rose-400'
                      : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-400'
                  )}
                >
                  {isPdf ? (
                    <FileText className="size-5" />
                  ) : (
                    <FileSpreadsheet className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-high" dir="auto">
                    {employee?.fileOriginalName}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-low">
                    <span className="rounded bg-surface-strong px-1.5 py-0.5 font-mono uppercase">
                      {ext.replace('.', '')}
                    </span>
                    <span>{formatFileSize(employee?.fileSize ?? null)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {t('employees.file.linkedAt')}:{' '}
                      {formatDate(employee?.fileLinkedAt ?? null, language)}
                    </span>
                  </p>
                </div>
                {loading && (
                  <Loader2 className="size-4 shrink-0 animate-spin text-accent-300" />
                )}
              </div>

              {/* ---------- preview ---------- */}
              <div className="mt-4">
                {error ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3">
                    <span className="text-sm text-rose-400">{error}</span>
                    <SoftButton
                      variant="subtle"
                      size="sm"
                      onClick={() => setRefreshToken((token) => token + 1)}
                    >
                      {t('common.retry')}
                    </SoftButton>
                  </div>
                ) : preview?.kind === 'pdf' ? (
                  pdfUrl ? (
                    <iframe
                      title={t('employees.file.preview')}
                      src={pdfUrl}
                      className="h-[52vh] w-full rounded-2xl border border-line bg-white shadow-[var(--shadow-raised)]"
                    />
                  ) : (
                    skeleton
                  )
                ) : preview ? (
                  /* spreadsheet grid */
                  <div className="rounded-2xl border border-line">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-soft px-4 py-2.5 text-[11px] text-ink-low">
                      <span dir="auto" className="font-medium">
                        {t('employees.file.sheet', {
                          name: preview.sheetName ?? '—',
                          count: preview.totalRows ?? 0
                        })}
                      </span>
                      {preview.truncated && (
                        <span className="text-amber-300">
                          {t('employees.file.truncated', {
                            count: preview.rows?.length ?? 0
                          })}
                        </span>
                      )}
                    </div>
                    <div className="scroll-area max-h-[46vh] overflow-auto">
                      <table className="w-full border-collapse">
                        <tbody>
                          {preview.rows?.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className={cn(
                                'border-b border-surface-base last:border-0',
                                rowIndex % 2 === 1 && 'bg-surface-soft/50'
                              )}
                            >
                              <td className="sticky start-0 w-10 bg-surface-strong px-2 py-1.5 text-center text-[10px] font-medium text-ink-low">
                                {rowIndex + 1}
                              </td>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  dir="auto"
                                  className="whitespace-nowrap px-3 py-1.5 text-xs text-ink-med"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  skeleton
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRemove}
        danger
        loading={removeMutation.isPending}
        title={t('employees.file.removeTitle')}
        body={t('employees.file.removeBody', { name: employee?.fileOriginalName ?? '' })}
        confirmLabel={t('employees.file.remove')}
        onConfirm={() => removeMutation.mutate()}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  )
}
