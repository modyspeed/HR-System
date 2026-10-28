import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  ListTree,
  RefreshCw,
  Search,
  Wallet
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  ExportPayload,
  PayrollItemMatrixRow,
  PayrollItemsPeriod
} from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { useDebounce } from '@/hooks/useDebounce'
import { usePermission } from '@/hooks/usePermission'
import { staggerItem, spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
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
import { ItemBreakdownModal, type ItemBreakdownKind } from './ItemBreakdownModal'

/** «2026-09» → «09 / 2026». */
function monthLabel(period: string): string {
  const [year, month] = period.split('-')
  return `${month} / ${year}`
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * مصفوفة المفردات: صف لكل موظف وعمود لكل بند من بنود مفردات المرتب/الحافز
 * للشهر المختار — تقرأ من جدول PayrollItem مباشرة.
 */
export function PayrollItemsMatrix() {
  const { t, i18n } = useTranslation()
  const canExtract = usePermission('payrolls.create')

  const [type, setType] = useState<'salary' | 'incentive'>('salary')
  const [period, setPeriod] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [departmentId, setDepartmentId] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [breakdown, setBreakdown] = useState<{
    kind: ItemBreakdownKind
    row: PayrollItemMatrixRow
  } | null>(null)

  const periodsQuery = useQuery({
    queryKey: ['payrolls', 'items', 'periods'],
    queryFn: () => api.payrolls.items.periods({})
  })
  const periods = useMemo<PayrollItemsPeriod[]>(
    () => periodsQuery.data ?? [],
    [periodsQuery.data]
  )

  const typePeriods = useMemo(
    () => periods.filter((item) => item.type === type),
    [periods, type]
  )

  // أول شهر متاح لهذا النوع يُختار تلقائيًا.
  const activePeriod =
    period && typePeriods.some((item) => item.period === period)
      ? period
      : (typePeriods[0]?.period ?? '')

  const departmentsQuery = useQuery({
    queryKey: [
      'departments',
      'list',
      { search: undefined, isActive: null, sort: 'code', order: 'asc' }
    ],
    queryFn: () => api.departments.list({})
  })
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data])

  const matrixQuery = useQuery({
    queryKey: [
      'payrolls',
      'items',
      'matrix',
      type,
      activePeriod,
      debouncedSearch,
      departmentId
    ],
    queryFn: () =>
      api.payrolls.items.list({
        type,
        period: activePeriod,
        search: debouncedSearch || undefined,
        departmentId: departmentId || undefined
      }),
    enabled: Boolean(activePeriod)
  })

  const matrix = matrixQuery.data ?? null
  const isLoading = matrixQuery.isLoading || matrixQuery.isFetching

  const earningColumns = useMemo(
    () => (matrix?.columns ?? []).filter((column) => column.kind === 'earning'),
    [matrix]
  )
  const deductionColumns = useMemo(
    () => (matrix?.columns ?? []).filter((column) => column.kind === 'deduction'),
    [matrix]
  )

  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (!matrix || matrix.rows.length === 0) return null
    const typeLabel = t(`payrolls.types.${matrix.type}`)
    const subtitle = [
      t('export.count', { count: matrix.rows.length }),
      typeLabel,
      monthLabel(matrix.period)
    ]
      .filter(Boolean)
      .join(' — ')

    return {
      scope: 'payrolls',
      fileName: `payroll-items-${matrix.type}-${matrix.period}`,
      title: `${t('reviews.items.title')} — ${typeLabel} ${monthLabel(matrix.period)}`,
      subtitle,
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'code', label: t('reviews.items.employeeCode'), width: 12, align: 'center' },
        { key: 'name', label: t('reviews.items.employeeName'), width: 30 },
        { key: 'department', label: t('reviews.items.departmentName'), width: 22 },
        ...matrix.columns.map((column) => ({
          key: column.key,
          label: column.label,
          width: 16,
          format: '#,##0.00',
          align: 'end' as const
        })),
        {
          key: 'balance',
          label: t('reviews.items.balance'),
          width: 14,
          format: '#,##0.00',
          align: 'end' as const
        },
        {
          key: 'earnings',
          label: t('reviews.items.earningsTotal'),
          width: 16,
          format: '#,##0.00',
          align: 'end' as const
        },
        {
          key: 'deductions',
          label: t('reviews.items.deductionsTotal'),
          width: 16,
          format: '#,##0.00',
          align: 'end' as const
        },
        {
          key: 'net',
          label: t('reviews.items.net'),
          width: 16,
          format: '#,##0.00',
          align: 'end' as const
        }
      ],
      rows: matrix.rows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.departmentName ?? '',
        ...row.values.map((value) => (value === null ? null : value)),
        row.balance,
        row.earningsTotal,
        row.deductionsTotal,
        row.netSalary
      ])
    }
  }, [matrix, t, i18n])

  const hasFilters = Boolean(debouncedSearch || departmentId)

  const runExtraction = async () => {
    if (!activePeriod) return
    setExtracting(true)
    try {
      const result = await api.payrolls.items.sync({ type, period: activePeriod })
      toast.success(t('reviews.items.extractedDone', { count: result.items }))
      void matrixQuery.refetch()
      void periodsQuery.refetch()
    } catch (error) {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* شريط الاختيار */}
      <GlassCard withLightBar={false} className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-line bg-surface-soft p-1">
              {(['salary', 'incentive'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setType(key)
                    setPeriod('')
                  }}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    type === key
                      ? 'bg-surface-strong text-ink-high shadow-[var(--shadow-raised),var(--shadow-glow)]'
                      : 'text-muted hover:text-ink-high'
                  )}
                >
                  {t(`payrolls.types.${key}`)}
                </button>
              ))}
            </div>

            <Select
              containerClassName="w-40"
              value={activePeriod}
              onChange={(event) => setPeriod(event.target.value)}
              options={typePeriods.map((item) => ({
                value: item.period,
                label: monthLabel(item.period)
              }))}
              placeholder={t('reviews.items.allPeriods')}
              disabled={typePeriods.length === 0}
            />

            <div className="flex-1" />

            {matrix && matrix.pending > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300">
                <AlertTriangle className="size-3.5" />
                {t('reviews.items.pending', { count: matrix.pending })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              containerClassName="flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('reviews.items.searchPlaceholder')}
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
              placeholder={t('reviews.items.allDepartments')}
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
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-ink-low lg:inline">
                {t('reviews.items.clickHint')}
              </span>
              <ExportMenu payload={exportPayload} />
              {matrix && matrix.pending > 0 && (
                <SoftButton
                  variant="ghost"
                  loading={extracting}
                  icon={extracting ? undefined : <RefreshCw className="size-4" />}
                  disabled={!canExtract || !activePeriod}
                  onClick={() => void runExtraction()}
                >
                  {t('reviews.items.extractPending', { count: matrix.pending })}
                </SoftButton>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* شريط الملخص */}
      {matrix && matrix.rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<ClipboardList className="size-4" />}
            title={t('reviews.items.employees')}
            value={String(matrix.rows.length)}
            hint={matrix.fileName ?? ''}
          />
          <SummaryCard
            icon={<Banknote className="size-4" />}
            title={t('reviews.items.items')}
            value={String(matrix.columns.length)}
            hint={t('reviews.items.extracted', {
              extracted: matrix.extracted,
              total: matrix.rows.length
            })}
          />
          <SummaryCard
            icon={<Wallet className="size-4" />}
            title={t('reviews.items.earningsTotal')}
            value={formatNumber(
              earningColumns.reduce((sum, column) => sum + column.total, 0)
            )}
          />
          <SummaryCard
            icon={<Wallet className="size-4" />}
            title={t('reviews.items.deductionsTotal')}
            value={formatNumber(
              deductionColumns.reduce((sum, column) => sum + column.total, 0)
            )}
          />
        </div>
      )}

      {/* المصفوفة */}
      <GlassCard withLightBar={false} className="overflow-hidden">
        {!activePeriod ? (
          <EmptyState
            icon={<Banknote className="size-7" />}
            title={t('reviews.items.noPeriods')}
            body={t('reviews.items.noPeriodsBody')}
          />
        ) : isLoading && !matrix ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : !matrix || matrix.rows.length === 0 ? (
          <EmptyState
            icon={<Banknote className="size-7" />}
            title={hasFilters ? t('reviews.items.noResults') : t('reviews.items.emptyTitle')}
            body={hasFilters ? t('reviews.items.noResultsBody') : t('reviews.items.emptyBody')}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeadRow>
                <DataTableHeadCell className="w-[104px]" align="center">
                    {t('reviews.items.employeeCode')}
                </DataTableHeadCell>
                <DataTableHeadCell>
                    {t('reviews.items.employeeName')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[190px]">
                    {t('reviews.items.departmentName')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[190px] text-teal-300" align="center">
                    <span className="inline-flex items-center gap-1.5">
                      <ListTree className="size-3.5 opacity-70" />
                      {t('reviews.items.earningsTotal')}
                    </span>
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[190px] text-rose-300" align="center">
                    <span className="inline-flex items-center gap-1.5">
                      <ListTree className="size-3.5 opacity-70" />
                      {t('reviews.items.deductionsTotal')}
                    </span>
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[170px]" align="center">
                    {t('reviews.items.net')}
                </DataTableHeadCell>
              </DataTableHeadRow>
            </DataTableHead>

            <DataTableBody>
                {matrix.rows.map((row) => (
                  <motion.tr
                    key={row.entryId}
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
                    </td>
                    <td className="px-5 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => setBreakdown({ kind: 'earning', row })}
                        className="focus-ring w-full rounded-lg border border-transparent px-2 py-1.5 text-sm font-bold tabular-nums text-teal-300 transition-colors hover:border-teal-400/30 hover:bg-teal-500/10"
                      >
                        {formatNumber(row.earningsTotal)}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => setBreakdown({ kind: 'deduction', row })}
                        className="focus-ring w-full rounded-lg border border-transparent px-2 py-1.5 text-sm font-bold tabular-nums text-rose-300 transition-colors hover:border-rose-400/30 hover:bg-rose-500/10"
                      >
                        {formatNumber(row.deductionsTotal)}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-end">
                      <span dir="ltr" className="text-sm font-bold tabular-nums text-ink-high">
                        {formatNumber(row.netSalary)}
                      </span>
                    </td>
                  </motion.tr>
                ))}
            </DataTableBody>

            <DataTableFoot>
              <DataTableFootRow>
                <DataTableFootCell className="text-ink-low">
                    {matrix.rows.length}
                </DataTableFootCell>
                <DataTableFootCell align="start">{t('reviews.items.total')}</DataTableFootCell>
                <DataTableFootCell />
                <DataTableFootCell className="tabular-nums text-teal-300" align="center" dir="ltr">
                    {formatNumber(
                      matrix.rows.reduce((sum, row) => sum + row.earningsTotal, 0)
                    )}
                </DataTableFootCell>
                <DataTableFootCell className="tabular-nums text-rose-300" align="center" dir="ltr">
                    {formatNumber(
                      matrix.rows.reduce((sum, row) => sum + row.deductionsTotal, 0)
                    )}
                </DataTableFootCell>
                <DataTableFootCell className="tabular-nums" align="center" dir="ltr">
                    {formatNumber(
                      matrix.rows.reduce((sum, row) => sum + (row.netSalary ?? 0), 0)
                    )}
                </DataTableFootCell>
              </DataTableFootRow>
            </DataTableFoot>
          </DataTable>
        )}
      </GlassCard>

      <ItemBreakdownModal
        open={breakdown !== null}
        kind={breakdown?.kind ?? null}
        row={breakdown?.row ?? null}
        columns={matrix?.columns ?? []}
        periodLabel={activePeriod ? monthLabel(activePeriod) : ''}
        onClose={() => setBreakdown(null)}
      />
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
