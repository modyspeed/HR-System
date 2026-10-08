import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Trash2,
  Upload
} from 'lucide-react'
import type { LeaveFilePreview, LeaveRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn, formatDate, formatFileSize } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { leaveStatusTone, leaveTypeTone } from './leaveMeta'

interface LeaveDetailsModalProps {
  open: boolean
  leave: LeaveRecord | null
  onClose: () => void
  /** Called after attach/remove so the list refetches. */
  onChanged: () => void
  onEdit: () => void
}

const ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.csv,.png,.jpg,.jpeg,.webp,.gif,.bmp'

function extensionOf(name: string | null): string {
  if (!name) return ''
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

/** Living copy of the record so file attach/remove can refresh it locally. */
export function LeaveDetailsModal({
  open,
  leave,
  onClose,
  onChanged,
  onEdit
}: LeaveDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const canEdit = usePermission('leaves.edit')
  const canDelete = usePermission('leaves.delete')

  const [current, setCurrent] = useState<LeaveRecord | null>(leave)
  const inputRef = useRef<HTMLInputElement>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [preview, setPreview] = useState<LeaveFilePreview | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    setCurrent(leave)
    setPreview(null)
    setError(null)
    setBlobUrl(null)
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [open, leave])

  const leaveId = current?.id ?? null
  const hasFile = Boolean(current?.fileOriginalName)
  const ext = extensionOf(current?.fileOriginalName ?? null)

  // load the preview whenever the modal opens or the file changes
  useEffect(() => {
    if (!open || !leaveId || !hasFile) return

    let cancelled = false
    setLoading(true)
    setError(null)

    api.leaves
      .previewFile(leaveId)
      .then((result) => {
        if (cancelled) return
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
          blobUrlRef.current = null
        }
        setBlobUrl(null)
        if ((result.kind === 'pdf' || result.kind === 'image') && result.data) {
          const bytes = new Uint8Array(result.data)
          const mime = result.kind === 'pdf' ? 'application/pdf' : (result.mime ?? 'application/octet-stream')
          const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
          blobUrlRef.current = url
          setBlobUrl(url)
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
  }, [open, leaveId, hasFile, refreshToken])

  useEffect(
    () => () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    },
    []
  )

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!leaveId) throw new Error('No leave')
      const data = await file.arrayBuffer()
      return api.leaves.attachFile({ id: leaveId, data, fileName: file.name })
    },
    onSuccess: (fresh) => {
      toast.success(t('leaves.file.uploaded'))
      setCurrent(fresh)
      onChanged()
      setRefreshToken((token) => token + 1)
    },
    onError: (err) => {
      toast.error(t('leaves.file.uploadFailed'), { description: resolveApiError(err) })
    }
  })

  const removeMutation = useMutation({
    mutationFn: () => {
      if (!leaveId) throw new Error('No leave')
      return api.leaves.removeFile(leaveId)
    },
    onSuccess: (fresh) => {
      toast.success(t('leaves.file.removed'))
      setConfirmRemove(false)
      setPreview(null)
      setBlobUrl(null)
      setCurrent(fresh)
      onChanged()
    },
    onError: (err) => {
      setConfirmRemove(false)
      toast.error(t('toasts.error'), { description: resolveApiError(err) })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!leaveId) throw new Error('No leave')
      return api.leaves.remove(leaveId)
    },
    onSuccess: () => {
      toast.success(t('toasts.leaveDeleted'))
      setConfirmDelete(false)
      onClose()
      onChanged()
    },
    onError: (err) => {
      setConfirmDelete(false)
      toast.error(t('toasts.error'), { description: resolveApiError(err) })
    }
  })

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) uploadMutation.mutate(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const skeleton = <div className="h-[42vh] w-full animate-pulse rounded-2xl bg-surface-soft" />
  const isPdf = preview?.kind === 'pdf'
  const isImage = preview?.kind === 'image'
  const isTable = preview?.kind === 'table'

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <span>{t('leaves.detailsTitle')}</span>
            {current && (
              <Badge tone={leaveTypeTone(current.type)}>{t(`leaves.types.${current.type}`)}</Badge>
            )}
          </span>
        }
        description={current ? `${current.employeeName} — ${current.employeeCode}` : undefined}
        size="xl"
        footer={
          <>
            <SoftButton
              variant="subtle"
              icon={<FolderOpen className="size-4" />}
              onClick={() => void api.leaves.revealFilesDir()}
            >
              {t('leaves.file.openFolder')}
            </SoftButton>
            {hasFile && canEdit && (
              <SoftButton
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConfirmRemove(true)}
              >
                {t('leaves.file.remove')}
              </SoftButton>
            )}
            {canEdit && (
              <SoftButton
                variant={hasFile ? 'ghost' : 'primary'}
                icon={<Upload className="size-4" />}
                loading={uploadMutation.isPending}
                onClick={() => inputRef.current?.click()}
              >
                {hasFile ? t('leaves.file.replace') : t('leaves.file.attach')}
              </SoftButton>
            )}
            {canEdit && (
              <SoftButton
                variant="ghost"
                icon={<Pencil className="size-4" />}
                onClick={() => {
                  onClose()
                  onEdit()
                }}
              >
                {t('common.edit')}
              </SoftButton>
            )}
            {canDelete && (
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
        {current && (
          <div className="py-2">
            {/* -- record summary -- */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
                <p className="text-[11px] text-ink-low">{t('leaves.period')}</p>
                <p dir="ltr" className="mt-1 text-right font-mono text-xs font-semibold text-ink-high">
                  {current.startDate} → {current.endDate}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
                <p className="text-[11px] text-ink-low">{t('leaves.daysCount')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-ink-high">
                  {current.daysCount}
                  <span className="ms-1 text-[11px] font-medium text-ink-low">
                    {t('leaves.dayUnit')}
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
                <p className="text-[11px] text-ink-low">{t('leaves.year')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-ink-high">{current.year}</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
                <p className="text-[11px] text-ink-low">{t('leaves.status')}</p>
                <div className="mt-1.5">
                  <Badge tone={leaveStatusTone(current.status)} dot>
                    {t(`leaves.statuses.${current.status}`)}
                  </Badge>
                </div>
              </div>
            </div>

            {current.reason && (
              <div className="mt-3 rounded-2xl border border-line bg-surface-soft px-4 py-3">
                <p className="text-[11px] text-ink-low">{t('leaves.reason')}</p>
                <p dir="auto" className="mt-1 text-sm leading-relaxed text-ink-med">
                  {current.reason}
                </p>
              </div>
            )}

            {/* -- supporting document -- */}
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-ink-med">{t('leaves.file.title')}</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />

              {!hasFile ? (
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
                    dragging
                      ? 'border-accent-400 bg-accent-500/10'
                      : 'border-line-strong bg-surface-soft hover:border-accent-400/60'
                  )}
                >
                  <span className="grid size-12 place-items-center rounded-full bg-surface-strong text-accent-300 shadow-[var(--shadow-raised),var(--shadow-rim)]">
                    <ImageIcon className="size-5" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-ink-high">
                      {t('leaves.file.none')}
                    </span>
                    <span className="max-w-md text-xs leading-relaxed text-ink-low">
                      {t('leaves.file.noneBody')}
                    </span>
                  </span>
                  <span className="rounded-full bg-surface-strong px-3 py-1 text-[11px] text-ink-low">
                    {t('leaves.file.formats')}
                  </span>
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-4 rounded-2xl bg-surface-soft p-4 shadow-[var(--shadow-inset)]">
                    <span
                      className={cn(
                        'grid size-12 shrink-0 place-items-center rounded-xl border',
                        isPdf
                          ? 'border-rose-400/25 bg-rose-500/10 text-rose-400'
                          : isImage
                            ? 'border-violet-400/25 bg-violet-500/10 text-violet-400'
                            : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-400'
                      )}
                    >
                      <ImageIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-high" dir="auto">
                        {current.fileOriginalName}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-low">
                        <span className="rounded bg-surface-strong px-1.5 py-0.5 font-mono uppercase">
                          {ext.replace('.', '')}
                        </span>
                        <span>{formatFileSize(current.fileSize ?? null)}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {t('leaves.file.linkedAt')}: {formatDate(current.fileLinkedAt ?? null, language)}
                        </span>
                      </p>
                    </div>
                    {loading && <Loader2 className="size-4 shrink-0 animate-spin text-accent-300" />}
                  </div>

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
                    ) : isPdf ? (
                      blobUrl ? (
                        <iframe
                          title={t('leaves.file.preview')}
                          src={blobUrl}
                          className="h-[52vh] w-full rounded-2xl border border-line bg-white shadow-[var(--shadow-raised)]"
                        />
                      ) : (
                        skeleton
                      )
                    ) : isImage ? (
                      blobUrl ? (
                        <div className="rounded-2xl border border-line bg-white p-3 shadow-[var(--shadow-raised)]">
                          <img
                            src={blobUrl}
                            alt={t('leaves.file.preview')}
                            className="mx-auto max-h-[52vh] rounded-xl object-contain"
                          />
                        </div>
                      ) : (
                        skeleton
                      )
                    ) : isTable ? (
                      <div className="rounded-2xl border border-line">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-soft px-4 py-2.5 text-[11px] text-ink-low">
                          <span dir="auto" className="font-medium">
                            {t('leaves.file.sheet', {
                              name: preview.sheetName ?? '—',
                              count: preview.totalRows ?? 0
                            })}
                          </span>
                          {preview.truncated && (
                            <span className="text-amber-300">
                              {t('leaves.file.truncated', { count: preview.rows?.length ?? 0 })}
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
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRemove}
        danger
        loading={removeMutation.isPending}
        title={t('leaves.file.removeTitle')}
        body={t('leaves.file.removeBody', { name: current?.fileOriginalName ?? '' })}
        confirmLabel={t('leaves.file.remove')}
        onConfirm={() => removeMutation.mutate()}
        onClose={() => setConfirmRemove(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        danger
        loading={deleteMutation.isPending}
        title={t('leaves.confirmDeleteTitle')}
        body={
          current
            ? t('leaves.confirmDeleteBody', {
                name: current.employeeName,
                type: t(`leaves.types.${current.type}`)
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
