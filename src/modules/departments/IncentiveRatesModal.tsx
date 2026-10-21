import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDays, FileUp, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { IncentiveRateRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Badge } from '@/components/ui/Badge'
import {
  DataTable,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeadRow
} from '@/components/ui/DataTable'

interface IncentiveRatesModalProps {
  open: boolean
  /** قصر العرض على قسم (من قائمة الأقسام) أو فتح عام. */
  departmentId?: string | null
  onClose: () => void
}

function ratePercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

/**
 * نسب الحوافز للأقسام: سجل شهري (تاريخ كامل) لكل قسم، يُستورد مباشرة من ملف
 * «نسب الأقسام-الشهر.pdf» أو يدويًا، مع المستند المرفوع قابلًا للمعاينة.
 */
export function IncentiveRatesModal({ open, departmentId, onClose }: IncentiveRatesModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const canCreate = usePermission('payrolls.create')
  const canEdit = usePermission('payrolls.edit')
  const canDelete = usePermission('payrolls.delete')

  const [periodFilter, setPeriodFilter] = useState('')
  const [importFile, setImportFile] = useState<{ data: ArrayBuffer; fileName: string } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<IncentiveRateRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<IncentiveRateRecord | null>(null)
  const [previewing, setPreviewing] = useState<IncentiveRateRecord | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const rateInputRef = useRef<HTMLInputElement>(null)

  const ratesQuery = useQuery({
    queryKey: ['payrolls', 'incentiveRates', departmentId ?? 'all'],
    queryFn: () => api.payrolls.incentiveRates.list({ departmentId: departmentId ?? undefined }),
    enabled: open,
    staleTime: 30_000
  })
  const rates = useMemo(() => ratesQuery.data ?? [], [ratesQuery.data])

  const periods = useMemo(
    () => [...new Set(rates.map((rate) => rate.period))].sort((a, b) => (a < b ? 1 : -1)),
    [rates]
  )
  const visible = useMemo(
    () => (periodFilter ? rates.filter((rate) => rate.period === periodFilter) : rates),
    [rates, periodFilter]
  )

  useEffect(() => {
    if (!open) {
      setImportFile(null)
      setPreviewing(null)
      setPdfUrl(null)
      setPreviewError(null)
    }
  }, [open])

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['payrolls', 'incentiveRates'] })

  // ---------------- استيراد PDF ----------------
  const parseMutation = useMutation({
    mutationFn: (payload: { data: ArrayBuffer; fileName: string }) =>
      api.payrolls.incentiveRates.parsePdf(payload)
  })
  const importMutation = useMutation({
    mutationFn: () => api.payrolls.incentiveRates.importPdf(importFile!),
    onSuccess: (summary) => {
      toast.success(t('toasts.incentiveImported', { count: summary.created }))
      setImportFile(null)
      parseMutation.reset()
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const payload = { data: await file.arrayBuffer(), fileName: file.name }
    setImportFile(payload)
    parseMutation.mutate(payload)
  }

  // ---------------- إضافة / تعديل ----------------
  const [formValues, setFormValues] = useState({ departmentId: '', period: '', rate: '', note: '' })
  const openForm = (record: IncentiveRateRecord | null) => {
    setEditing(record)
    setFormValues({
      departmentId: record?.departmentId ?? departmentId ?? '',
      period: record?.period ?? '',
      rate: record ? String(record.rate) : '',
      note: record?.note ?? ''
    })
    setFormOpen(true)
  }
  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? api.payrolls.incentiveRates.update(editing.id, {
            departmentId: formValues.departmentId,
            period: formValues.period,
            rate: Number(formValues.rate),
            note: formValues.note || null
          })
        : api.payrolls.incentiveRates.create({
            departmentId: formValues.departmentId,
            period: formValues.period,
            rate: Number(formValues.rate),
            note: formValues.note || null
          }),
    onSuccess: () => {
      toast.success(editing ? t('toasts.incentiveUpdated') : t('toasts.incentiveCreated'))
      setFormOpen(false)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.payrolls.incentiveRates.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.incentiveDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  // ---------------- معاينة ----------------
  const loadPreview = async (record: IncentiveRateRecord) => {
    setPdfUrl(null)
    setPreviewError(null)
    setPreviewing(record)
    try {
      const result = await api.payrolls.incentiveRates.preview(record.id)
      if (!result) {
        setPreviewError(t('departments.incentiveNoDocument'))
        return
      }
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(result.data)], { type: 'application/pdf' })
      )
      setPdfUrl(url)
    } catch (error) {
      setPreviewError(resolveApiError(error))
    }
  }

  const departmentsQuery = useQuery({
    queryKey: ['departments', 'list', { search: undefined, isActive: null, sort: 'code', order: 'asc' }],
    queryFn: () => api.departments.list({}),
    enabled: open && (departmentId === null || departmentId === undefined)
  })
  const departmentOptions = (departmentsQuery.data ?? [])
    .filter((department) => department.isActive)
    .map((department) => ({ value: department.id, label: department.name }))

  const formValid =
    formValues.departmentId.trim() &&
    /^\d{4}-\d{2}$/.test(formValues.period.trim()) &&
    Number(formValues.rate) >= 0 &&
    Number(formValues.rate) <= 100

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('departments.incentiveTitle')}
        description={t('departments.incentiveHint')}
        size="lg"
        footer={
          <>
            <SoftButton variant="subtle" onClick={onClose}>
              {t('common.close')}
            </SoftButton>
          </>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          {/* شريط الأدوات */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              containerClassName="lg:w-44"
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
              options={periods.map((period) => ({ value: period, label: period }))}
              placeholder={t('departments.incentiveAllPeriods')}
            />
            {canCreate && (
              <>
                <input
                  ref={rateInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(event) => {
                    void handleFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                <SoftButton
                  variant="ghost"
                  icon={<Upload className="size-4" />}
                  loading={parseMutation.isPending || importMutation.isPending}
                  onClick={() => rateInputRef.current?.click()}
                >
                  {t('departments.incentiveUpload')}
                </SoftButton>
                <SoftButton
                  variant="ghost"
                  icon={<Plus className="size-4" />}
                  onClick={() => openForm(null)}
                >
                  {t('departments.incentiveAdd')}
                </SoftButton>
              </>
            )}
          </div>

          {/* معاينة الاستيراد */}
          {parseMutation.data && (
            <div className="rounded-2xl border border-line bg-surface-soft/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-med">
                  {t('departments.incentiveParsed', {
                    matched: parseMutation.data.matched,
                    unmatched: parseMutation.data.unmatched,
                    period: parseMutation.data.period
                  })}
                </p>
                <SoftButton
                  variant="primary"
                  icon={<FileUp className="size-4" />}
                  loading={importMutation.isPending}
                  disabled={parseMutation.data.matched === 0}
                  onClick={() => importMutation.mutate()}
                >
                  {t('departments.incentiveConfirmImport', { count: parseMutation.data.matched })}
                </SoftButton>
              </div>
              <div className="mt-3 rounded-xl border border-line">
                <DataTable maxHeight="max-h-40" minWidth="min-w-[520px]">
                  <DataTableHead>
                    <DataTableHeadRow dense>
                      <DataTableHeadCell dense>{t('departments.code')}</DataTableHeadCell>
                      <DataTableHeadCell dense>{t('departments.name')}</DataTableHeadCell>
                      <DataTableHeadCell dense align="center">
                        {t('departments.incentiveRate')}
                      </DataTableHeadCell>
                      <DataTableHeadCell dense align="center">
                        {t('departments.incentiveMatch')}
                      </DataTableHeadCell>
                    </DataTableHeadRow>
                  </DataTableHead>
                  <tbody className="divide-y divide-surface-base text-xs">
                    {parseMutation.data.rows.slice(0, 200).map((row, index) => (
                      <tr key={index} className={cn(row.match === 'none' && 'bg-rose-500/5')}>
                        <td className="px-3 py-1.5 font-mono text-ink-low">{row.code || '—'}</td>
                        <td className="px-3 py-1.5 text-ink-high">{row.name}</td>
                        <td className="px-3 py-1.5 text-center font-mono tabular-nums text-accent-300">
                          {ratePercent(row.rate)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <Badge tone={row.match === 'none' ? 'rose' : 'teal'}>
                            {row.match === 'none'
                              ? t('departments.incentiveUnmatched')
                              : t('departments.incentiveMatched')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            </div>
          )}

          {/* الجدول */}
          {ratesQuery.isLoading ? (
            <div className="flex h-28 items-center justify-center text-ink-low">…</div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title={t('departments.incentiveEmpty')}
              body={t('departments.incentiveEmptyBody')}
            />
          ) : (
            <div className="rounded-2xl border border-line">
              <DataTable maxHeight="max-h-[46vh]" minWidth="min-w-[680px]">
                <DataTableHead>
                  <DataTableHeadRow dense>
                    <DataTableHeadCell dense>{t('departments.name')}</DataTableHeadCell>
                    <DataTableHeadCell dense align="center">
                      {t('departments.incentiveRate')}
                    </DataTableHeadCell>
                    <DataTableHeadCell dense align="center">
                      {t('payrolls.period')}
                    </DataTableHeadCell>
                    <DataTableHeadCell dense>{t('departments.incentiveNote')}</DataTableHeadCell>
                    <DataTableHeadCell dense align="center">
                      {t('departments.incentiveDocument')}
                    </DataTableHeadCell>
                    <DataTableHeadCell dense align="end">
                      {t('departments.actions')}
                    </DataTableHeadCell>
                  </DataTableHeadRow>
                </DataTableHead>
                <tbody className="divide-y divide-surface-base">
                  {visible.map((rate) => (
                    <tr key={rate.id} className="text-xs transition-colors hover:bg-surface-soft">
                      <td dir="auto" className="max-w-[220px] truncate px-4 py-2.5 font-medium text-ink-high">
                        {rate.departmentName}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold tabular-nums text-accent-300">
                        {ratePercent(rate.rate)}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-ink-med">{rate.period}</td>
                      <td dir="auto" className="max-w-[180px] truncate px-4 py-2.5 text-ink-med">
                        {rate.note ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {rate.fileName ? (
                          <button
                            type="button"
                            title={rate.fileName}
                            onClick={() => void loadPreview(rate)}
                            className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-teal-400/10 px-2.5 py-1 text-[10px] font-medium text-teal-400 transition-colors hover:bg-teal-400/20"
                          >
                            <Paperclip className="size-3" />
                            {t('departments.incentiveDocumented')}
                          </button>
                        ) : (
                          <span className="text-ink-low">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              title={t('common.edit')}
                              onClick={() => openForm(rate)}
                              className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                            >
                              <Pencil className="size-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              title={t('common.delete')}
                              onClick={() => setConfirmDelete(rate)}
                              className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          )}

          {/* معاينة المستند */}
          {previewing && (
            <div className="rounded-2xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-ink-low">
                  {previewing.departmentName} — {ratePercent(previewing.rate)} ({previewing.period})
                </p>
                <button
                  type="button"
                  onClick={() => setPreviewing(null)}
                  className="text-xs text-accent-300"
                >
                  {t('common.close')}
                </button>
              </div>
              {previewError ? (
                <p className="rounded-xl bg-rose-500/10 px-3 py-4 text-center text-xs text-rose-400">
                  {previewError}
                </p>
              ) : pdfUrl ? (
                <iframe
                  title="incentive-rates"
                  src={pdfUrl}
                  className="h-[30vh] w-full rounded-xl border border-line bg-white"
                />
              ) : (
                <div className="flex h-[20vh] items-center justify-center text-ink-low">…</div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* نموذج إضافة/تعديل */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('departments.incentiveEditTitle') : t('departments.incentiveAddTitle')}
        description={t('departments.incentiveFormHint')}
        size="sm"
        footer={
          <>
            <SoftButton variant="subtle" onClick={() => setFormOpen(false)} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </SoftButton>
            <SoftButton
              variant="primary"
              loading={saveMutation.isPending}
              disabled={!formValid}
              onClick={() => saveMutation.mutate()}
            >
              {t('common.save')}
            </SoftButton>
          </>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          {!departmentId && (
            <Select
              label={t('departments.name')}
              value={formValues.departmentId}
              onChange={(event) => setFormValues({ ...formValues, departmentId: event.target.value })}
              options={departmentOptions}
              placeholder={t('departments.incentiveSelectDepartment')}
            />
          )}
          <Input
            label={t('departments.incentivePeriod')}
            type="month"
            dir="ltr"
            value={formValues.period}
            onChange={(event) => setFormValues({ ...formValues, period: event.target.value })}
            placeholder="2026-08"
          />
          <Input
            label={t('departments.incentiveRate')}
            inputMode="decimal"
            dir="ltr"
            value={formValues.rate}
            onChange={(event) => setFormValues({ ...formValues, rate: event.target.value })}
            placeholder="0.45"
            hint={t('departments.incentiveRateHint')}
          />
          <Input
            label={t('departments.incentiveNote')}
            value={formValues.note}
            onChange={(event) => setFormValues({ ...formValues, note: event.target.value })}
            placeholder={t('departments.incentiveNotePlaceholder')}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('departments.incentiveDeleteTitle')}
        body={
          confirmDelete
            ? t('departments.incentiveDeleteBody', {
                department: confirmDelete.departmentName,
                period: confirmDelete.period
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
