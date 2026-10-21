import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileUp, Paperclip, Pencil, Percent, Plus, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type {
  EmployeeIncentiveRateRecord,
  EmployeeIncentiveRateUpsertInput,
  EmployeeIncentiveRateParseResult
} from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
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

function ratePercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

/** نموذج إضافة/تعديل نسبة حافز فردية — يُستخدم من النافذة وبطاقة الملف. */
export function EmployeeIncentiveFormDialog({
  open,
  record,
  presetEmployeeId,
  employeeOptions,
  onClose,
  onSaved
}: {
  open: boolean
  record: EmployeeIncentiveRateRecord | null
  presetEmployeeId?: string
  employeeOptions: { value: string; label: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [employeeId, setEmployeeId] = useState('')
  const [period, setPeriod] = useState('')
  const [rate, setRate] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setEmployeeId(record?.employeeId ?? presetEmployeeId ?? '')
    setPeriod(record?.period ?? '')
    setRate(record ? String(record.rate) : '')
    setNote(record?.note ?? '')
  }, [open, record, presetEmployeeId])

  const saveMutation = useMutation({
    mutationFn: () => {
      const input: EmployeeIncentiveRateUpsertInput = {
        employeeId,
        period,
        rate: Number(rate),
        note: note || null
      }
      return record
        ? api.payrolls.employeeIncentiveRates.update(record.id, input)
        : api.payrolls.employeeIncentiveRates.create(input)
    },
    onSuccess: () => {
      toast.success(record ? t('toasts.empRateUpdated') : t('toasts.empRateCreated'))
      onSaved()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const valid = employeeId.trim() && /^\d{4}-\d{2}$/.test(period) && Number(rate) >= 0 && Number(rate) <= 100
  const lockedEmployee = Boolean(record || presetEmployeeId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? t('payrolls.empRatesEditTitle') : t('payrolls.empRatesAddTitle')}
      description={t('payrolls.empRatesFormHint')}
      size="sm"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={saveMutation.isPending}>
            {t('common.cancel')}
          </SoftButton>
          <SoftButton
            variant="primary"
            loading={saveMutation.isPending}
            disabled={!valid}
            onClick={() => saveMutation.mutate()}
          >
            {t('common.save')}
          </SoftButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {!lockedEmployee && (
          <Select
            label={t('payrolls.employee')}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            options={employeeOptions}
            placeholder={t('payrolls.empRatesSelectEmployee')}
          />
        )}
        <Input
          label={t('payrolls.empRatesPeriod')}
          type="month"
          dir="ltr"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        />
        <Input
          label={t('payrolls.empRatesRate')}
          inputMode="decimal"
          dir="ltr"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
          placeholder="0.45"
          hint={t('payrolls.empRatesRateHint')}
        />
        <Input
          label={t('payrolls.empRatesNote')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  )
}

/** بطاقة نسبة الحافز الفردية لموظف واحد (داخل تبويب الرواتب في الملف الكامل). */
export function EmployeeIncentiveRatesCard({
  employeeId,
  employeeOptions
}: {
  employeeId: string
  employeeOptions?: { value: string; label: string }[]
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const canEdit = usePermission('payrolls.edit')
  const canDelete = usePermission('payrolls.delete')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeIncentiveRateRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EmployeeIncentiveRateRecord | null>(null)

  const ratesQuery = useQuery({
    queryKey: ['payrolls', 'empRates', employeeId],
    queryFn: () => api.payrolls.employeeIncentiveRates.listByEmployee(employeeId),
    enabled: Boolean(employeeId)
  })
  const rates = useMemo(() => ratesQuery.data ?? [], [ratesQuery.data])
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['payrolls', 'empRates'] })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.payrolls.employeeIncentiveRates.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.empRateDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-high">
          {t('payrolls.empRatesTitle')}
          <span className="ms-2 text-[10px] font-normal text-ink-low">{t('payrolls.empRatesCount', { count: rates.length })}</span>
        </p>
        {canEdit && (
          <SoftButton
            variant="ghost"
            icon={<Plus className="size-3.5" />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t('payrolls.empRatesAdd')}
          </SoftButton>
        )}
      </div>

      {rates.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface-soft/50 px-4 py-3 text-center text-[11px] text-ink-low">
          {t('payrolls.empRatesEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rates.map((rate) => (
            <li key={rate.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-soft/50 px-3 py-2">
              <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[10px] tabular-nums">{rate.period}</span>
              <span dir="ltr" className="font-mono text-sm font-bold tabular-nums text-accent-300">
                {ratePercent(rate.rate)}
              </span>
              {rate.note && <span dir="auto" className="min-w-0 flex-1 truncate text-[11px] text-ink-med">{rate.note}</span>}
              <span className="ms-auto flex items-center gap-0.5">
                {canEdit && (
                  <button
                    type="button"
                    title={t('common.edit')}
                    onClick={() => {
                      setEditing(rate)
                      setFormOpen(true)
                    }}
                    className="focus-ring grid size-7 place-items-center rounded-md text-ink-low hover:bg-surface-strong hover:text-accent-300"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    title={t('common.delete')}
                    onClick={() => setConfirmDelete(rate)}
                    className="focus-ring grid size-7 place-items-center rounded-md text-ink-low hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <EmployeeIncentiveFormDialog
        open={formOpen}
        record={editing}
        presetEmployeeId={employeeId}
        employeeOptions={employeeOptions ?? [{ value: employeeId, label: employeeId }]}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('payrolls.empRatesDeleteTitle')}
        body={t('payrolls.empRatesDeleteBody', { period: confirmDelete?.period ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}

/** نافذة نسب الحوافز الفردية العامة (من قائمة المرتبات). */
export function EmployeeIncentiveRatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const canCreate = usePermission('payrolls.create')
  const canEdit = usePermission('payrolls.edit')
  const canDelete = usePermission('payrolls.delete')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [periodFilter, setPeriodFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeIncentiveRateRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EmployeeIncentiveRateRecord | null>(null)
  const [previewing, setPreviewing] = useState<EmployeeIncentiveRateRecord | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<EmployeeIncentiveRateParseResult | null>(null)
  const [importFile, setImportFile] = useState<{ data: ArrayBuffer; fileName: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const ratesQuery = useQuery({
    queryKey: ['payrolls', 'empRates', 'all'],
    queryFn: () => api.payrolls.employeeIncentiveRates.list({}),
    enabled: open,
    staleTime: 30_000
  })
  const rates = useMemo(() => ratesQuery.data ?? [], [ratesQuery.data])
  const periods = useMemo(
    () => [...new Set(rates.map((rate) => rate.period))].sort((a, b) => (a < b ? 1 : -1)),
    [rates]
  )
  const visible = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return rates.filter((rate) => {
      const inPeriod = !periodFilter || rate.period === periodFilter
      const inSearch =
        !needle ||
        rate.employeeCode.toLowerCase().startsWith(needle) ||
        rate.employeeName.toLowerCase().includes(needle)
      return inPeriod && inSearch
    })
  }, [rates, periodFilter, debouncedSearch])

  const employeesQuery = useQuery({
    queryKey: ['employees', 'list', { search: undefined, isActive: null, sort: 'code', order: 'asc' }],
    queryFn: () => api.employees.list({}),
    enabled: open
  })
  const employeeOptions = (employeesQuery.data ?? []).map((employee) => ({
    value: employee.id,
    label: `${employee.code} — ${employee.name}`
  }))

  useEffect(() => {
    if (!open) {
      setParseResult(null)
      setImportFile(null)
      setPreviewing(null)
      setPdfUrl(null)
      setPreviewError(null)
    }
  }, [open])

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['payrolls', 'empRates'] })

  const parseMutation = useMutation({
    mutationFn: (payload: { data: ArrayBuffer; fileName: string }) =>
      api.payrolls.employeeIncentiveRates.parsePdf(payload),
    onSuccess: (result) => setParseResult(result),
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })
  const importMutation = useMutation({
    mutationFn: () => api.payrolls.employeeIncentiveRates.importPdf(importFile!),
    onSuccess: (summary) => {
      toast.success(t('toasts.empRateImported', { count: summary.created }))
      setParseResult(null)
      setImportFile(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.payrolls.employeeIncentiveRates.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.empRateDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const loadPreview = async (record: EmployeeIncentiveRateRecord) => {
    setPdfUrl(null)
    setPreviewError(null)
    setPreviewing(record)
    try {
      const result = await api.payrolls.employeeIncentiveRates.preview(record.id)
      if (!result) {
        setPreviewError(t('payrolls.empRatesNoDocument'))
        return
      }
      const url = URL.createObjectURL(new Blob([new Uint8Array(result.data)], { type: 'application/pdf' }))
      setPdfUrl(url)
    } catch (error) {
      setPreviewError(resolveApiError(error))
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const payload = { data: await file.arrayBuffer(), fileName: file.name }
    setImportFile(payload)
    parseMutation.mutate(payload)
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('payrolls.empRatesTitle')}
        description={t('payrolls.empRatesHint')}
        size="lg"
        footer={
          <SoftButton variant="subtle" onClick={onClose}>
            {t('common.close')}
          </SoftButton>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              containerClassName="flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('payrolls.empRatesSearch')}
              icon={<Search className="size-4" />}
            />
            <Select
              containerClassName="lg:w-40"
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
              options={periods.map((period) => ({ value: period, label: period }))}
              placeholder={t('payrolls.empRatesAllPeriods')}
            />
            {canCreate && (
              <>
                <input
                  ref={fileRef}
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
                  onClick={() => fileRef.current?.click()}
                >
                  {t('payrolls.empRatesUpload')}
                </SoftButton>
              </>
            )}
            {canCreate && (
              <SoftButton
                variant="ghost"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                {t('payrolls.empRatesAdd')}
              </SoftButton>
            )}
          </div>

          {parseResult && (
            <div className="rounded-2xl border border-line bg-surface-soft/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-med">
                  {t('payrolls.empRatesParsed', {
                    matched: parseResult.matched,
                    unmatched: parseResult.unmatched,
                    period: parseResult.period
                  })}
                </p>
                <SoftButton
                  variant="primary"
                  icon={<FileUp className="size-4" />}
                  loading={importMutation.isPending}
                  disabled={parseResult.matched === 0}
                  onClick={() => importMutation.mutate()}
                >
                  {t('payrolls.empRatesConfirmImport', { count: parseResult.matched })}
                </SoftButton>
              </div>
              <div className="mt-3 rounded-xl border border-line">
                <DataTable maxHeight="max-h-40" minWidth="min-w-[520px]">
                  <DataTableHead>
                    <DataTableHeadRow dense>
                      <DataTableHeadCell dense>{t('payrolls.code')}</DataTableHeadCell>
                      <DataTableHeadCell dense>{t('payrolls.name')}</DataTableHeadCell>
                      <DataTableHeadCell dense align="center">
                        {t('payrolls.empRatesRate')}
                      </DataTableHeadCell>
                      <DataTableHeadCell dense align="center">
                        {t('payrolls.empRatesMatch')}
                      </DataTableHeadCell>
                    </DataTableHeadRow>
                  </DataTableHead>
                  <tbody className="divide-y divide-surface-base text-xs">
                    {parseResult.rows.slice(0, 200).map((row, index) => (
                      <tr key={index} className={cn(row.match === 'none' && 'bg-rose-500/5')}>
                        <td className="px-3 py-1.5 font-mono text-ink-low">{row.code || '—'}</td>
                        <td dir="auto" className="px-3 py-1.5 text-ink-high">{row.name}</td>
                        <td className="px-3 py-1.5 text-center font-mono tabular-nums text-accent-300">
                          {ratePercent(row.rate)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <Badge tone={row.match === 'none' ? 'rose' : 'teal'}>
                            {row.match === 'none'
                              ? t('payrolls.empRatesUnmatched')
                              : t('payrolls.empRatesMatched')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            </div>
          )}

          {ratesQuery.isLoading ? (
            <div className="flex h-28 items-center justify-center text-ink-low">…</div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Percent className="size-6" />}
              title={t('payrolls.empRatesEmpty')}
              body={t('payrolls.empRatesEmptyBody')}
            />
          ) : (
            <div className="rounded-2xl border border-line">
              <DataTable maxHeight="max-h-[46vh]" minWidth="min-w-[720px]">
                <DataTableHead>
                  <DataTableHeadRow dense>
                    <DataTableHeadCell dense>{t('payrolls.employee')}</DataTableHeadCell>
                    <DataTableHeadCell dense align="center">
                      {t('payrolls.empRatesRate')}
                    </DataTableHeadCell>
                    <DataTableHeadCell dense align="center">
                      {t('payrolls.period')}
                    </DataTableHeadCell>
                    <DataTableHeadCell dense align="center">
                      {t('payrolls.empRatesDocument')}
                    </DataTableHeadCell>
                    <DataTableHeadCell dense align="end">
                      {t('payrolls.actions')}
                    </DataTableHeadCell>
                  </DataTableHeadRow>
                </DataTableHead>
                <tbody className="divide-y divide-surface-base">
                  {visible.map((rate) => (
                    <tr key={rate.id} className="text-xs transition-colors hover:bg-surface-soft">
                      <td className="px-4 py-2.5">
                        <span dir="ltr" className="font-mono text-ink-low">{rate.employeeCode}</span>
                        <span dir="auto" className="ms-2 max-w-[220px] truncate font-medium text-ink-high">
                          {rate.employeeName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold tabular-nums text-accent-300">
                        {ratePercent(rate.rate)}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-ink-med">{rate.period}</td>
                      <td className="px-4 py-2.5 text-center">
                        {rate.fileName ? (
                          <button
                            type="button"
                            title={rate.fileName}
                            onClick={() => void loadPreview(rate)}
                            className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-teal-400/10 px-2.5 py-1 text-[10px] font-medium text-teal-400 hover:bg-teal-400/20"
                          >
                            <Paperclip className="size-3" />
                            {t('payrolls.empRatesDocumented')}
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
                              onClick={() => {
                                setEditing(rate)
                                setFormOpen(true)
                              }}
                              className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low hover:bg-surface-strong hover:text-accent-300"
                            >
                              <Pencil className="size-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              title={t('common.delete')}
                              onClick={() => setConfirmDelete(rate)}
                              className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low hover:bg-rose-500/10 hover:text-rose-400"
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

          {previewing && (
            <div className="rounded-2xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-ink-low">
                  {previewing.employeeName} — {ratePercent(previewing.rate)} ({previewing.period})
                </p>
                <button type="button" onClick={() => setPreviewing(null)} className="text-xs text-accent-300">
                  {t('common.close')}
                </button>
              </div>
              {previewError ? (
                <p className="rounded-xl bg-rose-500/10 px-3 py-4 text-center text-xs text-rose-400">
                  {previewError}
                </p>
              ) : pdfUrl ? (
                <iframe title="emp-incentive-rates" src={pdfUrl} className="h-[30vh] w-full rounded-xl border border-line bg-white" />
              ) : (
                <div className="flex h-[20vh] items-center justify-center text-ink-low">…</div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <EmployeeIncentiveFormDialog
        open={formOpen}
        record={editing}
        employeeOptions={employeeOptions}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('payrolls.empRatesDeleteTitle')}
        body={t('payrolls.empRatesDeleteBody', { period: confirmDelete?.period ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
