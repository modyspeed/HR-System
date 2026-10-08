import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import type { ExportPayload, LeaveRecord, ListLeavesQuery } from '@shared/types'
import { LEAVE_STATUS_KEYS, LEAVE_TYPE_KEYS } from '@shared/leaves'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { useDebounce } from '@/hooks/useDebounce'
import { usePermission } from '@/hooks/usePermission'
import { staggerContainer, staggerItem, spring } from '@/lib/motion'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ExportMenu } from '@/components/ui/ExportMenu'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { leaveStatusTone, leaveTypeTone } from './leaveMeta'
import { LeaveDetailsModal } from './LeaveDetailsModal'
import { LeaveFormModal } from './LeaveFormModal'

export function LeavesList() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const canCreate = usePermission('leaves.create')
  const canEdit = usePermission('leaves.edit')
  const canDelete = usePermission('leaves.delete')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveRecord | null>(null)
  const [viewing, setViewing] = useState<LeaveRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<LeaveRecord | null>(null)

  const query: ListLeavesQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      type: type || undefined,
      status: status || undefined
    }),
    [debouncedSearch, type, status]
  )

  const leavesQuery = useQuery({
    queryKey: ['leaves', 'list', query],
    queryFn: () => api.leaves.list(query)
  })
  const leaves = useMemo(() => leavesQuery.data ?? [], [leavesQuery.data])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['leaves'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.leaves.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.leaveDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const clearFilters = () => {
    setSearch('')
    setType('')
    setStatus('')
  }

  const hasFilters = Boolean(debouncedSearch || type || status)

  const typeOptions = LEAVE_TYPE_KEYS.map((key) => ({ value: key, label: t(`leaves.types.${key}`) }))
  const statusOptions = LEAVE_STATUS_KEYS.map((key) => ({
    value: key,
    label: t(`leaves.statuses.${key}`)
  }))

  const stats = useMemo(() => {
    const approved = leaves.filter((leave) => leave.status === 'approved').length
    const pending = leaves.filter((leave) => leave.status === 'pending').length
    const days = leaves.reduce((sum, leave) => sum + leave.daysCount, 0)
    return { total: leaves.length, approved, pending, days }
  }, [leaves])

  /** Exports the current filtered list — dates stay ISO so Excel keeps sorting. */
  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (leaves.length === 0) return null
    const filters = [type ? t(`leaves.types.${type}`) : null, status ? t(`leaves.statuses.${status}`) : null]
      .filter(Boolean)
      .join(' · ')
    const subtitle = [t('export.count', { count: leaves.length }), filters].filter(Boolean).join(' — ')

    return {
      scope: 'leaves',
      fileName: `leaves-${new Date().toISOString().slice(0, 10)}`,
      title: t('leaves.title'),
      subtitle,
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'employeeCode', label: t('leaves.employeeCode'), width: 12, align: 'center' },
        { key: 'employeeName', label: t('leaves.employeeName'), width: 30 },
        { key: 'type', label: t('leaves.type'), width: 22 },
        { key: 'startDate', label: t('leaves.startDate'), width: 14, align: 'center' },
        { key: 'endDate', label: t('leaves.endDate'), width: 14, align: 'center' },
        { key: 'daysCount', label: t('leaves.daysCount'), width: 10, align: 'center', format: '0' },
        { key: 'year', label: t('leaves.year'), width: 10, align: 'center', format: '0' },
        { key: 'status', label: t('leaves.status'), width: 12, align: 'center' },
        { key: 'reason', label: t('leaves.reason'), width: 30 }
      ],
      rows: leaves.map((leave) => [
        leave.employeeCode,
        leave.employeeName,
        t(`leaves.types.${leave.type}`),
        leave.startDate,
        leave.endDate,
        leave.daysCount,
        leave.year,
        t(`leaves.statuses.${leave.status}`),
        leave.reason
      ])
    }
  }, [leaves, type, status, t, i18n])

  return (
    <div>
      <PageHeader
        title={t('leaves.title')}
        accent="Leaves"
        subtitle={t('leaves.subtitle')}
        actions={
          <>
            <ExportMenu payload={exportPayload} />
            {canCreate && (
              <SoftButton
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                {t('leaves.new')}
              </SoftButton>
            )}
          </>
        }
      />

      {/* Quick glance strip */}
      {leaves.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: t('leaves.statTotal'), value: stats.total, tone: 'text-ink-high' },
            { label: t('leaves.statApproved'), value: stats.approved, tone: 'text-teal-400' },
            { label: t('leaves.statPending'), value: stats.pending, tone: 'text-accent-300' },
            { label: t('leaves.statDays'), value: stats.days, tone: 'text-violet-400' }
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-line bg-surface-soft/70 px-4 py-3 backdrop-blur-sm"
            >
              <p className="text-[11px] font-medium text-ink-low">{stat.label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* filter bar */}
      <GlassCard withLightBar={false} className="mb-5 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            containerClassName="flex-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('leaves.searchPlaceholder')}
            icon={<Search className="size-4" />}
          />
          <Select
            containerClassName="lg:w-48"
            value={type}
            onChange={(event) => setType(event.target.value)}
            options={typeOptions}
            placeholder={t('leaves.allTypes')}
          />
          <Select
            containerClassName="lg:w-40"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={statusOptions}
            placeholder={t('leaves.allStatuses')}
          />
          {hasFilters && (
            <SoftButton variant="subtle" onClick={clearFilters}>
              {t('leaves.clearFilters')}
            </SoftButton>
          )}
        </div>
      </GlassCard>

      <GlassCard withLightBar={false} className="overflow-hidden">
        {leavesQuery.isLoading ? (
          <div className="p-5">
            <SkeletonRows rows={7} />
          </div>
        ) : leaves.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<Search className="size-7" />}
              title={t('leaves.noResults')}
              body={t('leaves.noResultsBody')}
              action={
                <SoftButton variant="ghost" onClick={clearFilters}>
                  {t('leaves.clearFilters')}
                </SoftButton>
              }
            />
          ) : (
            <EmptyState
              icon={<CalendarDays className="size-7" />}
              title={t('leaves.noLeaves')}
              body={t('leaves.noLeavesBody')}
              action={
                canCreate ? (
                  <SoftButton
                    variant="primary"
                    icon={<Plus className="size-4" />}
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    {t('leaves.new')}
                  </SoftButton>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="scroll-area overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-low">
                  <th className="px-5 py-3.5 text-start font-medium">{t('leaves.employee')}</th>
                  <th className="px-5 py-3.5 text-start font-medium">{t('leaves.type')}</th>
                  <th className="px-5 py-3.5 text-start font-medium">{t('leaves.period')}</th>
                  <th className="px-5 py-3.5 text-center font-medium">{t('leaves.daysCount')}</th>
                  <th className="px-5 py-3.5 text-center font-medium">{t('leaves.year')}</th>
                  <th className="px-5 py-3.5 text-start font-medium">{t('leaves.status')}</th>
                  <th className="px-5 py-3.5 text-center font-medium">{t('leaves.document')}</th>
                  <th className="px-5 py-3.5 text-end font-medium">{t('leaves.actions')}</th>
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="divide-y divide-surface-base"
              >
                {leaves.map((leave) => (
                  <motion.tr
                    key={leave.id}
                    variants={staggerItem}
                    transition={spring}
                    className="transition-colors hover:bg-surface-soft"
                  >
                    <td className="px-5 py-3.5">
                      <span className="flex flex-col">
                        <span className="flex items-center gap-2">
                          <span dir="ltr" className="font-mono text-xs text-ink-low">
                            {leave.employeeCode}
                          </span>
                          {leave.fileOriginalName && (
                            <Paperclip className="size-3 text-accent-300" aria-label={t('leaves.document')} />
                          )}
                        </span>
                        <span dir="auto" className="mt-0.5 max-w-[220px] truncate text-sm font-semibold text-ink-high">
                          {leave.employeeName}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={leaveTypeTone(leave.type)}>{t(`leaves.types.${leave.type}`)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span dir="ltr" className="font-mono text-xs text-ink-med">
                        {leave.startDate} → {leave.endDate}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-sm font-bold tabular-nums text-ink-high">
                      {leave.daysCount}
                    </td>
                    <td className="px-5 py-3.5 text-center text-[12px] text-ink-low">{leave.year}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={leaveStatusTone(leave.status)} dot>
                        {t(`leaves.statuses.${leave.status}`)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-center text-[11px] text-ink-low">
                      {leave.fileOriginalName ? (
                        <span className="inline-flex max-w-[160px] items-center gap-1.5 truncate text-teal-400">
                          <Paperclip className="size-3 shrink-0" />
                          <span className="truncate" dir="auto">{leave.fileOriginalName}</span>
                        </span>
                      ) : (
                        <span className="text-ink-low">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={t('common.view')}
                          aria-label={t('common.view')}
                          onClick={() => setViewing(leave)}
                          className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                        >
                          <Eye className="size-4" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                            onClick={() => {
                              setEditing(leave)
                              setFormOpen(true)
                            }}
                            className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                          >
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                            onClick={() => setConfirmDelete(leave)}
                            className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <LeaveFormModal
        open={formOpen}
        leave={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />

      <LeaveDetailsModal
        open={viewing !== null}
        leave={viewing}
        onClose={() => setViewing(null)}
        onChanged={() => invalidate()}
        onEdit={() => {
          setEditing(viewing)
          setViewing(null)
          setFormOpen(true)
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('leaves.confirmDeleteTitle')}
        body={
          confirmDelete
            ? t('leaves.confirmDeleteBody', {
                name: confirmDelete.employeeName,
                type: t(`leaves.types.${confirmDelete.type}`)
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
