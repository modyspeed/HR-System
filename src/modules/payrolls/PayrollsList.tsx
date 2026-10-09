import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Banknote, Plus, Search } from 'lucide-react'
import type { ExportPayload, ListPayrollsQuery, PayrollRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { useDebounce } from '@/hooks/useDebounce'
import { usePermission } from '@/hooks/usePermission'
import { staggerContainer, staggerItem, spring } from '@/lib/motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { ExportMenu } from '@/components/ui/ExportMenu'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { periodLabel, PAYROLL_TYPE_KEYS } from './payrollMeta'
import { PayrollImportModal } from './PayrollImportModal'
import { PreviewButton } from './PayrollPreviewModal'
import { PayrollSlipPickerDialog } from './PayrollSlipPickerDialog'

export function PayrollsList() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const canCreate = usePermission('payrolls.create')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [type, setType] = useState('')
  const [year, setYear] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [previewing, setPreviewing] = useState<PayrollRecord | null>(null)

  const query: ListPayrollsQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      type: type || undefined,
      year: year ?? undefined
    }),
    [debouncedSearch, type, year]
  )

  const entriesQuery = useQuery({
    queryKey: ['payrolls', 'list', query],
    queryFn: () => api.payrolls.list(query)
  })
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])

  /** كل موظف يظهر مرة واحدة — التفاصيل كاملة عبر بوب أب المعاينة. */
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { code: string; name: string; departmentName: string | null; count: number; latest: PayrollRecord }
    >()
    for (const entry of entries) {
      const existing = map.get(entry.employeeId)
      if (!existing) {
        map.set(entry.employeeId, {
          code: entry.employeeCode,
          name: entry.employeeName,
          departmentName: entry.departmentName,
          count: 1,
          latest: entry
        })
        continue
      }
      existing.count += 1
      if (
        entry.year > existing.latest.year ||
        (entry.year === existing.latest.year && entry.month > existing.latest.month)
      ) {
        existing.latest = entry
      }
    }
    return [...map.values()]
  }, [entries])

  const years = useMemo(() => [...new Set(entries.map((entry) => entry.year))].sort((a, b) => b - a), [entries])

  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (entries.length === 0) return null
    const filters = [type ? t(`payrolls.types.${type}`) : null, year ? String(year) : null]
      .filter(Boolean)
      .join(' · ')
    const subtitle = [t('export.count', { count: entries.length }), filters].filter(Boolean).join(' — ')

    return {
      scope: 'payrolls',
      fileName: `payrolls-${new Date().toISOString().slice(0, 10)}`,
      title: t('payrolls.title'),
      subtitle,
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'employeeCode', label: t('payrolls.employeeCode'), width: 12, align: 'center' },
        { key: 'employeeName', label: t('payrolls.employeeName'), width: 30 },
        { key: 'department', label: t('payrolls.department'), width: 20 },
        { key: 'type', label: t('payrolls.type'), width: 14, align: 'center' },
        { key: 'period', label: t('payrolls.period'), width: 12, align: 'center' },
        { key: 'basic', label: t('payrolls.basic'), width: 14, format: '#,##0.00', align: 'end' },
        { key: 'totalEarned', label: t('payrolls.totalEarned'), width: 14, format: '#,##0.00', align: 'end' },
        { key: 'deductions', label: t('payrolls.deductions'), width: 14, format: '#,##0.00', align: 'end' },
        { key: 'net', label: t('payrolls.net'), width: 14, format: '#,##0.00', align: 'end' },
        { key: 'file', label: t('payrolls.document'), width: 26 }
      ],
      rows: entries.map((entry) => [
        entry.employeeCode,
        entry.employeeName,
        entry.departmentName ?? '',
        t(`payrolls.types.${entry.type}`),
        periodLabel(entry.period),
        entry.basicSalary,
        entry.totalEarned,
        entry.totalDeductions,
        entry.netSalary,
        entry.fileName
      ])
    }
  }, [entries, type, year, t, i18n])

  const hasFilters = Boolean(debouncedSearch || type || year !== null)

  return (
    <div>
      <PageHeader
        title={t('payrolls.title')}
        accent="Payroll"
        subtitle={t('payrolls.subtitle')}
        actions={
          <>
            <ExportMenu payload={exportPayload} />
            {canCreate && (
              <SoftButton
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setImportOpen(true)}
              >
                {t('payrolls.import')}
              </SoftButton>
            )}
          </>
        }
      />

      <GlassCard withLightBar={false} className="mb-5 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            containerClassName="flex-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('payrolls.searchPlaceholder')}
            icon={<Search className="size-4" />}
          />
          <Select
            containerClassName="lg:w-44"
            value={type}
            onChange={(event) => setType(event.target.value)}
            options={PAYROLL_TYPE_KEYS.map((key) => ({ value: key, label: t(`payrolls.types.${key}`) }))}
            placeholder={t('payrolls.allTypes')}
          />
          <Select
            containerClassName="lg:w-40"
            value={year === null ? '' : String(year)}
            onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}
            options={years.map((value) => ({ value: String(value), label: String(value) }))}
            placeholder={t('payrolls.allYears')}
          />
          {hasFilters && (
            <SoftButton
              variant="subtle"
              onClick={() => {
                setSearch('')
                setType('')
                setYear(null)
              }}
            >
              {t('payrolls.clearFilters')}
            </SoftButton>
          )}
        </div>
      </GlassCard>

      <GlassCard withLightBar={false} className="overflow-hidden">
        {entriesQuery.isLoading ? (
          <div className="p-5">
            <SkeletonRows rows={7} />
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<Banknote className="size-7" />}
            title={hasFilters ? t('payrolls.noResults') : t('payrolls.empty')}
            body={hasFilters ? t('payrolls.noResultsBody') : t('payrolls.emptyBody')}
            action={
              canCreate && !hasFilters ? (
                <SoftButton variant="primary" icon={<Plus className="size-4" />} onClick={() => setImportOpen(true)}>
                  {t('payrolls.import')}
                </SoftButton>
              ) : undefined
            }
          />
        ) : (
          <div className="scroll-area overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-low">
                  <th className="px-5 py-3.5 text-start font-medium">{t('payrolls.employeeCode')}</th>
                  <th className="px-5 py-3.5 text-start font-medium">{t('payrolls.employeeName')}</th>
                  <th className="px-5 py-3.5 text-start font-medium">{t('payrolls.department')}</th>
                  <th className="px-5 py-3.5 text-center font-medium">{t('payrolls.entriesCountTitle')}</th>
                  <th className="px-5 py-3.5 text-end font-medium">{t('payrolls.actions')}</th>
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="divide-y divide-surface-base"
              >
                {grouped.map((group) => (
                  <motion.tr
                    key={group.code}
                    variants={staggerItem}
                    transition={spring}
                    className="transition-colors hover:bg-surface-soft"
                  >
                    <td className="px-5 py-3.5">
                      <span dir="ltr" className="font-mono text-sm text-ink-med">
                        {group.code}
                      </span>
                    </td>
                    <td className="max-w-[240px] px-5 py-3.5">
                      <span dir="auto" className="truncate text-sm font-semibold text-ink-high">
                        {group.name}
                      </span>
                    </td>
                    <td className="max-w-[180px] px-5 py-3.5">
                      <span dir="auto" className="truncate text-xs text-ink-med">
                        {group.departmentName ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-surface-strong px-2.5 py-1 text-xs font-semibold tabular-nums">
                        {t('payrolls.entriesCount', { count: group.count })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <PreviewButton entry={group.latest} onOpen={() => setPreviewing(group.latest)} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <PayrollImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false)
          void queryClient.invalidateQueries({ queryKey: ['payrolls'] })
        }}
      />

      {previewing !== null && (
        <PayrollSlipPickerDialog
          open
          employeeId={previewing.employeeId}
          initial={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}

    </div>
  )
}
