import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Undo2,
  Wallet
} from 'lucide-react'
import type {
  RetirementReviewNoteInput,
  RetirementReviewReport,
  RetirementReviewRow,
  RetirementReviewSlip,
  RetirementView
} from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { usePermission } from '@/hooks/usePermission'
import { staggerItem, spring } from '@/lib/motion'
import { cn, formatDateOnly } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { SoftButton } from '@/components/ui/SoftButton'
import {
  DataTable,
  DataTableBody,
  DataTableFoot,
  DataTableFootCell,
  DataTableFootRow,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeadRow
} from '@/components/ui/DataTable'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'

interface RetirementReviewModalProps {
  open?: boolean
  onClose?: () => void
  inline?: boolean
  view: RetirementView
  year: string
  month: string
  search: string
  departmentId: string
}

function monthLabel(period: string): string {
  const [year, month] = period.split('-')
  return `${month} / ${year}`
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDifference(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (Math.abs(value) <= 0.005) return '0.00'
  const text = formatNumber(Math.abs(value))
  return value > 0 ? `+${text}` : `-${text}`
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

function hasVariance(slip: RetirementReviewSlip): boolean {
  return slip.totals.difference !== null && Math.abs(slip.totals.difference) > 0.01
}

function isMatch(value: number | null): boolean {
  return value !== null && Math.abs(value) <= 0.01
}

function differenceTone(difference: number | null): string {
  if (difference === null) return 'text-ink-low'
  return Math.abs(difference) <= 0.01 ? 'text-teal-300' : 'text-amber-300'
}

function withItemNote(
  slip: RetirementReviewSlip,
  itemKey: string,
  note: string
): RetirementReviewSlip {
  return {
    ...slip,
    items: slip.items.map((item) => (item.key === itemKey ? { ...item, note } : item))
  }
}

export function RetirementReviewModal({
  open = false,
  onClose,
  inline = false,
  view,
  year,
  month,
  search,
  departmentId
}: RetirementReviewModalProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const canEditNotes = usePermission('reviews.edit')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [savingNoteKey, setSavingNoteKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open && !inline) setDetailId(null)
  }, [open, inline])

  const reviewQueryKey = useMemo(
    () => ['retirements', 'review', view, year, month, search, departmentId] as const,
    [view, year, month, search, departmentId]
  )

  const reviewQuery = useQuery({
    queryKey: reviewQueryKey,
    queryFn: () =>
      api.retirements.review({
        view,
        year: year ? Number(year) : undefined,
        month: year && month ? Number(month) : undefined,
        search: search || undefined,
        departmentId: departmentId || undefined
      }),
    enabled: inline || open
  })

  const saveNoteMutation = useMutation({
    mutationFn: (input: RetirementReviewNoteInput) =>
      api.retirements.saveReviewNote(input),
    onSuccess: (saved, input) => {
      const note = saved?.note ?? ''
      queryClient.setQueryData<RetirementReviewReport>(reviewQueryKey, (current) => {
        if (!current) return current
        return {
          ...current,
          rows: current.rows.map((row) =>
            row.employeeId === input.employeeId
              ? { ...row, salary: withItemNote(row.salary, input.itemKey, note) }
              : row
          )
        }
      })
      toast.success(
        saved
          ? t('reviews.retirements.review.noteSaved')
          : t('reviews.retirements.review.noteRemoved')
      )
      setSavingNoteKey(null)
    },
    onError: (error) => {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
      setSavingNoteKey(null)
    }
  })

  const report = reviewQuery.data ?? null
  const isLoading = reviewQuery.isLoading || reviewQuery.isFetching
  const detailRow = detailId
    ? (report?.rows.find((row) => row.employeeId === detailId) ?? null)
    : null

  const handleSaveNote = (itemKey: string, label: string, note: string): void => {
    if (!detailRow) return
    setSavingNoteKey(`${detailRow.employeeId}:${detailRow.retirementPeriod}:${itemKey}`)
    saveNoteMutation.mutate({
      employeeId: detailRow.employeeId,
      period: detailRow.retirementPeriod,
      itemKey,
      label,
      note
    })
  }

  const title = detailRow
    ? t('reviews.retirements.review.salaryTitle', { name: detailRow.employeeName })
    : t('reviews.retirements.review.title')

  const description = detailRow
    ? t('reviews.retirements.review.salaryDescription', {
        period: monthLabel(detailRow.retirementPeriod),
        days: detailRow.actualDays,
        ratio: formatPercent(detailRow.ratio)
      })
    : t('reviews.retirements.review.description')

  const footer = (
    <div className="flex w-full items-center justify-between gap-3">
      <div>
        {detailRow && (
          <SoftButton
            variant="subtle"
            size="sm"
            icon={<Undo2 className="size-4" />}
            onClick={() => setDetailId(null)}
          >
            {t('reviews.retirements.review.back')}
          </SoftButton>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-low">
          {!detailRow && report
            ? t('reviews.retirements.review.showing', { count: report.rows.length })
            : ''}
        </span>
        <SoftButton variant="ghost" size="sm" onClick={() => onClose?.()}>
          {t('reviews.retirements.review.close')}
        </SoftButton>
      </div>
    </div>
  )

  const content = (
    <div>
      {detailRow ? (
        <RetirementSlipDetail
          row={detailRow}
          slip={detailRow.salary}
          language={i18n.language}
          readOnly={!canEditNotes}
          savingNoteKey={savingNoteKey}
          onSaveNote={handleSaveNote}
        />
      ) : isLoading && !report ? (
        <div className="py-4">
          <SkeletonRows rows={8} />
        </div>
      ) : reviewQuery.error ? (
        <EmptyState
          icon={<AlertTriangle className="size-7" />}
          title={t('toasts.error')}
          body={resolveApiError(reviewQuery.error)}
        />
      ) : !report || report.rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-7" />}
          title={t('reviews.retirements.review.noRows')}
          body={t('reviews.retirements.review.noRowsBody')}
        />
      ) : (
        <div className="flex flex-col gap-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <ReviewSummary
              icon={<ClipboardCheck className="size-4" />}
              title={t('reviews.retirements.review.employees')}
              value={String(report.totals.employees)}
              hint={t('reviews.retirements.review.employeesHint')}
            />
            <ReviewSummary
              icon={<Wallet className="size-4" />}
              title={t('reviews.retirements.review.distributedBasic')}
              value={formatNumber(report.totals.distributedBasic)}
              hint={t('reviews.retirements.review.distributedBasicHint')}
            />
            <ReviewSummary
              icon={<CalendarClock className="size-4" />}
              title={t('reviews.retirements.review.natureAllowance')}
              value={formatNumber(report.totals.natureAllowance)}
              hint={t('reviews.retirements.review.natureAllowanceHint')}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-line">
            <DataTable size="md">
              <DataTableHead>
                <DataTableHeadRow>
                  <DataTableHeadCell className="w-[96px]" align="center">
                    {t('reviews.retirements.review.employeeCode')}
                  </DataTableHeadCell>
                  <DataTableHeadCell>{t('reviews.retirements.review.employeeName')}</DataTableHeadCell>
                  <DataTableHeadCell className="w-[180px]">
                    {t('reviews.retirements.review.departmentName')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[140px]" align="center">
                    {t('reviews.retirements.review.retirementDate')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[115px]" align="center">
                    {t('reviews.retirements.review.actualDays')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[140px]" align="center">
                    {t('reviews.retirements.review.basicSalary')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[140px]" align="center">
                    {t('reviews.retirements.review.actions')}
                  </DataTableHeadCell>
                </DataTableHeadRow>
              </DataTableHead>
              <DataTableBody>
                {report.rows.map((row) => (
                  <motion.tr
                    key={row.employeeId}
                    variants={staggerItem}
                    transition={spring}
                    className="transition-colors hover:bg-surface-soft"
                  >
                    <td className="px-5 py-3 text-center">
                      <span dir="ltr" className="font-mono text-xs text-ink-med">
                        {row.employeeCode}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span dir="auto" className="block truncate text-sm font-semibold text-ink-high">
                        {row.employeeName}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span dir="auto" className="block truncate text-xs text-ink-low">
                        {row.departmentName ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span dir="ltr" className="text-xs font-semibold tabular-nums text-accent-300">
                        {formatDateOnly(row.retirementDate, i18n.language)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge tone="gold" className="px-2 py-0.5 text-[10px]">
                          {row.actualDays} / {row.monthDays}
                        </Badge>
                        <span className="text-[10px] text-ink-low">
                          {formatPercent(row.ratio)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-end">
                      <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink-med">
                        {formatNumber(row.basicSalary)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center">
                        <ReviewAction
                          slip={row.salary}
                          label={t('reviews.retirements.review.salaryAction')}
                          onClick={() => setDetailId(row.employeeId)}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </DataTableBody>
            </DataTable>
          </div>

          <p className="rounded-xl border border-line bg-surface-soft/50 px-4 py-3 text-[11px] leading-relaxed text-ink-low">
            {t('reviews.retirements.review.formula')}
          </p>
        </div>
      )}
    </div>
  )

  if (inline) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink-high">{title}</h2>
            <p className="mt-1 text-xs text-ink-low">{description}</p>
          </div>
        </div>
        {content}
        <div className="flex w-full items-center justify-between gap-3">{footer}</div>
      </div>
    )
  }

  return (
    <Modal
      open={open}
      onClose={() => onClose?.()}
      size="xl"
      title={title}
      description={description}
      footer={footer}
    >
      {content}
    </Modal>
  )
}

function ReviewSummary({
  icon,
  title,
  value,
  hint
}: {
  icon: React.ReactNode
  title: string
  value: string
  hint: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-soft/50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-base text-accent-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-ink-low">{title}</p>
        <p dir="ltr" className="truncate text-base font-bold tabular-nums text-ink-high">
          {value}
        </p>
        <p className="truncate text-[10px] text-ink-low">{hint}</p>
      </div>
    </div>
  )
}

function ReviewAction({
  slip,
  label,
  onClick
}: {
  slip: RetirementReviewSlip
  label: string
  onClick: () => void
}) {
  return (
    <SoftButton
      variant="subtle"
      size="sm"
      icon={<Wallet className="size-3.5" />}
      className="h-8 gap-1.5 border border-teal-400/20 px-2.5 text-[11px] text-teal-300 hover:bg-teal-500/10"
      onClick={onClick}
    >
      {label}
      <span
        className={cn(
          'size-1.5 rounded-full',
          !slip.available
            ? 'bg-ink-low/40'
            : hasVariance(slip)
              ? 'bg-amber-400 shadow-[0_0_6px_currentColor]'
              : 'bg-teal-400/70'
        )}
      />
    </SoftButton>
  )
}

function RetirementSlipDetail({
  row,
  slip,
  language,
  readOnly,
  savingNoteKey,
  onSaveNote
}: {
  row: RetirementReviewRow
  slip: RetirementReviewSlip
  language: string
  readOnly: boolean
  savingNoteKey: string | null
  onSaveNote: (itemKey: string, label: string, note: string) => void
}) {
  const { t } = useTranslation()
  const netDifference = slip.totals.difference

  const noteText = (note: RetirementReviewSlip['notes'][number]): string => {
    switch (note) {
      case 'salarySlipMissing':
        return t('reviews.retirements.review.salarySlipMissing', {
          period: monthLabel(slip.period)
        })
      case 'basicMissing':
        return t('reviews.retirements.review.basicMissing')
      case 'birthDateMissing':
        return t('reviews.retirements.review.birthDateMissing')
      case 'natureAllowanceMissing':
        return t('reviews.retirements.review.natureAllowanceMissing')
      case 'previousSalarySlipMissing':
        return t('reviews.retirements.review.previousSalarySlipMissing')
      case 'earningBaselineMissing':
        return t('reviews.retirements.review.earningBaselineMissing')
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-5">
      <div className="rounded-2xl border border-line bg-surface-soft/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p dir="auto" className="text-base font-bold text-ink-high">
              {row.employeeName}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-low">
              <span dir="ltr" className="font-mono">
                {row.employeeCode}
              </span>
              <span className="text-ink-low/40">·</span>
              <span dir="auto">{row.departmentName ?? '—'}</span>
              <span className="text-ink-low/40">·</span>
              <span>
                {t('reviews.retirements.review.basicSalary')}:{' '}
                <b dir="ltr" className="tabular-nums text-ink-med">
                  {formatNumber(row.basicSalary)}
                </b>
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">
              {t('reviews.retirements.review.retirementDate')}:{' '}
              {formatDateOnly(row.retirementDate, language)}
            </Badge>
            <Badge tone="neutral">
              {t('reviews.retirements.review.actualDays')}: {row.actualDays} / {row.monthDays} (
              {formatPercent(row.ratio)})
            </Badge>
            {row.natureAllowancePct !== null && (
              <Badge tone="violet">
                {t('reviews.retirements.review.natureAllowancePct')}:{' '}
                {formatNumber(row.natureAllowancePct)}%
              </Badge>
            )}
            <Badge tone="teal">
              {t('reviews.retirements.review.distributedBasic')}:{' '}
              <span dir="ltr">{formatNumber(row.distributedBasic)}</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <NetCard
          label={t('reviews.retirements.review.actualNet')}
          value={formatNumber(slip.totals.actualNet)}
          tone="neutral"
        />
        <NetCard
          label={t('reviews.retirements.review.expectedNet')}
          value={formatNumber(slip.totals.expectedNet)}
          tone="teal"
        />
        <NetCard
          label={t('reviews.retirements.review.netDifference')}
          value={formatDifference(netDifference)}
          tone={
            netDifference === null
              ? 'neutral'
              : Math.abs(netDifference) <= 0.01
                ? 'teal'
                : 'amber'
          }
        />
      </div>

      {slip.notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {slip.notes.map((note) => (
            <div
              key={note}
              className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-[11px] leading-relaxed text-amber-300"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{noteText(note)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line">
        <DataTable size="md">
          <DataTableHead>
            <DataTableHeadRow>
              <DataTableHeadCell>{t('reviews.retirements.review.item')}</DataTableHeadCell>
              <DataTableHeadCell className="w-[140px]" align="center">
                {t('reviews.retirements.review.actual')}
              </DataTableHeadCell>
              <DataTableHeadCell className="w-[140px]" align="center">
                {t('reviews.retirements.review.expected')}
              </DataTableHeadCell>
              <DataTableHeadCell className="w-[160px]" align="center">
                {t('reviews.retirements.review.difference')}
              </DataTableHeadCell>
              <DataTableHeadCell className="w-[230px]">
                {t('reviews.retirements.review.notes')}
              </DataTableHeadCell>
            </DataTableHeadRow>
          </DataTableHead>
          <DataTableBody>
            {slip.items.map((item) => (
              <motion.tr
                key={item.key}
                variants={staggerItem}
                transition={spring}
                className={cn(
                  'transition-colors hover:bg-surface-soft',
                  item.informational && 'bg-surface-soft/30'
                )}
              >
                <td className="px-5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        item.informational ? 'text-ink-low' : 'text-ink-med'
                      )}
                    >
                      {item.label}
                    </span>
                    {item.informational && (
                      <Badge tone="neutral" className="px-2 py-0.5 text-[9px]">
                        {t('reviews.retirements.review.informational')}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-5 py-2.5 text-end">
                  <span dir="ltr" className="text-xs tabular-nums text-ink-med">
                    {formatNumber(item.actual)}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-end">
                  <span dir="ltr" className="text-xs font-semibold tabular-nums text-ink-high">
                    {formatNumber(item.expected)}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-end">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      dir="ltr"
                      className={cn(
                        'text-xs font-bold tabular-nums',
                        item.informational
                          ? 'text-ink-low'
                          : differenceTone(item.difference)
                      )}
                    >
                      {item.informational ? '—' : formatDifference(item.difference)}
                    </span>
                    {!item.informational && item.difference !== null && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
                          isMatch(item.difference)
                            ? 'border-teal-400/25 bg-teal-400/10 text-teal-300'
                            : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                        )}
                      >
                        {isMatch(item.difference) ? (
                          <CheckCircle2 className="size-2.5" />
                        ) : (
                          <AlertTriangle className="size-2.5" />
                        )}
                        {isMatch(item.difference)
                          ? t('reviews.retirements.review.match')
                          : t('reviews.retirements.review.mismatch')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <NoteCell
                    note={item.note ?? ''}
                    saving={savingNoteKey === `${row.employeeId}:${slip.period}:${item.key}`}
                    readOnly={readOnly}
                    onSave={(note) => onSaveNote(item.key, item.label, note)}
                  />
                </td>
              </motion.tr>
            ))}
          </DataTableBody>
          <DataTableFoot>
            <DataTableFootRow>
              <DataTableFootCell align="start">
                {t('reviews.retirements.review.total')}
              </DataTableFootCell>
              <DataTableFootCell className="tabular-nums" align="center" dir="ltr">
                {formatNumber(slip.totals.actualNet)}
              </DataTableFootCell>
              <DataTableFootCell className="tabular-nums" align="center" dir="ltr">
                {formatNumber(slip.totals.expectedNet)}
              </DataTableFootCell>
              <DataTableFootCell
                className={cn('tabular-nums', differenceTone(netDifference))}
                align="center"
                dir="ltr"
              >
                {formatDifference(netDifference)}
              </DataTableFootCell>
              <DataTableFootCell />
            </DataTableFootRow>
          </DataTableFoot>
        </DataTable>
      </div>

      <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-ink-low">
        <p>{t('reviews.retirements.review.notesHint')}</p>
        <p>{t('reviews.retirements.review.formula')}</p>
        <p>{t('reviews.retirements.review.unrelatedNote')}</p>
        <p>{t('reviews.retirements.review.differenceNote')}</p>
      </div>
    </div>
  )
}

function NoteCell({
  note,
  saving,
  readOnly,
  onSave
}: {
  note: string
  saving: boolean
  readOnly: boolean
  onSave: (note: string) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(note)

  useEffect(() => {
    setValue(note)
  }, [note])

  const dirty = !readOnly && value.trim() !== note.trim()
  const submit = (): void => {
    if (dirty && !saving) onSave(value)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        dir="auto"
        value={value}
        maxLength={2000}
        disabled={readOnly}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
          if (event.key === 'Escape') setValue(note)
        }}
        placeholder={t('reviews.retirements.review.notePlaceholder')}
        aria-label={t('reviews.retirements.review.notes')}
        className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface-base px-2 text-[11px] text-ink-med placeholder:text-ink-low/50 focus:border-accent-400/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      {!readOnly && (
        <button
          type="button"
          onClick={submit}
          disabled={!dirty || saving}
          title={t('reviews.retirements.review.saveNote')}
          aria-label={t('reviews.retirements.review.saveNote')}
          className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-ink-low transition-colors hover:border-teal-400/30 hover:bg-teal-500/10 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {saving ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
        </button>
      )}
    </div>
  )
}

function NetCard({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone: 'neutral' | 'teal' | 'amber'
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-soft/50 p-3.5">
      <p className="truncate text-[11px] text-ink-low">{label}</p>
      <p
        dir="ltr"
        className={cn(
          'mt-1 truncate text-lg font-bold tabular-nums',
          tone === 'teal'
            ? 'text-teal-300'
            : tone === 'amber'
              ? 'text-amber-300'
              : 'text-ink-high'
        )}
      >
        {value}
      </p>
    </div>
  )
}
