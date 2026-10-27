import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ListChecks,
  Percent,
  Search,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react'
import type {
  ExportPayload,
  NatureAllowanceRow,
  NatureAllowanceStatus,
  NatureAllowanceView
} from '@shared/types'
import { api } from '@/lib/ipc'
import { useDebounce } from '@/hooks/useDebounce'
import { staggerItem, spring } from '@/lib/motion'
import { cn, formatMoney } from '@/lib/utils'
import { GlassCard } from '@/components/ui/GlassCard'
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
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { ExportMenu } from '@/components/ui/ExportMenu'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'

/** «2026-09» → «09 / 2026». */
function monthLabel(period: string): string {
  const [year, month] = period.split('-')
  return `${month} / ${year}`
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
}

function formatSigned(value: number | null): string {
  if (value === null) return '—'
  if (Math.abs(value) < 0.005) return formatMoney(0)
  return `${value > 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`
}

const STATUS_STYLES: Record<NatureAllowanceStatus, string> = {
  match: 'border-teal-400/30 bg-teal-500/10 text-teal-300',
  mismatch: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  noAllowance: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
  unexpected: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  departmentPctMissing: 'border-line bg-surface-soft text-ink-med',
  basicMissing: 'border-line bg-surface-soft text-ink-med'
}

const VIEWS: { key: NatureAllowanceView; labelKey: string; icon: typeof Users }[] = [
  { key: 'flagged', labelKey: 'reviews.nature.viewFlagged', icon: AlertTriangle },
  { key: 'all', labelKey: 'reviews.nature.viewAll', icon: ListChecks }
]

/**
 * مراجعة بدل الطبيعة: من يأخذ بدل طبيعة بنسبة مختلفة عن نسبة قسمه في شهر
 * مرتب محدد. النسبة الفعلية = البدل ÷ الأساسي × 100 من ظرف المرتب نفسه.
 */
