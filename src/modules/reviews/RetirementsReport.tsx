import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Award,
  CalendarClock,
  ClipboardCheck,
  Search,
  UserMinus,
  Users
} from 'lucide-react'
import type { ExportPayload, RetirementView } from '@shared/types'
import { api } from '@/lib/ipc'
import { useDebounce } from '@/hooks/useDebounce'
import { staggerItem, spring } from '@/lib/motion'
import { cn, formatDateOnly } from '@/lib/utils'
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
import { RetirementReviewModal } from './RetirementReviewModal'

/**
 * تقرير المعاشات — عرضان:
 *   - المحالون للمعاش: من أُحيل فعلاً (تلقائي أو يدوي).
 *   - المؤهلون للمعاش: من ما زال على قوة العمل وسيبلغ السن القانونية في سنة
 *     محددة (تاريخ متوقع)، للإجابة على «من سيخرج في 2027؟» قبل حدوثه.
 *
 * تاريخ المعاش هو تاريخ بلوغ السن القانونية (تاريخ الميلاد + 60 عامًا) لأنه
 * التاريخ الحقيقي للإحالة ويصلح للتجميع الشهري — بينما تاريخ تسجيل الحالة في
 * السجل قد يكون يومًا واحدًا لكل الموظفين القدامى (أول تشغيل).
 */
const VIEWS: { key: RetirementView; labelKey: string; icon: typeof UserMinus }[] = [
  { key: 'retired', labelKey: 'reviews.retirements.viewRetired', icon: UserMinus },
  { key: 'eligible', labelKey: 'reviews.retirements.viewEligible', icon: Users }
]

