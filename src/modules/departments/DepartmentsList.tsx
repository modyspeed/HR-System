import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowDownUp,
  Building2,
  Pencil,
  Search,
  Trash2,
  Upload,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import type { DepartmentRecord, ExportPayload, ListDepartmentsQuery } from '@shared/types'
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
import { RowActions } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { DepartmentFormModal } from './DepartmentFormModal'
import { ImportDepartmentsModal } from './ImportDepartmentsModal'

type SortField = NonNullable<ListDepartmentsQuery['sort']>

export function DepartmentsList() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const canCreate = usePermission('departments.create')
  const canEdit = usePermission('departments.edit')
  const canDelete = usePermission('departments.delete')
  const canImport = usePermission('departments.import')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [isActive, setIsActive] = useState<string>('')
  const [sort, setSort] = useState<SortField>('code')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<DepartmentRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DepartmentRecord | null>(null)

  const query: ListDepartmentsQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      isActive: isActive === '' ? null : isActive === 'active',
      sort,
      order
    }),
    [debouncedSearch, isActive, sort, order]
  )

  const departmentsQuery = useQuery({
    queryKey: ['departments', 'list', query],
    queryFn: () => api.departments.list(query)
  })

  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['departments'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.departments.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.departmentDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const clearFilters = () => {
    setSearch('')
    setIsActive('')
  }

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('asc')
    }
  }

  const hasFilters = Boolean(debouncedSearch || isActive !== '')

  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (departments.length === 0) return null
    const filters = [
      debouncedSearch ? `«${debouncedSearch}»` : null,
      isActive === 'active'
        ? t('departments.activeOnly')
        : isActive === 'inactive'
          ? t('departments.inactiveOnly')
          : null
    ]
      .filter(Boolean)
      .join(' · ')
    const subtitle = [t('export.count', { count: departments.length }), filters]
      .filter(Boolean)
      .join(' — ')

    return {
      scope: 'departments',
      fileName: `departments-${new Date().toISOString().slice(0, 10)}`,
      title: t('departments.title'),
      subtitle,
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'code', label: t('departments.code'), width: 14, align: 'center' },
        { key: 'name', label: t('departments.name'), width: 36 },
        {
          key: 'allowance',
          label: t('departments.allowance'),
          width: 18,
          align: 'center',
          format: '0"%"'
        },
        { key: 'status', label: t('departments.status'), width: 12, align: 'center' }
      ],
      rows: departments.map((department) => {
        const effectiveActive = department.isActive && department.employeeCount > 0
        return [
          department.code,
          department.name,
          department.natureAllowancePct,
          effectiveActive ? t('departments.activeBadge') : t('departments.inactiveBadge')
        ]
      })
    }
  }, [departments, debouncedSearch, isActive, t, i18n])

  return (
    <div>
      <PageHeader
        title={t('departments.title')}
        accent="Departments"
        subtitle={t('departments.subtitle')}
        actions={
          <>
            <ExportMenu payload={exportPayload} />
            {canImport && (
              <SoftButton
                variant="ghost"
                icon={<Upload className="size-4" />}
                onClick={() => setImportOpen(true)}
              >
                {t('departments.import')}
              </SoftButton>
            )}
            {canCreate && (
              <SoftButton
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                {t('departments.new')}
              </SoftButton>
            )}
          </>
        }
      />

      {/* filter bar */}
      <GlassCard withLightBar={false} className="mb-5 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            containerClassName="flex-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('departments.searchPlaceholder')}
            icon={<Search className="size-4" />}
          />
          <Select
            containerClassName="lg:w-44"
            value={isActive}
            onChange={(event) => setIsActive(event.target.value)}
            options={[
              { value: 'active', label: t('departments.activeOnly') },
              { value: 'inactive', label: t('departments.inactiveOnly') }
            ]}
            placeholder={t('departments.allStatuses')}
          />
          {hasFilters && (
            <SoftButton variant="subtle" onClick={clearFilters}>
              {t('departments.clearFilters')}
            </SoftButton>
          )}
        </div>
      </GlassCard>

      <GlassCard withLightBar={false} className="overflow-hidden">
        {departmentsQuery.isLoading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : departments.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<Search className="size-7" />}
              title={t('departments.noResults')}
              body={t('departments.noResultsBody')}
              action={
                <SoftButton variant="ghost" onClick={clearFilters}>
                  {t('departments.clearFilters')}
                </SoftButton>
              }
            />
          ) : (
            <EmptyState
              icon={<Building2 className="size-7" />}
              title={t('departments.noDepartments')}
              body={t('departments.noDepartmentsBody')}
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {canImport && (
                    <SoftButton
                      variant="ghost"
                      icon={<Upload className="size-4" />}
                      onClick={() => setImportOpen(true)}
                    >
                      {t('departments.import')}
                    </SoftButton>
                  )}
                  {canCreate && (
                    <SoftButton
                      variant="primary"
                      icon={<Plus className="size-4" />}
                      onClick={() => {
                        setEditing(null)
                        setFormOpen(true)
                      }}
                    >
                      {t('departments.new')}
                    </SoftButton>
                  )}
                </div>
              }
            />
          )
        ) : (
          <div className="scroll-area overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-low">
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'code'}
                      order={order}
                      onClick={() => toggleSort('code')}
                      label={t('departments.code')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'name'}
                      order={order}
                      onClick={() => toggleSort('name')}
                      label={t('departments.name')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'natureAllowancePct'}
                      order={order}
                      onClick={() => toggleSort('natureAllowancePct')}
                      label={t('departments.allowance')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    {t('departments.status')}
                  </th>
                  <th className="px-5 py-3.5 text-end font-medium">
                    {t('departments.actions')}
                  </th>
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="divide-y divide-surface-base"
              >
                {departments.map((department) => (
                  <motion.tr
                    key={department.id}
                    variants={staggerItem}
                    transition={spring}
                    className="transition-colors hover:bg-surface-soft"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span dir="ltr" className="font-mono text-sm text-ink-med">
                        {department.code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-ink-high">
                      <span dir="auto">{department.name}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-ink-med">
                      {department.natureAllowancePct === null ? (
                        <span className="text-ink-low">—</span>
                      ) : (
                        <Badge tone="violet">{department.natureAllowancePct}%</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {department.isActive && department.employeeCount === 0 ? (
                        <span
                          className="flex w-fit items-center gap-2"
                          title={t('departments.zeroEmployeesHint')}
                        >
                          <Badge tone="neutral" dot>
                            {t('departments.inactiveBadge')}
                          </Badge>
                          <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[10px] font-medium text-ink-low">
                            {t('departments.zeroEmployees')}
                          </span>
                        </span>
                      ) : (
                        <Badge tone={department.isActive ? 'teal' : 'rose'} dot>
                          {department.isActive
                            ? t('departments.activeBadge')
                            : t('departments.inactiveBadge')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <RowActions
                        actions={[
                          ...(canEdit
                            ? [
                                {
                                  key: 'edit',
                                  label: t('common.edit'),
                                  icon: <Pencil className="size-3.5" />,
                                  onClick: () => {
                                    setEditing(department)
                                    setFormOpen(true)
                                  }
                                }
                              ]
                            : []),
                          ...(canDelete
                            ? [
                                {
                                  key: 'delete',
                                  label: t('common.delete'),
                                  icon: <Trash2 className="size-3.5" />,
                                  danger: true,
                                  onClick: () => setConfirmDelete(department)
                                }
                              ]
                            : [])
                        ]}
                      />
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <DepartmentFormModal
        open={formOpen}
        department={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />

      <ImportDepartmentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false)
          invalidate()
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('departments.confirmDeleteTitle')}
        body={
          confirmDelete
            ? t('departments.confirmDeleteBody', { name: confirmDelete.name })
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

function SortButton({
  label,
  active,
  order,
  onClick
}: {
  label: string
  active: boolean
  order: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-high"
    >
      <span>{label}</span>
      <ArrowDownUp
        className={`size-3 transition-all ${active ? 'text-accent-300' : 'opacity-40'} ${active && order === 'asc' ? 'rotate-180' : ''}`}
      />
    </button>
  )
}