export function NatureAllowanceReport() {
  const { t, i18n } = useTranslation()

  const [view, setView] = useState<NatureAllowanceView>('flagged')
  const [period, setPeriod] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [departmentId, setDepartmentId] = useState('')

  const departmentsQuery = useQuery({
    queryKey: [
      'departments',
      'list',
      { search: undefined, isActive: null, sort: 'code', order: 'asc' }
    ],
    queryFn: () => api.departments.list({})
  })
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data])

  const reportQuery = useQuery({
    queryKey: ['natureAllowance', 'list', view, period, debouncedSearch, departmentId],
    queryFn: () =>
      api.natureAllowance.list({
        view,
        period: period || undefined,
        search: debouncedSearch || undefined,
        departmentId: departmentId || undefined
      })
  })

  const report = reportQuery.data ?? null
  const isLoading = reportQuery.isLoading
  const activePeriod = report?.period ?? ''
  const hasFilters = Boolean(debouncedSearch || departmentId)
  const isFlagged = view === 'flagged'

  const statusLabel = (row: NatureAllowanceRow) => t(`reviews.nature.status.${row.status}`)

  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (!report || !report.period || report.rows.length === 0) return null
    return {
      scope: 'payrolls',
      fileName: `nature-allowance-${report.period}${isFlagged ? '-flagged' : ''}`,
      title: `${t('reviews.nature.title')} — ${monthLabel(report.period)}`,
      subtitle: [
        isFlagged ? t('reviews.nature.viewFlagged') : t('reviews.nature.viewAll'),
        t('export.count', { count: report.rows.length })
      ].join(' — '),
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'code', label: t('reviews.nature.employeeCode'), width: 12, align: 'center' },
        { key: 'name', label: t('reviews.nature.employeeName'), width: 28 },
        { key: 'department', label: t('reviews.nature.departmentName'), width: 22 },
        { key: 'basic', label: t('reviews.nature.basic'), width: 14, align: 'center' },
        { key: 'allowance', label: t('reviews.nature.paid'), width: 14, align: 'center' },
        { key: 'actualPct', label: t('reviews.nature.paidPct'), width: 12, align: 'center' },
        { key: 'deptPct', label: t('reviews.nature.departmentPct'), width: 12, align: 'center' },
        { key: 'expected', label: t('reviews.nature.expected'), width: 14, align: 'center' },
        { key: 'difference', label: t('reviews.nature.difference'), width: 14, align: 'center' },
        { key: 'status', label: t('reviews.nature.statusLabel'), width: 18, align: 'center' },
        { key: 'matched', label: t('reviews.nature.matchesDepartment'), width: 26 }
      ],
      rows: report.rows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.departmentName ?? '',
        row.basicSalary,
        row.allowance ?? 0,
        formatPct(row.actualPct),
        formatPct(row.departmentPct),
        row.expectedAllowance,
        row.difference,
        statusLabel(row),
        row.matchedDepartments.join('، ')
      ])
    }
    // statusLabel depends only on t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, t, i18n, isFlagged])

  return (
    <div className="flex flex-col gap-5">
      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-2">
        {VIEWS.map((item) => {
          const Icon = item.icon
          const active = item.key === view
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setView(item.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                active
                  ? 'border-line-strong bg-surface-strong text-ink-high shadow-[var(--shadow-raised),var(--shadow-rim)]'
                  : 'border-line bg-surface-soft text-muted hover:text-ink-high'
              )}
            >
              <Icon className="size-4" />
              {t(item.labelKey)}
            </button>
          )
        })}
      </motion.div>

      <GlassCard withLightBar={false} className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              containerClassName="w-44"
              value={activePeriod}
              onChange={(event) => setPeriod(event.target.value)}
              options={(report?.periods ?? []).map((item) => ({
                value: item,
                label: monthLabel(item)
              }))}
              placeholder={t('reviews.nature.choosePeriod')}
              disabled={!report || report.periods.length === 0}
            />

            {report && report.period && (
              <span className="truncate text-[11px] text-ink-low">
                {t('reviews.nature.showing', {
                  flagged: report.totals.flagged,
                  total: report.totals.scoped
                })}
              </span>
            )}

            <div className="flex-1" />

            {report && report.totals.flagged > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300">
                <AlertTriangle className="size-3.5" />
                {t('reviews.nature.flaggedCount', { count: report.totals.flagged })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              containerClassName="flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('reviews.nature.searchPlaceholder')}
              icon={<Search className="size-4" />}
            />
            <Select
              containerClassName="lg:w-56"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              options={departments.map((department) => ({
                value: department.id,
                label: department.name
              }))}
              placeholder={t('reviews.nature.allDepartments')}
            />
            {hasFilters && (
              <SoftButton
                variant="subtle"
                onClick={() => {
                  setSearch('')
                  setDepartmentId('')
                }}
              >
                {t('payrolls.clearFilters')}
              </SoftButton>
            )}
            <ExportMenu payload={exportPayload} />
          </div>
        </div>
      </GlassCard>

      {report && report.period && report.totals.scoped > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<AlertTriangle className="size-4" />}
            title={t('reviews.nature.flagged')}
            value={String(report.totals.flagged)}
            hint={t('reviews.nature.flaggedHint', { total: report.totals.scoped })}
          />
          <SummaryCard
            icon={<TrendingUp className="size-4" />}
            title={t('reviews.nature.overpaid')}
            value={formatMoney(report.totals.overpaid)}
            hint={t('reviews.nature.overpaidHint')}
          />
          <SummaryCard
            icon={<TrendingDown className="size-4" />}
            title={t('reviews.nature.underpaid')}
            value={formatMoney(Math.abs(report.totals.underpaid))}
            hint={t('reviews.nature.underpaidHint')}
          />
          <SummaryCard
            icon={<Percent className="size-4" />}
            title={t('reviews.nature.pctMissing')}
            value={String(report.totals.pctMissing)}
            hint={t('reviews.nature.pctMissingHint')}
          />
        </div>
      )}

      <GlassCard withLightBar={false} className="overflow-hidden">
        {isLoading && !report ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : !report || !report.period ? (
          <EmptyState
            icon={<Percent className="size-7" />}
            title={t('reviews.nature.noPeriodsTitle')}
            body={t('reviews.nature.noPeriodsBody')}
          />
        ) : report.rows.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-7" />}
            title={
              isFlagged && !hasFilters
                ? t('reviews.nature.allMatchTitle')
                : t('reviews.nature.noResults')
            }
            body={
              isFlagged && !hasFilters
                ? t('reviews.nature.allMatchBody')
                : t('reviews.nature.noResultsBody')
            }
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeadRow>
                <DataTableHeadCell className="w-[96px]" align="center">
                  {t('reviews.nature.employeeCode')}
                </DataTableHeadCell>
                <DataTableHeadCell>{t('reviews.nature.employeeName')}</DataTableHeadCell>
                <DataTableHeadCell className="w-[170px]">
                  {t('reviews.nature.departmentName')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[120px]" align="center">
                  {t('reviews.nature.basic')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[120px]" align="center">
                  {t('reviews.nature.paid')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[150px] text-accent-300" align="center">
                  {t('reviews.nature.pctCompare')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[120px]" align="center">
                  {t('reviews.nature.expected')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[120px]" align="center">
                  {t('reviews.nature.difference')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[180px]" align="center">
                  {t('reviews.nature.statusLabel')}
                </DataTableHeadCell>
              </DataTableHeadRow>
            </DataTableHead>

            <DataTableBody>
              {report.rows.map((row) => (
                <motion.tr
                  key={row.employeeId}
                  variants={staggerItem}
                  transition={spring}
                  className="group transition-colors hover:bg-surface-soft"
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
                    {row.executive && (
                      <span className="mt-0.5 block truncate text-[10px] text-ink-low">
                        {row.pctSourceDepartmentName
                          ? t('reviews.nature.executiveSource', {
                              name: row.pctSourceDepartmentName
                            })
                          : t('reviews.nature.executiveNoSource')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span dir="ltr" className="text-xs tabular-nums text-ink-med">
                      {formatMoney(row.basicSalary)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink-high">
                      {formatMoney(row.allowance ?? 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span dir="ltr" className="inline-flex items-center gap-1.5 text-xs tabular-nums">
                      <span
                        className={cn(
                          'font-semibold',
                          row.status === 'match' ? 'text-ink-high' : 'text-amber-300'
                        )}
                      >
                        {formatPct(row.actualPct)}
                      </span>
                      <span className="text-ink-low">/</span>
                      <span className="text-ink-med">{formatPct(row.departmentPct)}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span dir="ltr" className="text-xs tabular-nums text-ink-med">
                      {formatMoney(row.expectedAllowance)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      dir="ltr"
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        row.difference === null || Math.abs(row.difference) < 0.005
                          ? 'text-ink-low'
                          : row.difference > 0
                            ? 'text-amber-300'
                            : 'text-rose-300'
                      )}
                    >
                      {formatSigned(row.difference)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                        STATUS_STYLES[row.status]
                      )}
                    >
                      {statusLabel(row)}
                    </span>
                    {row.matchedDepartments.length > 0 && (
                      <span
                        dir="auto"
                        className="mt-1 block truncate text-[10px] text-ink-low"
                        title={row.matchedDepartments.join('، ')}
                      >
                        {t('reviews.nature.matches', { names: row.matchedDepartments.join('، ') })}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </DataTableBody>

            <DataTableFoot>
              <DataTableFootRow>
                <DataTableFootCell className="text-ink-low">{report.rows.length}</DataTableFootCell>
                <DataTableFootCell>{t('reviews.nature.employees')}</DataTableFootCell>
                <DataTableFootCell />
                <DataTableFootCell />
                <DataTableFootCell className="tabular-nums" dir="ltr">
                  {formatMoney(report.rows.reduce((sum, row) => sum + (row.allowance ?? 0), 0))}
                </DataTableFootCell>
                <DataTableFootCell />
                <DataTableFootCell className="tabular-nums" dir="ltr">
                  {formatMoney(
                    report.rows.reduce((sum, row) => sum + (row.expectedAllowance ?? 0), 0)
                  )}
                </DataTableFootCell>
                <DataTableFootCell className="tabular-nums text-accent-300" dir="ltr">
                  {formatSigned(report.rows.reduce((sum, row) => sum + (row.difference ?? 0), 0))}
                </DataTableFootCell>
                <DataTableFootCell />
              </DataTableFootRow>
            </DataTableFoot>
          </DataTable>
        )}
      </GlassCard>

      <p className="px-1 text-[11px] leading-relaxed text-ink-low">{t('reviews.nature.formula')}</p>
    </div>
  )
}

function SummaryCard({
  icon,
  title,
  value,
  hint
}: {
  icon: React.ReactNode
  title: string
  value: string
  hint?: string
}) {
  return (
    <GlassCard withLightBar={false} className="flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-soft text-accent-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-ink-low">{title}</p>
        <p dir="ltr" className="truncate text-base font-bold tabular-nums text-ink-high">
          {value}
        </p>
        {hint && <p className="truncate text-[10px] text-ink-low">{hint}</p>}
      </div>
    </GlassCard>
  )
}