export function RetirementsReport() {
  const { t, i18n } = useTranslation()
  const language = i18n.language

  const [view, setView] = useState<RetirementView>('retired')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [departmentId, setDepartmentId] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)

  const isEligible = view === 'eligible'

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
    queryKey: ['retirements', 'list', view, year, month, debouncedSearch, departmentId],
    queryFn: () =>
      api.retirements.list({
        view,
        year: year ? Number(year) : undefined,
        month: year && month ? Number(month) : undefined,
        search: debouncedSearch || undefined,
        departmentId: departmentId || undefined
      })
  })

  const report = reportQuery.data ?? null
  const isLoading = reportQuery.isLoading || reportQuery.isFetching
  const hasFilters = Boolean(year || month || debouncedSearch || departmentId)

  // أعداد كل سنة/شهر محسوبة قبل الفلتر، فتبقى القوائم ثابتة مهما تغيّر الفلتر.
  const yearOptions = useMemo(
    () =>
      (report?.years ?? []).map((entry) => ({
        value: String(entry.year),
        label: `${entry.year} (${entry.count})`
      })),
    [report]
  )

  const monthOptions = useMemo(() => {
    if (!year) return []
    return (report?.periods ?? [])
      .filter((entry) => entry.year === Number(year))
      .sort((a, b) => b.month - a.month)
      .map((entry) => ({
        value: String(entry.month),
        label: `${String(entry.month).padStart(2, '0')} (${entry.count})`
      }))
  }, [report, year])

  const switchView = (next: RetirementView) => {
    if (next === view) return
    setView(next)
    setMonth('')
    // المؤهلون: ابدأ بالسنة الحالية (من سيخرج هذا العام) — والمحالون: كل السنوات.
    setYear(next === 'eligible' ? String(new Date().getFullYear()) : '')
  }

  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (!report || report.rows.length === 0) return null
    const subtitle = [
      isEligible ? t('reviews.retirements.viewEligible') : t('reviews.retirements.viewRetired'),
      t('export.count', { count: report.rows.length }),
      year ? String(year) : t('reviews.retirements.allYears')
    ]
      .filter(Boolean)
      .join(' — ')

    return {
      scope: 'payrolls',
      fileName: `${isEligible ? 'eligible' : 'retirements'}-${year || 'all'}`,
      title: isEligible
        ? t('reviews.retirements.eligibleTitle')
        : t('reviews.retirements.title'),
      subtitle,
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'code', label: t('reviews.retirements.employeeCode'), width: 12, align: 'center' },
        { key: 'name', label: t('reviews.retirements.employeeName'), width: 30 },
        { key: 'department', label: t('reviews.retirements.departmentName'), width: 22 },
        { key: 'birthDate', label: t('reviews.retirements.birthDate'), width: 16, align: 'center' },
        {
          key: 'retirementDate',
          label: t('reviews.retirements.retirementDate'),
          width: 16,
          align: 'center'
        },
        {
          key: 'last',
          label: isEligible
            ? t('reviews.retirements.currentStatus')
            : t('reviews.retirements.source'),
          width: 14,
          align: 'center'
        }
      ],
      rows: report.rows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.departmentName ?? '',
        row.birthDate ?? '',
        row.retirementDate ?? '',
        isEligible
          ? t(`employeeStatuses.${row.employeeStatus}`)
          : row.source === 'auto'
            ? t('reviews.retirements.sourceAuto')
            : t('reviews.retirements.sourceManual')
      ])
    }
  }, [report, year, t, i18n, isEligible])

  return (
    <div className="flex flex-col gap-5">
      {/* تبديل العرض */}
      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-2">
        {VIEWS.map((item) => {
          const Icon = item.icon
          const active = item.key === view
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => switchView(item.key)}
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

      {/* شريط الاختيار */}
      <GlassCard withLightBar={false} className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              containerClassName="w-40"
              value={year}
              onChange={(event) => {
                setYear(event.target.value)
                setMonth('')
              }}
              options={yearOptions}
              placeholder={t('reviews.retirements.allYears')}
            />
            <Select
              containerClassName="w-40"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              options={monthOptions}
              placeholder={t('reviews.retirements.allMonths')}
              disabled={!year || monthOptions.length === 0}
            />

            {report && (
              <span className="truncate text-[11px] text-ink-low">
                {t('reviews.retirements.showing', {
                  filtered: report.totals.filtered,
                  total: report.totals.total
                })}
              </span>
            )}

            <div className="flex-1" />

            {report && report.totals.filtered > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1.5 text-[11px] font-medium text-accent-300">
                <Award className="size-3.5" />
                {isEligible
                  ? t('reviews.retirements.eligibleCount', { count: report.totals.filtered })
                  : t('reviews.retirements.retireesCount', { count: report.totals.filtered })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              containerClassName="flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('reviews.retirements.searchPlaceholder')}
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
              placeholder={t('reviews.retirements.allDepartments')}
            />
            {hasFilters && (
              <SoftButton
                variant="subtle"
                onClick={() => {
                  setYear(isEligible ? String(new Date().getFullYear()) : '')
                  setMonth('')
                  setSearch('')
                  setDepartmentId('')
                }}
              >
                {t('payrolls.clearFilters')}
              </SoftButton>
            )}
            <div className="flex items-center gap-2">
              <SoftButton
                variant="ghost"
                icon={<ClipboardCheck className="size-4" />}
                disabled={!report || report.rows.length === 0}
                onClick={() => setReviewOpen(true)}
              >
                {t('reviews.retirements.review.open')}
              </SoftButton>
              <ExportMenu payload={exportPayload} />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* شريط الملخص */}
      {report && report.rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            icon={isEligible ? <Users className="size-4" /> : <UserMinus className="size-4" />}
            title={
              isEligible
                ? t('reviews.retirements.eligible')
                : t('reviews.retirements.retirees')
            }
            value={String(report.totals.filtered)}
            hint={year ? String(year) : t('reviews.retirements.allYears')}
          />
          <SummaryCard
            icon={<Award className="size-4" />}
            title={t('reviews.retirements.yearsCount')}
            value={String(report.totals.years)}
            hint={t('reviews.retirements.yearsHint')}
          />
          <SummaryCard
            icon={<CalendarClock className="size-4" />}
            title={isEligible ? t('reviews.retirements.nearest') : t('reviews.retirements.latest')}
            value={formatDateOnly(
              isEligible ? report.totals.earliest : report.totals.latest,
              language
            )}
            hint={
              isEligible
                ? t('reviews.retirements.nearestHint')
                : t('reviews.retirements.latestHint')
            }
          />
        </div>
      )}

      {/* الجدول */}
      <GlassCard withLightBar={false} className="overflow-hidden">
        {isLoading && !report ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : !report || report.totals.total === 0 ? (
          <EmptyState
            icon={isEligible ? <Users className="size-7" /> : <UserMinus className="size-7" />}
            title={
              isEligible
                ? t('reviews.retirements.eligibleEmptyTitle')
                : t('reviews.retirements.emptyTitle')
            }
            body={
              isEligible
                ? t('reviews.retirements.eligibleEmptyBody')
                : t('reviews.retirements.emptyBody')
            }
          />
        ) : report.rows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-7" />}
            title={t('reviews.retirements.noResults')}
            body={t('reviews.retirements.noResultsBody')}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeadRow>
                <DataTableHeadCell className="w-[104px]" align="center">
                  {t('reviews.retirements.employeeCode')}
                </DataTableHeadCell>
                <DataTableHeadCell>{t('reviews.retirements.employeeName')}</DataTableHeadCell>
                <DataTableHeadCell className="w-[190px]">
                  {t('reviews.retirements.departmentName')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[150px]" align="center">
                  {t('reviews.retirements.birthDate')}
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[170px] text-accent-300" align="center">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 opacity-70" />
                    {t('reviews.retirements.retirementDate')}
                  </span>
                </DataTableHeadCell>
                <DataTableHeadCell className="w-[130px]" align="center">
                  {isEligible
                    ? t('reviews.retirements.currentStatus')
                    : t('reviews.retirements.source')}
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
                    <span dir="ltr" className="text-xs tabular-nums text-ink-med">
                      {formatDateOnly(row.birthDate, language)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span dir="ltr" className="text-sm font-semibold tabular-nums text-accent-300">
                      {formatDateOnly(row.retirementDate, language)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {isEligible ? (
                      <span className="inline-flex items-center rounded-full border border-line bg-surface-soft px-2.5 py-1 text-[10px] font-semibold text-ink-med">
                        {t(`employeeStatuses.${row.employeeStatus}`)}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                          row.source === 'auto'
                            ? 'border-teal-400/30 bg-teal-500/10 text-teal-300'
                            : 'border-line bg-surface-soft text-ink-med'
                        )}
                      >
                        {row.source === 'auto'
                          ? t('reviews.retirements.sourceAuto')
                          : t('reviews.retirements.sourceManual')}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </DataTableBody>

            <DataTableFoot>
              <DataTableFootRow>
                <DataTableFootCell className="text-ink-low">
                  {report.rows.length}
                </DataTableFootCell>
                <DataTableFootCell>
                  {isEligible
                    ? t('reviews.retirements.eligible')
                    : t('reviews.retirements.retirees')}
                </DataTableFootCell>
                <DataTableFootCell />
                <DataTableFootCell />
                <DataTableFootCell className="tabular-nums text-accent-300" dir="ltr">
                  {formatDateOnly(
                    isEligible ? report.totals.earliest : report.totals.latest,
                    language
                  )}
                </DataTableFootCell>
                <DataTableFootCell />
              </DataTableFootRow>
            </DataTableFoot>
          </DataTable>
        )}
      </GlassCard>

      <RetirementReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        view={view}
        year={year}
        month=""
        search={debouncedSearch}
        departmentId={departmentId}
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
