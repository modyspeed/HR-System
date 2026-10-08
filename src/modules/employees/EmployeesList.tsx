import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowDownUp,
  Contact,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload
} from 'lucide-react'
import { toast } from 'sonner'
import type { EmployeeRecord, ListEmployeesQuery } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { useDebounce } from '@/hooks/useDebounce'
import { usePermission } from '@/hooks/usePermission'
import { formatDateOnly } from '@/lib/utils'
import { staggerContainer, staggerItem, spring } from '@/lib/motion'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RowActions } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmployeeDetailsModal } from './EmployeeDetailsModal'
import { EmployeeFormModal } from './EmployeeFormModal'
import { EmployeeFileModal } from './EmployeeFileModal'
import { ImportEmployeesModal } from './ImportEmployeesModal'

type SortField = NonNullable<ListEmployeesQuery['sort']>

export function EmployeesList() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const canCreate = usePermission('employees.create')
  const canEdit = usePermission('employees.edit')
  const canDelete = usePermission('employees.delete')
  const canImport = usePermission('employees.import')
  const language = i18n.language

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [isActive, setIsActive] = useState<string>('')
  const [sort, setSort] = useState<SortField>('code')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EmployeeRecord | null>(null)
  const [fileEmployee, setFileEmployee] = useState<EmployeeRecord | null>(null)
  const [viewing, setViewing] = useState<EmployeeRecord | null>(null)

  const query: ListEmployeesQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      isActive: isActive === '' ? null : isActive === 'active',
      sort,
      order
    }),
    [debouncedSearch, isActive, sort, order]
  )

  const employeesQuery = useQuery({
    queryKey: ['employees', 'list', query],
    queryFn: () => api.employees.list(query)
  })

  const employees = employeesQuery.data ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.employees.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.employeeDeleted'))
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

  const cell = (value: string | null) => (value ? value : <span className="text-ink-low">—</span>)

  return (
    <div>
      <PageHeader
        title={t('employees.title')}
        accent="Employees"
        subtitle={t('employees.subtitle')}
        actions={
          <>
            {canImport && (
              <SoftButton
                variant="ghost"
                icon={<Upload className="size-4" />}
                onClick={() => setImportOpen(true)}
              >
                {t('employees.import')}
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
                {t('employees.new')}
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
            placeholder={t('employees.searchPlaceholder')}
            icon={<Search className="size-4" />}
          />
          <Select
            containerClassName="lg:w-44"
            value={isActive}
            onChange={(event) => setIsActive(event.target.value)}
            options={[
              { value: 'active', label: t('employees.activeOnly') },
              { value: 'inactive', label: t('employees.inactiveOnly') }
            ]}
            placeholder={t('employees.allStatuses')}
          />
          {hasFilters && (
            <SoftButton variant="subtle" onClick={clearFilters}>
              {t('employees.clearFilters')}
            </SoftButton>
          )}
        </div>
      </GlassCard>

      <GlassCard withLightBar={false} className="overflow-hidden">
        {employeesQuery.isLoading ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : employees.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<Search className="size-7" />}
              title={t('employees.noResults')}
              body={t('employees.noResultsBody')}
              action={
                <SoftButton variant="ghost" onClick={clearFilters}>
                  {t('employees.clearFilters')}
                </SoftButton>
              }
            />
          ) : (
            <EmptyState
              icon={<Contact className="size-7" />}
              title={t('employees.noEmployees')}
              body={t('employees.noEmployeesBody')}
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {canImport && (
                    <SoftButton
                      variant="ghost"
                      icon={<Upload className="size-4" />}
                      onClick={() => setImportOpen(true)}
                    >
                      {t('employees.import')}
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
                      {t('employees.new')}
                    </SoftButton>
                  )}
                </div>
              }
            />
          )
        ) : (
          <div className="scroll-area overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-low">
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'code'}
                      order={order}
                      onClick={() => toggleSort('code')}
                      label={t('employees.code')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'name'}
                      order={order}
                      onClick={() => toggleSort('name')}
                      label={t('employees.name')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'grade'}
                      order={order}
                      onClick={() => toggleSort('grade')}
                      label={t('employees.grade')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'hireDate'}
                      order={order}
                      onClick={() => toggleSort('hireDate')}
                      label={t('employees.hireDate')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    {t('employees.status')}
                  </th>
                  <th className="px-5 py-3.5 text-end font-medium">
                    {t('employees.actions')}
                  </th>
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="divide-y divide-surface-base"
              >
                {employees.map((employee) => (
                  <motion.tr
                    key={employee.id}
                    variants={staggerItem}
                    transition={spring}
                    className="transition-colors hover:bg-surface-soft"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span dir="ltr" className="font-mono text-sm text-ink-med">
                        {employee.code}
                      </span>
                    </td>
                    <td className="max-w-[240px] px-5 py-3.5 text-sm font-medium text-ink-high">
                      <span className="flex items-center gap-1.5">
                        <span dir="auto" className="truncate">
                          {employee.name}
                        </span>
                        {employee.fileOriginalName && (
                          <Paperclip
                            className="size-3.5 shrink-0 text-accent-300"
                            aria-label={t('employees.file.title')}
                          />
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-ink-med">
                      <span dir="auto">{cell(employee.grade)}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-ink-low">
                      {formatDateOnly(employee.hireDate, language)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={employee.isActive ? 'teal' : 'rose'} dot>
                        {employee.isActive
                          ? t('employees.activeBadge')
                          : t('employees.inactiveBadge')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={t('common.view')}
                          aria-label={t('common.view')}
                          onClick={() => setViewing(employee)}
                          className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                        >
                          <Eye className="size-4" />
                        </button>
                        <RowActions
                          actions={[
                            {
                              key: 'file',
                              label: t('employees.file.action'),
                              icon: <Paperclip className="size-3.5" />,
                              onClick: () => setFileEmployee(employee)
                            },
                            ...(canEdit
                              ? [
                                  {
                                    key: 'edit',
                                    label: t('common.edit'),
                                    icon: <Pencil className="size-3.5" />,
                                    onClick: () => {
                                      setEditing(employee)
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
                                    onClick: () => setConfirmDelete(employee)
                                  }
                                ]
                              : [])
                          ]}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <EmployeeFormModal
        open={formOpen}
        employee={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />

      <ImportEmployeesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false)
          invalidate()
        }}
      />

      <EmployeeFileModal
        open={fileEmployee !== null}
        employee={fileEmployee}
        onClose={() => setFileEmployee(null)}
        onChanged={() => {
          invalidate()
          // refresh the record held by the modal so the file card stays current
          const id = fileEmployee?.id
          if (id) {
            void api.employees.getById(id).then((fresh) => {
              if (fresh) setFileEmployee(fresh)
            })
          }
        }}
      />

      <EmployeeDetailsModal
        open={viewing !== null}
        employee={viewing}
        onClose={() => setViewing(null)}
        onEdit={() => {
          setEditing(viewing)
          setViewing(null)
          setFormOpen(true)
        }}
        onManageFile={() => {
          setFileEmployee(viewing)
          setViewing(null)
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('employees.confirmDeleteTitle')}
        body={
          confirmDelete
            ? t('employees.confirmDeleteBody', { name: confirmDelete.name })
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
