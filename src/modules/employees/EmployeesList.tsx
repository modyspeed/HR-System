import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowDownUp,
  Banknote,
  Contact,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  Repeat2,
  Search,
  Trash2,
  Upload,
  UserRound
} from 'lucide-react'
import { toast } from 'sonner'
import type { EmployeeRecord, ExportPayload, ListEmployeesQuery } from '@shared/types'
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
import { ExportMenu } from '@/components/ui/ExportMenu'
import { RowActions } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmployeeDetailsModal } from './EmployeeDetailsModal'
import { EmployeeFormModal } from './EmployeeFormModal'
import { EmployeeFileModal } from './EmployeeFileModal'
import { ImportEmployeesModal } from './ImportEmployeesModal'
import { EmployeeStatusDialog } from './EmployeeStatusDialog'
import { PayrollByEmployeeModal } from '@/modules/payrolls/PayrollEmployeeView'
import { EMPLOYEE_STATUS_KEYS, employeeStatusTone } from './employeeStatusMeta'

type SortField = NonNullable<ListEmployeesQuery['sort']>

export function EmployeesList() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canCreate = usePermission('employees.create')
  const canEdit = usePermission('employees.edit')
  const canDelete = usePermission('employees.delete')
  const canManageStatus = usePermission('employees.manage_status')
  const canViewPayrolls = usePermission('payrolls.view')
  const canImport = usePermission('employees.import')
  const language = i18n.language

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sort, setSort] = useState<SortField>('code')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EmployeeRecord | null>(null)
  const [fileEmployee, setFileEmployee] = useState<EmployeeRecord | null>(null)
  const [viewing, setViewing] = useState<EmployeeRecord | null>(null)
  const [statusEmployee, setStatusEmployee] = useState<EmployeeRecord | null>(null)
  const [payrollEmployee, setPayrollEmployee] = useState<EmployeeRecord | null>(null)

  const query: ListEmployeesQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      sort,
      order
    }),
    [debouncedSearch, statusFilter, sort, order]
  )

  const employeesQuery = useQuery({
    queryKey: ['employees', 'list', query],
    queryFn: () => api.employees.list(query)
  })

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data])

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
    setStatusFilter('')
  }

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('asc')
    }
  }

  const hasFilters = Boolean(debouncedSearch || statusFilter !== '')

  /**
   * Export mirrors the current list (same filters, same order) and carries the
   * full record — richer than the six visible columns. Dates stay ISO so the
   * Excel sheet remains sortable regardless of the interface language.
   */
  const exportPayload = useMemo<ExportPayload | null>(() => {
    if (employees.length === 0) return null
    const filters = [
      debouncedSearch ? `«${debouncedSearch}»` : null,
      statusFilter ? t(`employeeStatuses.${statusFilter}`) : null
    ]
      .filter(Boolean)
      .join(' · ')
    const subtitle = [t('export.count', { count: employees.length }), filters]
      .filter(Boolean)
      .join(' — ')

    return {
      scope: 'employees',
      fileName: `employees-${new Date().toISOString().slice(0, 10)}`,
      title: t('employees.title'),
      subtitle,
      direction: i18n.dir() === 'rtl' ? 'rtl' : 'ltr',
      columns: [
        { key: 'code', label: t('employees.code'), width: 12, align: 'center' },
        { key: 'name', label: t('employees.name'), width: 32 },
        { key: 'insuranceNo', label: t('employees.insuranceNo'), width: 18, align: 'center' },
        { key: 'nationalId', label: t('employees.nationalId'), width: 18, align: 'center' },
        { key: 'grade', label: t('employees.grade'), width: 10, align: 'center' },
        { key: 'gradeDate', label: t('employees.gradeDate'), width: 14, align: 'center' },
        { key: 'birthDate', label: t('employees.birthDate'), width: 14, align: 'center' },
        { key: 'permanentDate', label: t('employees.permanentDate'), width: 14, align: 'center' },
        { key: 'hireDate', label: t('employees.hireDate'), width: 14, align: 'center' },
        { key: 'qualification', label: t('employees.qualification'), width: 20 },
        {
          key: 'qualificationYear',
          label: t('employees.qualificationYear'),
          width: 12,
          align: 'center',
          format: '0'
        },
        { key: 'department', label: t('employees.department'), width: 26 },
        { key: 'contractType', label: t('employees.contractType'), width: 14, align: 'center' },
        { key: 'status', label: t('employees.status'), width: 12, align: 'center' }
      ],
      rows: employees.map((employee) => [
        employee.code,
        employee.name,
        employee.insuranceNo,
        employee.nationalId,
        employee.grade,
        employee.gradeDate,
        employee.birthDate,
        employee.permanentDate,
        employee.hireDate,
        employee.qualification,
        employee.qualificationYear,
        employee.departmentName,
        employee.contractType,
        t(`employeeStatuses.${employee.status}`)
      ])
    }
  }, [employees, debouncedSearch, statusFilter, t, i18n])

  const cell = (value: string | null) => (value ? value : <span className="text-ink-low">—</span>)

  return (
    <div>
      <PageHeader
        title={t('employees.title')}
        accent="Employees"
        subtitle={t('employees.subtitle')}
        actions={
          <>
            <ExportMenu payload={exportPayload} />
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
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={EMPLOYEE_STATUS_KEYS.map((key) => ({
              value: key,
              label: t(`employeeStatuses.${key}`)
            }))}
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
                      <span dir="ltr" className="inline-flex items-center gap-1.5 font-mono text-sm text-ink-med">
                        {employee.code}
                        {employee.rehiredFrom && (
                          <span
                            className="grid size-3.5 place-items-center text-accent-300"
                            title={t('employees.rehiredListHint')}
                            aria-label={t('employees.rehiredListHint')}
                          >
                            <Repeat2 className="size-3.5" />
                          </span>
                        )}
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
                      <Badge tone={employeeStatusTone(employee.status)} dot>
                        {t(`employeeStatuses.${employee.status}`)}
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
                              key: 'profile',
                              label: t('employees.profile'),
                              icon: <UserRound className="size-3.5" />,
                              onClick: () => navigate(`/employees/${employee.id}`)
                            },
                            ...(canViewPayrolls
                              ? [
                                  {
                                    key: 'payrolls',
                                    label: t('payrolls.employeePayrolls'),
                                    icon: <Banknote className="size-3.5" />,
                                    onClick: () => setPayrollEmployee(employee)
                                  }
                                ]
                              : []),
                            ...(canManageStatus
                              ? [
                                  {
                                    key: 'status',
                                    label: t('employees.statusTitle'),
                                    icon: <Activity className="size-3.5" />,
                                    onClick: () => setStatusEmployee(employee)
                                  }
                                ]
                              : []),
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

      <EmployeeStatusDialog
        open={statusEmployee !== null}
        employee={statusEmployee}
        onClose={() => setStatusEmployee(null)}
        onChanged={() => invalidate()}
      />

      <PayrollByEmployeeModal
        open={payrollEmployee !== null}
        employeeId={payrollEmployee?.id ?? null}
        employeeName={payrollEmployee?.name ?? null}
        onClose={() => setPayrollEmployee(null)}
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
