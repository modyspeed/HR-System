import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Banknote,
  CalendarDays,
  Clock3,
  Contact,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Paperclip,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import type { LeaveRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { avatarGradient, cn, formatDate, formatDateOnly, formatFileSize, initials } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { spring } from '@/lib/motion'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { SoftButton } from '@/components/ui/SoftButton'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { leaveStatusTone, leaveTypeTone } from '@/modules/leaves/leaveMeta'
import { LeaveDetailsModal } from '@/modules/leaves/LeaveDetailsModal'
import { LeaveFormModal } from '@/modules/leaves/LeaveFormModal'
import { EmployeeFileModal } from './EmployeeFileModal'
import { EmployeeFormModal } from './EmployeeFormModal'
import { EmployeeStatusDialog } from './EmployeeStatusDialog'
import { DetailField, SectionTitle } from './detailFields'
import { employeeStatusTone } from './employeeStatusMeta'

type TabKey = 'basic' | 'status' | 'file' | 'leaves' | 'salary' | 'attendance' | 'reports'

interface TabDef {
  key: TabKey
  labelKey: string
  icon: typeof Contact
  available: boolean
}

const TABS: TabDef[] = [
  { key: 'basic', labelKey: 'employees.tabBasic', icon: Contact, available: true },
  { key: 'status', labelKey: 'employees.tabStatus', icon: Activity, available: true },
  { key: 'file', labelKey: 'employees.tabFile', icon: Paperclip, available: true },
  { key: 'leaves', labelKey: 'employees.tabLeaves', icon: CalendarDays, available: true },
  { key: 'salary', labelKey: 'employees.tabSalary', icon: Banknote, available: false },
  { key: 'attendance', labelKey: 'employees.tabAttendance', icon: Clock3, available: false },
  { key: 'reports', labelKey: 'employees.tabReports', icon: FileText, available: false }
]

function extensionOf(name: string | null): string {
  if (!name) return ''
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

/**
 * دوسييه الموظف: ملف شامل يعرض كل ما يخص الموظف في مكان واحد — البيانات، ملف
 * العمل، الإجازات، وجاهز للتمديد بوحدات قادمة (رواتب، حضور، تقارير). أي وحدة
 * مستقبلية تُسجَّل بتبويب جديد ولا تتطلب إعادة تصميم الصفحة.
 */
export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const queryClient = useQueryClient()

  const canEditEmployee = usePermission('employees.edit')
  const canManageStatus = usePermission('employees.manage_status')
  const canCreateLeave = usePermission('leaves.create')
  const canEditLeave = usePermission('leaves.edit')
  const canDeleteLeave = usePermission('leaves.delete')

  const [tab, setTab] = useState<TabKey>('basic')
  const [editOpen, setEditOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [leaveForm, setLeaveForm] = useState<{ leave: LeaveRecord | null; presetEmployeeId: string } | null>(null)
  const [viewingLeave, setViewingLeave] = useState<LeaveRecord | null>(null)
  const [confirmDeleteLeave, setConfirmDeleteLeave] = useState<LeaveRecord | null>(null)

  const employeeQuery = useQuery({
    queryKey: ['employees', 'getById', id],
    queryFn: () => api.employees.getById(id!),
    enabled: Boolean(id)
  })
  const employee = employeeQuery.data ?? null

  const leavesQuery = useQuery({
    queryKey: ['leaves', 'byEmployee', employee?.id],
    queryFn: () => api.leaves.list({ search: employee?.code }),
    enabled: Boolean(employee)
  })
  const leaves = useMemo(() => leavesQuery.data ?? [], [leavesQuery.data])

  const historyQuery = useQuery({
    queryKey: ['employees', 'statusHistory', employee?.id],
    queryFn: () => api.employees.statusHistory(employee!.id),
    enabled: Boolean(employee)
  })
  const statusHistory = useMemo(() => historyQuery.data ?? [], [historyQuery.data])

  const stats = useMemo(() => {
    const approved = leaves.filter((leave) => leave.status === 'approved').length
    const pending = leaves.filter((leave) => leave.status === 'pending').length
    const days = leaves.reduce((sum, leave) => sum + leave.daysCount, 0)
    return { total: leaves.length, approved, pending, days }
  }, [leaves])

  const invalidateEmployee = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] })
    void queryClient.invalidateQueries({ queryKey: ['leaves'] })
  }

  const deleteLeaveMutation = useMutation({
    mutationFn: (leaveId: string) => api.leaves.remove(leaveId),
    onSuccess: () => {
      toast.success(t('toasts.leaveDeleted'))
      setConfirmDeleteLeave(null)
      void queryClient.invalidateQueries({ queryKey: ['leaves'] })
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  if (employeeQuery.isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-36 animate-pulse rounded-3xl bg-surface-soft" />
        <div className="rounded-3xl bg-surface-soft p-5">
          <SkeletonRows rows={8} />
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <GlassCard withLightBar={false} className="p-8">
        <EmptyState
          icon={<Contact className="size-7" />}
          title={t('employees.profileNotFound')}
          body={t('employees.profileNotFoundBody')}
          action={
            <SoftButton
              variant="primary"
              icon={<ArrowRight className="size-4 rtl:rotate-180" />}
              onClick={() => navigate('/employees')}
            >
              {t('common.back')}
            </SoftButton>
          }
        />
      </GlassCard>
    )
  }

  const hasFile = Boolean(employee.fileOriginalName)
  const ext = extensionOf(employee.fileOriginalName ?? null)
  const isPdf = ext === '.pdf'

  const date = (value: string | null) => formatDateOnly(value, language)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      {/* ---------- header ---------- */}
      <GlassCard withLightBar={false} className="mb-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white shadow-[var(--shadow-raised)]"
              style={{ background: avatarGradient(employee.id) }}
              aria-hidden
            >
              {initials(employee.name)}
            </span>
            <div className="min-w-0">
              <h1 dir="auto" className="text-xl font-bold text-ink-high">
                {employee.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span dir="ltr" className="font-mono text-xs text-ink-low">
                  {employee.code}
                </span>
                {employee.departmentName && (
                  <Badge tone="gold">{employee.departmentName}</Badge>
                )}
                {employee.contractType && <Badge tone="violet">{employee.contractType}</Badge>}
                <Badge tone={employeeStatusTone(employee.status)} dot>
                  {t(`employeeStatuses.${employee.status}`)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SoftButton
              variant="ghost"
              icon={<ArrowRight className="size-4 rtl:rotate-180" />}
              onClick={() => navigate('/employees')}
            >
              {t('employees.backToList')}
            </SoftButton>
            {canEditEmployee && (
              <SoftButton variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)}>
                {t('employees.details.edit')}
              </SoftButton>
            )}
            {canManageStatus && (
              <SoftButton
                variant="ghost"
                icon={<Activity className="size-4" />}
                onClick={() => setStatusDialogOpen(true)}
              >
                {t('employees.statusTitle')}
              </SoftButton>
            )}
            {canEditEmployee && (
              <SoftButton
                variant="ghost"
                icon={hasFile ? <Paperclip className="size-4" /> : <FolderOpen className="size-4" />}
                onClick={() => setFileOpen(true)}
              >
                {hasFile ? t('employees.details.manageFile') : t('employees.file.attach')}
              </SoftButton>
            )}
            {canCreateLeave && (
              <SoftButton
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setLeaveForm({ leave: null, presetEmployeeId: employee.id })}
              >
                {t('leaves.new')}
              </SoftButton>
            )}
          </div>
        </div>

        {/* snapshot strip */}
        {leaves.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: t('leaves.statTotal'), value: stats.total, tone: 'text-ink-high' },
              { label: t('leaves.statApproved'), value: stats.approved, tone: 'text-teal-400' },
              { label: t('leaves.statPending'), value: stats.pending, tone: 'text-accent-300' },
              { label: t('leaves.statDays'), value: stats.days, tone: 'text-violet-400' }
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-line bg-surface-soft/70 px-4 py-3">
                <p className="text-[11px] font-medium text-ink-low">{stat.label}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* ---------- tabs ---------- */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                active
                  ? 'border-accent-500/40 bg-accent-500/10 text-accent-300'
                  : 'border-line bg-surface-soft/60 text-ink-low hover:text-ink-high'
              )}
            >
              <Icon className="size-3.5" />
              {t(item.labelKey)}
              {item.key === 'leaves' && leaves.length > 0 && (
                <span className="rounded-full bg-surface-strong px-1.5 text-[10px] tabular-nums">
                  {leaves.length}
                </span>
              )}
              {!item.available && (
                <span className="rounded-full bg-surface-strong px-1.5 text-[10px] text-ink-low">
                  {t('employees.soonTitle')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ---------- content ---------- */}
      <GlassCard withLightBar={false} className="p-6">
        {tab === 'basic' && (
          <div>
            <SectionTitle>{t('employees.details.sectionBasic')}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label={t('employees.code')} value={employee.code} ltr mono />
              <DetailField label={t('employees.department')} value={employee.departmentName ?? ''} />
              <DetailField label={t('employees.contractType')} value={employee.contractType ?? ''} />
              <DetailField label={t('employees.grade')} value={employee.grade ?? ''} />
              <DetailField label={t('employees.hireDate')} value={date(employee.hireDate)} ltr />
              <DetailField label={t('employees.permanentDate')} value={date(employee.permanentDate)} ltr />
            </div>

            <SectionTitle>{t('employees.details.sectionIdentity')}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label={t('employees.insuranceNo')} value={employee.insuranceNo ?? ''} ltr mono />
              <DetailField label={t('employees.nationalId')} value={employee.nationalId ?? ''} ltr mono />
            </div>

            <SectionTitle>{t('employees.details.sectionPersonal')}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label={t('employees.birthDate')} value={date(employee.birthDate)} ltr />
              <DetailField label={t('employees.qualification')} value={employee.qualification ?? ''} />
              <DetailField
                label={t('employees.qualificationYear')}
                value={employee.qualificationYear !== null ? String(employee.qualificationYear) : ''}
                ltr
                mono
              />
              <DetailField label={t('employees.gradeDate')} value={date(employee.gradeDate)} ltr />
              <div className="rounded-2xl bg-surface-soft px-4 py-3 shadow-[var(--shadow-inset)]">
                <p className="text-[11px] text-ink-low">{t('employees.status')}</p>
                <div className="mt-1.5">
                  <Badge tone={employee.isActive ? 'teal' : 'rose'} dot>
                    {employee.isActive ? t('employees.activeBadge') : t('employees.inactiveBadge')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'file' && (
          <div>
            {hasFile ? (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-soft p-5 shadow-[var(--shadow-inset)]">
                <span
                  className={cn(
                    'grid size-12 shrink-0 place-items-center rounded-xl border',
                    isPdf
                      ? 'border-rose-400/25 bg-rose-500/10 text-rose-400'
                      : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-400'
                  )}
                >
                  {isPdf ? <FileText className="size-5" /> : <FileSpreadsheet className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-high" dir="auto">
                    {employee.fileOriginalName}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-low">
                    <span className="rounded bg-surface-strong px-1.5 py-0.5 font-mono uppercase">
                      {ext.replace('.', '')}
                    </span>
                    <span>{formatFileSize(employee.fileSize ?? null)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {t('employees.file.linkedAt')}: {formatDate(employee.fileLinkedAt ?? null, language)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SoftButton
                    variant="ghost"
                    icon={<FolderOpen className="size-4" />}
                    onClick={() => void api.employees.revealFilesDir()}
                  >
                    {t('employees.file.openFolder')}
                  </SoftButton>
                  <SoftButton
                    variant="primary"
                    icon={<Paperclip className="size-4" />}
                    onClick={() => setFileOpen(true)}
                  >
                    {t('employees.details.manageFile')}
                  </SoftButton>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<FileText className="size-7" />}
                title={t('employees.details.noFile')}
                body={t('employees.file.noneBody')}
                action={
                  canEditEmployee ? (
                    <SoftButton variant="primary" icon={<Paperclip className="size-4" />} onClick={() => setFileOpen(true)}>
                      {t('employees.file.attach')}
                    </SoftButton>
                  ) : undefined
                }
              />
            )}
          </div>
        )}

        {tab === 'status' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3">
              <span className="text-xs text-ink-low">{t('employees.statusCurrent')}</span>
              <Badge tone={employeeStatusTone(employee.status)} dot>
                {t(`employeeStatuses.${employee.status}`)}
              </Badge>
              <span className="ms-auto">
                {canManageStatus && (
                  <SoftButton
                    variant="ghost"
                    icon={<Activity className="size-4" />}
                    onClick={() => setStatusDialogOpen(true)}
                  >
                    {t('employees.statusTitle')}
                  </SoftButton>
                )}
              </span>
            </div>

            <SectionTitle>{t('employees.statusHistoryTitle')}</SectionTitle>
            {statusHistory.length === 0 ? (
              <EmptyState
                icon={<Activity className="size-7" />}
                title={t('employees.statusHistoryEmpty')}
                body={t('employees.statusHistoryEmptyBody')}
              />
            ) : (
              <div className="relative ms-2 flex flex-col gap-5 border-s-2 border-line-strong py-1 ps-6">
                {statusHistory.map((entry) => (
                  <div key={entry.id} className="relative">
                    <span className="absolute -start-[31px] top-1 size-3 rounded-full border-2 border-accent-400 bg-bg-800" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{t(`employeeStatuses.${entry.fromStatus}`)}</Badge>
                      <ArrowRight className="size-3.5 text-ink-low rtl:rotate-180" />
                      <Badge tone={employeeStatusTone(entry.toStatus)} dot>
                        {t(`employeeStatuses.${entry.toStatus}`)}
                      </Badge>
                      <span className="ms-auto font-mono text-[10px] text-ink-low">
                        {formatDate(entry.changedAt, language)}
                      </span>
                    </div>
                    {entry.reason && (
                      <p dir="auto" className="mt-1.5 text-xs leading-relaxed text-ink-med">
                        {entry.reason}
                      </p>
                    )}
                    {entry.changedBy && (
                      <p className="mt-1 text-[10px] text-ink-low">
                        {t('employees.statusChangedBy')}: {entry.changedBy}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'leaves' && (
          <div>
            {leaves.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-7" />}
                title={t('leaves.noLeaves')}
                body={t('employees.tabLeavesEmpty')}
                action={
                  canCreateLeave ? (
                    <SoftButton
                      variant="primary"
                      icon={<Plus className="size-4" />}
                      onClick={() => setLeaveForm({ leave: null, presetEmployeeId: employee.id })}
                    >
                      {t('leaves.new')}
                    </SoftButton>
                  ) : undefined
                }
              />
            ) : (
              <div className="scroll-area overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-low">
                      <th className="px-4 py-3 text-start font-medium">{t('leaves.type')}</th>
                      <th className="px-4 py-3 text-start font-medium">{t('leaves.period')}</th>
                      <th className="px-4 py-3 text-center font-medium">{t('leaves.daysCount')}</th>
                      <th className="px-4 py-3 text-center font-medium">{t('leaves.year')}</th>
                      <th className="px-4 py-3 text-start font-medium">{t('leaves.status')}</th>
                      <th className="px-4 py-3 text-end font-medium">{t('leaves.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-base">
                    {leaves.map((leave) => (
                      <tr key={leave.id} className="transition-colors hover:bg-surface-soft">
                        <td className="px-4 py-3">
                          <Badge tone={leaveTypeTone(leave.type)}>{t(`leaves.types.${leave.type}`)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span dir="ltr" className="font-mono text-xs text-ink-med">
                            {leave.startDate} → {leave.endDate}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-ink-high">
                          {leave.daysCount}
                        </td>
                        <td className="px-4 py-3 text-center text-[12px] text-ink-low">{leave.year}</td>
                        <td className="px-4 py-3">
                          <Badge tone={leaveStatusTone(leave.status)} dot>
                            {t(`leaves.statuses.${leave.status}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title={t('common.view')}
                              onClick={() => setViewingLeave(leave)}
                              className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                            >
                              <Eye className="size-4" />
                            </button>
                            {canEditLeave && (
                              <button
                                type="button"
                                title={t('common.edit')}
                                onClick={() => setLeaveForm({ leave, presetEmployeeId: employee.id })}
                                className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                              >
                                <Pencil className="size-4" />
                              </button>
                            )}
                            {canDeleteLeave && (
                              <button
                                type="button"
                                title={t('common.delete')}
                                onClick={() => setConfirmDeleteLeave(leave)}
                                className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!TABS.find((item) => item.key === tab)?.available && (
          <EmptyState
            icon={<Clock3 className="size-7" />}
            title={t('employees.soonTitle')}
            body={t('employees.soonBody')}
          />
        )}
      </GlassCard>

      {/* ---------- modals ---------- */}
      <EmployeeFormModal
        open={editOpen}
        employee={employee}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          invalidateEmployee()
        }}
      />

      <EmployeeStatusDialog
        open={statusDialogOpen}
        employee={employee}
        onClose={() => setStatusDialogOpen(false)}
        onChanged={() => invalidateEmployee()}
      />

      <EmployeeFileModal
        open={fileOpen}
        employee={employee}
        onClose={() => setFileOpen(false)}
        onChanged={() => invalidateEmployee()}
      />

      <LeaveFormModal
        open={leaveForm !== null}
        leave={leaveForm?.leave ?? null}
        presetEmployeeId={leaveForm?.presetEmployeeId}
        onClose={() => setLeaveForm(null)}
        onSaved={() => {
          setLeaveForm(null)
          void queryClient.invalidateQueries({ queryKey: ['leaves'] })
        }}
      />

      <LeaveDetailsModal
        open={viewingLeave !== null}
        leave={viewingLeave}
        onClose={() => setViewingLeave(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ['leaves'] })}
        onEdit={() => {
          const leave = viewingLeave
          setViewingLeave(null)
          if (leave) setLeaveForm({ leave, presetEmployeeId: employee.id })
        }}
      />

      <ConfirmDialog
        open={confirmDeleteLeave !== null}
        danger
        loading={deleteLeaveMutation.isPending}
        title={t('leaves.confirmDeleteTitle')}
        body={
          confirmDeleteLeave
            ? t('leaves.confirmDeleteBody', {
                name: employee.name,
                type: t(`leaves.types.${confirmDeleteLeave.type}`)
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDeleteLeave) deleteLeaveMutation.mutate(confirmDeleteLeave.id)
        }}
        onClose={() => setConfirmDeleteLeave(null)}
      />
    </motion.div>
  )
}
