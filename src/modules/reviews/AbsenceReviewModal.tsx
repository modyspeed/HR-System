import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Gift,
  Loader2,
  Undo2,
  Wallet
} from 'lucide-react'
import type {
  AbsenceReviewNoteInput,
  AbsenceReviewReport,
  AbsenceReviewRow,
  AbsenceReviewSlip
} from '@shared/types'
import { addMonths, nextPeriod } from '@shared/absenceRules'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { usePermission } from '@/hooks/usePermission'
import { staggerItem, spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
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

type DetailKind = 'salary' | 'incentive'

interface AbsenceReviewModalProps {
  open?: boolean
  onClose?: () => void
  inline?: boolean
  period: string
  search: string
  departmentId: string
}

/** «2026-09» → «09 / 2026». */
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

function hasVariance(slip: AbsenceReviewSlip): boolean {
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
  slip: AbsenceReviewSlip,
  itemKey: string,
  note: string
): AbsenceReviewSlip {
  return {
    ...slip,
    items: slip.items.map((item) => (item.key === itemKey ? { ...item, note } : item))
  }
}

/**
 * «مراجعة الغيابات»: قائمة الموظفين الغائبين، ولكل موظف مراجعة حافز شهر
 * الغياب ومرتب الشهر التالي — الفعلي من الظرف، والمتوقع من قواعد الغياب.
 */
export function AbsenceReviewModal({
  open = false,
  onClose,
  inline = false,
  period,
  search,
  departmentId
}: AbsenceReviewModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const canEditNotes = usePermission('reviews.edit')
  const [detail, setDetail] = useState<{ kind: DetailKind; employeeId: string } | null>(null)
  const [savingNoteKey, setSavingNoteKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open && !inline) setDetail(null)
  }, [open, inline])

  const reviewQueryKey = useMemo(
    () => ['payrolls', 'items', 'absenceReview', period, search, departmentId] as const,
    [period, search, departmentId]
  )

  const reviewQuery = useQuery({
    queryKey: reviewQueryKey,
    queryFn: () =>
      api.payrolls.items.absenceReview({
        period,
        search: search || undefined,
        departmentId: departmentId || undefined
      }),
    enabled: (inline || open) && Boolean(period)
  })

  const saveNoteMutation = useMutation({
    mutationFn: (input: AbsenceReviewNoteInput) =>
      api.payrolls.items.saveAbsenceReviewNote(input),
    onSuccess: (saved, input) => {
      const note = saved?.note ?? ''
      queryClient.setQueryData<AbsenceReviewReport>(
        ['payrolls', 'items', 'absenceReview', input.period, search, departmentId],
        (current) => {
          if (!current) return current
          return {
            ...current,
            rows: current.rows.map((row) => {
              if (row.employeeId !== input.employeeId) return row
              return {
                ...row,
                salary:
                  input.slipType === 'salary'
                    ? withItemNote(row.salary, input.itemKey, note)
                    : row.salary,
                incentive:
                  input.slipType === 'incentive'
                    ? withItemNote(row.incentive, input.itemKey, note)
                    : row.incentive
              }
            })
          }
        }
      )
      toast.success(
        saved
          ? t('reviews.absenceReview.noteSaved')
          : t('reviews.absenceReview.noteRemoved')
      )
      setSavingNoteKey(null)
    },
    onError: (error) => {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
      setSavingNoteKey(null)
    }
  })

  const handleSaveNote =
    (slipType: 'salary' | 'incentive') =>
    (itemKey: string, label: string, note: string): void => {
      if (!detail) return
      setSavingNoteKey(`${detail.employeeId}:${slipType}:${itemKey}`)
      saveNoteMutation.mutate({
        employeeId: detail.employeeId,
        period,
        slipType,
        itemKey,
        label,
        note
      })
    }

  const report = reviewQuery.data ?? null
  const isLoading = reviewQuery.isLoading || reviewQuery.isFetching
  const salaryPeriod = report?.salaryPeriod ?? (period ? nextPeriod(period) : '')
  const detailRow = detail
    ? (report?.rows.find((row) => row.employeeId === detail.employeeId) ?? null)
    : null
  const detailSlip = detailRow
    ? detail?.kind === 'salary'
      ? detailRow.salary
      : detailRow.incentive
    : null

  const title = useMemo(() => {
    if (detail && detailRow) {
      return detail.kind === 'salary'
        ? t('reviews.absenceReview.salaryTitle', { name: detailRow.employeeName })
        : t('reviews.absenceReview.incentiveTitle', { name: detailRow.employeeName })
    }
    return t('reviews.absenceReview.title')
  }, [detail, detailRow, t])

  const description = useMemo(() => {
    if (detail && detailRow) {
      return detail.kind === 'salary'
        ? t('reviews.absenceReview.salaryDescription', {
            period: monthLabel(salaryPeriod),
            absencePeriod: monthLabel(period)
          })
        : t('reviews.absenceReview.incentiveDescription', { period: monthLabel(period) })
    }
    return t('reviews.absenceReview.description', {
      period: monthLabel(period),
      salaryPeriod: salaryPeriod ? monthLabel(salaryPeriod) : '—'
    })
  }, [detail, detailRow, period, salaryPeriod, t])

  const footer = detail ? (
    <div className="flex w-full items-center justify-between gap-3">
      <SoftButton
        variant="subtle"
        size="sm"
        icon={<Undo2 className="size-4" />}
        onClick={() => setDetail(null)}
      >
        {t('reviews.absenceReview.back')}
      </SoftButton>
      <SoftButton variant="ghost" size="sm" onClick={() => onClose?.()}>
        {t('reviews.absenceReview.close')}
      </SoftButton>
    </div>
  ) : (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="text-xs text-ink-low">
        {report ? t('reviews.absenceReview.showing', { count: report.rows.length }) : ''}
      </span>
      <SoftButton variant="ghost" size="sm" onClick={() => onClose?.()}>
        {t('reviews.absenceReview.close')}
      </SoftButton>
    </div>
  )

  const content = (
    <div>
      {detail && detailRow && detailSlip ? (
        <SlipDetail
          row={detailRow}
          slip={detailSlip}
          kind={detail.kind}
          salaryPeriod={salaryPeriod}
          onSaveNote={handleSaveNote(detail.kind)}
          savingNoteKey={savingNoteKey}
          readOnly={!canEditNotes}
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
          title={t('reviews.absenceReview.noRows')}
          body={t('reviews.absenceReview.noRowsBody')}
        />
      ) : (
        <div className="flex flex-col gap-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <ReviewSummary
              icon={<ClipboardCheck className="size-4" />}
              title={t('reviews.absenceReview.employees')}
              value={String(report.totals.employees)}
              hint={t('reviews.absenceReview.employeesHint')}
            />
            <ReviewSummary
              icon={<Wallet className="size-4" />}
              title={t('reviews.absenceReview.salaryExpected')}
              value={formatNumber(report.totals.salaryExpectedDeductions)}
              hint={t('reviews.absenceReview.salaryExpectedHint', {
                period: monthLabel(report.salaryPeriod)
              })}
            />
            <ReviewSummary
              icon={<Gift className="size-4" />}
              title={t('reviews.absenceReview.incentiveExpected')}
              value={formatNumber(report.totals.incentiveExpectedDeductions)}
              hint={t('reviews.absenceReview.incentiveExpectedHint', {
                period: monthLabel(report.period)
              })}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-line">
            <DataTable size="md">
              <DataTableHead>
                <DataTableHeadRow>
                  <DataTableHeadCell className="w-[96px]" align="center">
                    {t('reviews.absenceReview.employeeCode')}
                  </DataTableHeadCell>
                  <DataTableHeadCell>{t('reviews.absenceReview.employeeName')}</DataTableHeadCell>
                  <DataTableHeadCell className="w-[180px]">
                    {t('reviews.absenceReview.departmentName')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[130px]" align="end">
                    {t('reviews.absenceReview.basicSalary')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[150px]" align="end">
                    {t('reviews.absenceReview.totalEarned')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[150px]" align="center">
                    {t('reviews.absenceReview.absenceDays')}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[220px]" align="center">
                    {t('reviews.absenceReview.actions')}
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
                    <td className="px-5 py-3 text-end">
                      <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink-med">
                        {formatNumber(row.basicSalary)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-end">
                      <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink-med">
                        {formatNumber(row.totalEarned)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <Badge tone="gold" className="px-2 py-0.5 text-[10px]">
                          {t('reviews.absenceReview.withPermission')}{' '}
                          {formatNumber(row.withPermission)}
                        </Badge>
                        <Badge tone="rose" className="px-2 py-0.5 text-[10px]">
                          {t('reviews.absenceReview.withoutPermission')}{' '}
                          {formatNumber(row.withoutPermission)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <ReviewAction
                          icon={<Wallet className="size-3.5" />}
                          label={t('reviews.absenceReview.salaryAction')}
                          slip={row.salary}
                          tone="teal"
                          onClick={() => setDetail({ kind: 'salary', employeeId: row.employeeId })}
                        />
                        <ReviewAction
                          icon={<Gift className="size-3.5" />}
                          label={t('reviews.absenceReview.incentiveAction')}
                          slip={row.incentive}
                          tone="violet"
                          onClick={() => setDetail({ kind: 'incentive', employeeId: row.employeeId })}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </DataTableBody>
            </DataTable>
          </div>

          <p className="rounded-xl border border-line bg-surface-soft/50 px-4 py-3 text-[11px] leading-relaxed text-ink-low">
            {t('reviews.absenceReview.expectedFormula')}{' '}
            {t('reviews.absenceReview.incentiveFormula')}
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
  icon,
  label,
  slip,
  tone,
  onClick
}: {
  icon: React.ReactNode
  label: string
  slip: AbsenceReviewSlip
  tone: 'teal' | 'violet'
  onClick: () => void
}) {
  const mismatch = hasVariance(slip)
  return (
    <SoftButton
      variant="subtle"
      size="sm"
      icon={icon}
      className={cn(
        'h-8 gap-1.5 border px-2.5 text-[11px]',
        tone === 'teal'
          ? 'border-teal-400/20 text-teal-300 hover:bg-teal-500/10'
          : 'border-violet-400/20 text-violet-300 hover:bg-violet-500/10'
      )}
      onClick={onClick}
    >
      {label}
      <span
        className={cn(
          'size-1.5 rounded-full',
          !slip.available
            ? 'bg-ink-low/40'
            : mismatch
              ? 'bg-amber-400 shadow-[0_0_6px_currentColor]'
              : 'bg-teal-400/70'
        )}
      />
    </SoftButton>
  )
}

function SlipDetail({
  row,
  slip,
  kind,
  salaryPeriod,
  onSaveNote,
  savingNoteKey,
  readOnly
}: {
  row: AbsenceReviewRow
  slip: AbsenceReviewSlip
  kind: DetailKind
  salaryPeriod: string
  onSaveNote: (itemKey: string, label: string, note: string) => void
  savingNoteKey: string | null
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const netDifference = slip.totals.difference

  const noteText = (note: AbsenceReviewSlip['notes'][number]): string => {
    switch (note) {
      case 'salarySlipMissing':
        return t('reviews.absenceReview.salarySlipMissing', {
          period: monthLabel(slip.period)
        })
      case 'incentiveSlipMissing':
        return t('reviews.absenceReview.incentiveSlipMissing', {
          period: monthLabel(slip.period)
        })
      case 'rateMissing':
        return t('reviews.absenceReview.rateMissing')
      case 'basicMissing':
        return t('reviews.absenceReview.basicMissing')
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
                {t('reviews.absenceReview.basicSalary')}:{' '}
                <b dir="ltr" className="tabular-nums text-ink-med">
                  {formatNumber(row.basicSalary)}
                </b>
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">
              {t('reviews.absenceReview.withPermission')} {formatNumber(row.withPermission)}{' '}
              {t('reviews.absenceReview.days')}
            </Badge>
            <Badge tone="rose">
              {t('reviews.absenceReview.withoutPermission')}{' '}
              {formatNumber(row.withoutPermission)} {t('reviews.absenceReview.days')}
            </Badge>
            <Badge tone="neutral">
              {t('reviews.absenceReview.period')}: {monthLabel(slip.period)}
            </Badge>
            {kind === 'incentive' && slip.rate !== null && (
              <Badge tone="violet">
                {t('reviews.absenceReview.rate')}: {(slip.rate * 100).toFixed(1)}% ·{' '}
                {slip.rateSource === 'employee'
                  ? t('reviews.absenceReview.rateEmployee')
                  : t('reviews.absenceReview.rateDepartment')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <NetCard
          label={t('reviews.absenceReview.actualNet')}
          value={formatNumber(slip.totals.actualNet)}
          tone="neutral"
        />
        <NetCard
          label={t('reviews.absenceReview.expectedNet')}
          value={formatNumber(slip.totals.expectedNet)}
          tone="teal"
        />
        <NetCard
          label={t('reviews.absenceReview.netDifference')}
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
              <DataTableHeadCell>{t('reviews.absenceReview.item')}</DataTableHeadCell>
              <DataTableHeadCell className="w-[150px]" align="end">
                {t('reviews.absenceReview.actual')}
              </DataTableHeadCell>
              <DataTableHeadCell className="w-[150px]" align="end">
                {t('reviews.absenceReview.expected')}
              </DataTableHeadCell>
              <DataTableHeadCell className="w-[170px]" align="end">
                {t('reviews.absenceReview.difference')}
              </DataTableHeadCell>
              <DataTableHeadCell className="w-[240px]">
                {t('reviews.absenceReview.notes')}
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
                        {t('reviews.absenceReview.informational')}
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
                          ? t('reviews.absenceReview.match')
                          : t('reviews.absenceReview.mismatch')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <NoteCell
                    note={item.note ?? ''}
                    saving={savingNoteKey === `${row.employeeId}:${slip.type}:${item.key}`}
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
                {t('reviews.absenceReview.total')}
              </DataTableFootCell>
              <DataTableFootCell className="tabular-nums" align="end" dir="ltr">
                {formatNumber(slip.totals.actualNet)}
              </DataTableFootCell>
              <DataTableFootCell className="tabular-nums" align="end" dir="ltr">
                {formatNumber(slip.totals.expectedNet)}
              </DataTableFootCell>
              <DataTableFootCell
                className={cn('tabular-nums', differenceTone(netDifference))}
                align="end"
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
        <p>{t('reviews.absenceReview.notesHint')}</p>
        <p>{t('reviews.absenceReview.expectedFormula')}</p>
        {kind === 'salary' && <p>{t('reviews.absenceReview.salaryPenaltyFormula')}</p>}
        <p>{t('reviews.absenceReview.unrelatedNote')}</p>
        <p>{t('reviews.absenceReview.differenceNote')}</p>
        {kind === 'salary' && (
          <p>
            {t('reviews.absenceReview.description', {
              period: monthLabel(addMonths(salaryPeriod, -1)),
              salaryPeriod: monthLabel(salaryPeriod)
            })}
          </p>
        )}
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
        placeholder={t('reviews.absenceReview.notePlaceholder')}
        aria-label={t('reviews.absenceReview.notes')}
        className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface-base px-2 text-[11px] text-ink-med placeholder:text-ink-low/50 focus:border-accent-400/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      {!readOnly && (
        <button
          type="button"
          onClick={submit}
          disabled={!dirty || saving}
          title={t('reviews.absenceReview.saveNote')}
          aria-label={t('reviews.absenceReview.saveNote')}
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
  tone: 'neutral' | 'teal' | 'rose' | 'amber'
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
            : tone === 'rose'
              ? 'text-rose-300'
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
