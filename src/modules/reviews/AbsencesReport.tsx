import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarX,
  RefreshCw,
  Search,
  UserX
} from 'lucide-react'
import { toast } from 'sonner'
import type { AbsencesReport, ExportPayload, PayrollItemsPeriod } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { staggerItem, spring } from '@/lib/motion'
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
import { AbsenceReviewModal } from './AbsenceReviewModal'

/** «2026-09» → «09 / 2026». */
function monthLabel(period: string): string {
  const [year, month] = period.split('-')
  return `${month} / ${year}`
}

/** الأيام قد تكون كسرية (نصف يوم) — نعرضها بلا كسور زائدة. */
function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * تقرير الغيابات: من غاب عن الشهر المختار، وكم **يومًا** غاب بإذن أو بدون إذن.
 *
 * الأيام تُقرأ من رأس ظرف الحافز («غياب بدون اذن:- ٨» و«غياب باذن:- ٠٫٥»)
 * وتُخزَّن على الظرف عند الاستخراج، فهي بالأيام لا بالمبالغ.
 */
export function AbsencesReport() {
  const { t, i18n } = useTranslation()
  const canExtract = usePermission('payrolls.create')

  const [period, setPeriod] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [departmentId, setDepartmentId] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [mode, setMode] = useState<'report' | 'review'>('report')

  const periodsQuery = useQuery({
    queryKey: ['payrolls', 'items', 'periods'],
    queryFn: () => api.payrolls.items.periods({})
  })

  // شهور الحافز — هي التي تحمل أيام الغياب في رأس الظرف.
  const periods = useMemo<PayrollItemsPeriod[]>(() => {
    const seen = new Map<string, PayrollItemsPeriod>()
    for (const item of periodsQuery.data ?? []) {
      if (item.type !== 'incentive') continue
      if (!seen.has(item.period)) seen.set(item.period, item)
    }
    return [...seen.values()]
  }, [periodsQuery.data])

  const activePeriod =
    period && periods.some((item) => item.period === period) ? period : (periods[0]?.period ?? '')

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
    queryKey: ['payrolls', 'items', 'absences', activePeriod, debouncedSearch, departmentId],
    queryFn: () =>
      api.payrolls.items.absences({
        period: activePeriod,
        search: debouncedSearch || undefined,
        departmentId: departmentId || undefined
      }),
    enabled: Boolean(activePeriod),
    // أثناء الفحص (فحصُ الإقلاع أو استخراجٌ يدوي) نحدّث التقرير دوريًا حتى
    // ينعكس الفحص فور انتهائه بدل بقاء الشاشة على حالة قديمة.
    refetchInterval: (query) => {
      const data = query.state.data as AbsencesReport | undefined
      return data && !data.scanned ? 3000 : false
    }
  })

  const report = reportQuery.data ?? null
  const isLoading = reportQuery.isLoading || reportQuery.isFetching
  const hasFilters = Boolean(debouncedSearch || departmentId)
  const hasIncentiveSlip = report?.slipTypes.includes('incentive') ?? false
  const isScanned = report?.scanned ?? false

  const runExtraction = async () => {
    if (!activePeriod) return
    setExtracting(true)
    try {
      const result = await api.payrolls.items.syncAbsences({ period: activePeriod })
      toast.success(t('reviews.absences.extractDone', { count: result.absences }))
      void reportQuery.refetch()
    } catch (error) {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    } finally {
      setExtracting(false)
    }
  }

  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (!report || report.rows.length === 0) return null
    const subtitle = [
      t('export.count', { count: report.rows.length }),
      monthLabel(report.period)
    ]
      .filter(Boolean)
      .join(' — ')

    return {
      scope: 'payrolls',
      fileName: `absences-${report.period}`,
      title: `${t('reviews.absences.title')} — ${monthLabel(report.period)}`,
      subtitle,
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'code', label: t('reviews.absences.employeeCode'), width: 12, align: 'center' },
        { key: 'name', label: t('reviews.absences.employeeName'), width: 30 },
        { key: 'department', label: t('reviews.absences.departmentName'), width: 22 },
        {
          key: 'withPermission',
          label: t('reviews.absences.withPermission'),
          width: 16,
          format: '#,##0.##',
          align: 'end' as const
        },
        {
          key: 'withoutPermission',
          label: t('reviews.absences.withoutPermission'),
          width: 16,
          format: '#,##0.##',
          align: 'end' as const
        },
        {
          key: 'total',
          label: t('reviews.absences.total'),
          width: 16,
          format: '#,##0.##',
          align: 'end' as const
        }
      ],
      rows: report.rows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.departmentName ?? '',
        row.withPermission,
        row.withoutPermission,
        row.total
      ])
    }
  }, [report, t, i18n])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode('report')} className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors', mode === 'report' ? 'border-line-strong bg-surface-strong text-ink-high shadow-[var(--shadow-raised),var(--shadow-rim)]' : 'border-line bg-surface-soft text-muted hover:text-ink-high')}>{t('reviews.absences.title')}</button>
        <button type="button" onClick={() => setMode('review')} className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors', mode === 'review' ? 'border-line-strong bg-surface-strong text-ink-high shadow-[var(--shadow-raised),var(--shadow-rim)]' : 'border-line bg-surface-soft text-muted hover:text-ink-high')}>{t('reviews.absenceReview.title')}</button>
      </div>
      {/* شريط الاختيار */}
      <GlassCard withLightBar={false} className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              containerClassName="w-40"
              value={activePeriod}
              onChange={(event) => setPeriod(event.target.value)}
              options={periods.map((item) => ({
                value: item.period,
                label: monthLabel(item.period)
              }))}
              placeholder={t('reviews.absences.allPeriods')}
              disabled={periods.length === 0}
            />

            {report && report.fileNames.length > 0 && (
              <span className="truncate text-[11px] text-ink-low">
                {t('reviews.absences.sources')}: {report.fileNames.join(' · ')}
              </span>
            )}

            <div className="flex-1" />

            {report && report.employees > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-300">
                <UserX className="size-3.5" />
                {t('reviews.absences.absentCount', { count: report.employees })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              containerClassName="flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('reviews.absences.searchPlaceholder')}
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
              placeholder={t('reviews.absences.allDepartments')}
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
              {mode === 'report' && <ExportMenu payload={exportPayload} />}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* تنبيه: لم تُستخرج أيام الغياب بعد — مع زر للاستخراج الفوري */}
      {report && !isScanned && (
        <GlassCard withLightBar={false} className="border-amber-400/25 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-high">
                {t('reviews.absences.notScannedTitle')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-low">
                {t('reviews.absences.scanProgress', {
                  scanned: report.scannedBatches,
                  total: report.totalBatches
                })}
              </p>
              {report.missingFiles.length > 0 && (
                <p className="mt-1 text-xs leading-relaxed text-rose-300">
                  {t('reviews.absences.missingFiles', { files: report.missingFiles.join(' · ') })}
                </p>
              )}
            </div>
            <SoftButton
              variant="ghost"
              loading={extracting}
              icon={extracting ? undefined : <RefreshCw className="size-4" />}
              disabled={!canExtract || !activePeriod}
              onClick={() => void runExtraction()}
            >
              {t('reviews.absences.extract')}
            </SoftButton>
          </div>
        </GlassCard>
      )}

      {/* شريط الملخص */}
      {report && report.rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<UserX className="size-4" />}
            title={t('reviews.absences.absent')}
            value={String(report.employees)}
            hint={monthLabel(report.period)}
          />
          <SummaryCard
            icon={<CalendarCheck className="size-4" />}
            title={t('reviews.absences.withPermission')}
            value={formatDays(report.totals.withPermission)}
            hint={t('reviews.absences.daysUnit')}
          />
          <SummaryCard
            icon={<CalendarX className="size-4" />}
            title={t('reviews.absences.withoutPermission')}
            value={formatDays(report.totals.withoutPermission)}
            hint={t('reviews.absences.daysUnit')}
          />
          <SummaryCard
            icon={<UserX className="size-4" />}
            title={t('reviews.absences.total')}
            value={formatDays(report.totals.total)}
            hint={t('reviews.absences.daysUnit')}
          />
        </div>
      )}

      {/* مراجعة الغيابات (داخل الشاشة) */}
      {mode === 'review' && (
        <GlassCard withLightBar={false} className="p-5">
          <AbsenceReviewModal inline period={activePeriod} search={debouncedSearch} departmentId={departmentId} />
        </GlassCard>
      )}
      {mode === 'report' && (
      <>
      {/* جدول الغيابات */}
      <GlassCard withLightBar={false} className="overflow-hidden">
        {!activePeriod ? (
          <EmptyState
            icon={<UserX className="size-7" />}
            title={t('reviews.absences.noPeriods')}
            body={t('reviews.absences.noPeriodsBody')}
          />
        ) : isLoading && !report ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : !report || report.rows.length === 0 ? (
          <EmptyState
            icon={isScanned ? <UserX className="size-7" /> : <AlertTriangle className="size-7" />}
            title={
              !isScanned
                ? t('reviews.absences.notScannedTitle')
                : hasFilters
                  ? t('reviews.absences.noResults')
                  : hasIncentiveSlip
                    ? t('reviews.absences.emptyTitle')
                    : t('reviews.absences.noIncentiveTitle')
            }
            body={
              !isScanned
                ? t('reviews.absences.notScannedBody')
                : hasFilters
                  ? t('reviews.absences.noResultsBody')
                  : hasIncentiveSlip
                    ? t('reviews.absences.emptyBody')
                    : t('reviews.absences.noIncentiveBody')
            }
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeadRow>
                <DataTableHeadCell className="w-[104px]" align="center">
                    {t('reviews.absences.employeeCode')}
                </DataTableHeadCell>
                <DataTableHeadCell>
                    {t('reviews.absences.employeeName')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[190px]">
                    {t('reviews.absences.departmentName')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[180px] text-amber-300" align="center">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarCheck className="size-3.5 opacity-70" />
                      {t('reviews.absences.withPermission')}
                    </span>
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[180px] text-rose-300" align="center">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarX className="size-3.5 opacity-70" />
                      {t('reviews.absences.withoutPermission')}
                    </span>
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[150px]" align="center">
                    {t('reviews.absences.total')}
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
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span dir="ltr" className="text-sm font-semibold tabular-nums text-amber-300">
                        {formatDays(row.withPermission)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span dir="ltr" className="text-sm font-semibold tabular-nums text-rose-300">
                        {formatDays(row.withoutPermission)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span dir="ltr" className="text-sm font-bold tabular-nums text-ink-high">
                        {formatDays(row.total)}
                      </span>
                    </td>
                  </motion.tr>
                ))}
            </DataTableBody>

            <DataTableFoot>
              <DataTableFootRow>
                <DataTableFootCell className="text-ink-low">
                    {report.rows.length}
                </DataTableFootCell>
                <DataTableFootCell>{t('reviews.absences.total')}</DataTableFootCell>
                <DataTableFootCell />
                <DataTableFootCell className="tabular-nums text-amber-300" dir="ltr">
                    {formatDays(report.totals.withPermission)}
                </DataTableFootCell>
                <DataTableFootCell className="tabular-nums text-rose-300" dir="ltr">
                    {formatDays(report.totals.withoutPermission)}
                </DataTableFootCell>
                <DataTableFootCell className="tabular-nums" dir="ltr">
                    {formatDays(report.totals.total)}
                </DataTableFootCell>
              </DataTableFootRow>
            </DataTableFoot>
          </DataTable>
        )}
      </GlassCard>

      </>
      )}
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
