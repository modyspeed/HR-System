import { useTranslation } from 'react-i18next'
import { FileSpreadsheet, FileText, Pencil, Paperclip, Upload } from 'lucide-react'
import type { EmployeeRecord } from '@shared/types'
import { avatarGradient, cn, formatDate, formatDateOnly, formatFileSize, initials } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'

interface EmployeeDetailsModalProps {
  open: boolean
  employee: EmployeeRecord | null
  onClose: () => void
  /** Open the edit form for this employee. */
  onEdit: () => void
  /** Open the work-file popup for this employee. */
  onManageFile: () => void
}

function extensionOf(name: string | null): string {
  if (!name) return ''
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 mt-6 text-[11px] font-semibold uppercase tracking-wider text-accent-300 first:mt-0">
      {children}
    </h3>
  )
}

function DetailField({
  label,
  value,
  ltr = false,
  mono = false
}: {
  label: string
  value: string
  ltr?: boolean
  mono?: boolean
}) {
  return (
    <div className="rounded-2xl bg-surface-soft px-4 py-3 shadow-[var(--shadow-inset)]">
      <p className="text-[11px] text-ink-low">{label}</p>
      <p
        dir={ltr ? 'ltr' : 'auto'}
        className={cn(
          'mt-1 text-sm font-medium break-words text-ink-high',
          mono && 'font-mono text-[13px]',
          !value && 'text-ink-low'
        )}
      >
        {value || '—'}
      </p>
    </div>
  )
}

export function EmployeeDetailsModal({
  open,
  employee,
  onClose,
  onEdit,
  onManageFile
}: EmployeeDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const canEdit = usePermission('employees.edit')

  const hasFile = Boolean(employee?.fileOriginalName)
  const ext = extensionOf(employee?.fileOriginalName ?? null)
  const isPdf = ext === '.pdf'

  const date = (value: string | null) => formatDateOnly(value, language)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        employee ? (
          <span className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-[var(--shadow-raised)]"
              style={{ background: avatarGradient(employee.id) }}
              aria-hidden
            >
              {initials(employee.name)}
            </span>
            <span className="min-w-0 truncate">{employee.name}</span>
          </span>
        ) : (
          t('employees.details.title')
        )
      }
      description={employee ? `${t('employees.code')}: ${employee.code}` : undefined}
      footer={
        employee && (
          <>
            {(hasFile || canEdit) && (
              <SoftButton
                variant="ghost"
                icon={
                  hasFile ? (
                    <Paperclip className="size-4" />
                  ) : (
                    <Upload className="size-4" />
                  )
                }
                onClick={onManageFile}
              >
                {hasFile ? t('employees.details.manageFile') : t('employees.file.attach')}
              </SoftButton>
            )}
            {canEdit && (
              <SoftButton
                variant="ghost"
                icon={<Pencil className="size-4" />}
                onClick={onEdit}
              >
                {t('employees.details.edit')}
              </SoftButton>
            )}
            <SoftButton variant="primary" onClick={onClose}>
              {t('common.close')}
            </SoftButton>
          </>
        )
      }
    >
      {employee && (
        <div className="py-1">
          {/* basic */}
          <SectionTitle>{t('employees.details.sectionBasic')}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label={t('employees.code')} value={employee.code} ltr mono />
            <div className="rounded-2xl bg-surface-soft px-4 py-3 shadow-[var(--shadow-inset)]">
              <p className="text-[11px] text-ink-low">{t('employees.status')}</p>
              <div className="mt-1.5">
                <Badge tone={employee.isActive ? 'teal' : 'rose'} dot>
                  {employee.isActive
                    ? t('employees.activeBadge')
                    : t('employees.inactiveBadge')}
                </Badge>
              </div>
            </div>
          </div>

          {/* identity */}
          <SectionTitle>{t('employees.details.sectionIdentity')}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField
              label={t('employees.insuranceNo')}
              value={employee.insuranceNo ?? ''}
              ltr
              mono
            />
            <DetailField
              label={t('employees.nationalId')}
              value={employee.nationalId ?? ''}
              ltr
              mono
            />
          </div>

          {/* work */}
          <SectionTitle>{t('employees.details.sectionWork')}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label={t('employees.department')} value={employee.departmentName ?? ''} />
            <DetailField label={t('employees.contractType')} value={employee.contractType ?? ''} />
            <DetailField label={t('employees.grade')} value={employee.grade ?? ''} />
            <DetailField
              label={t('employees.hireDate')}
              value={date(employee.hireDate)}
              ltr
            />
            <DetailField
              label={t('employees.gradeDate')}
              value={date(employee.gradeDate)}
              ltr
            />
            <DetailField
              label={t('employees.permanentDate')}
              value={date(employee.permanentDate)}
              ltr
            />
          </div>

          {/* personal */}
          <SectionTitle>{t('employees.details.sectionPersonal')}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField
              label={t('employees.birthDate')}
              value={date(employee.birthDate)}
              ltr
            />
            <DetailField label={t('employees.qualification')} value={employee.qualification ?? ''} />
            <DetailField
              label={t('employees.qualificationYear')}
              value={
                employee.qualificationYear !== null ? String(employee.qualificationYear) : ''
              }
              ltr
              mono
            />
          </div>

          {/* work file */}
          <SectionTitle>{t('employees.details.sectionFile')}</SectionTitle>
          {hasFile ? (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-soft p-4 shadow-[var(--shadow-inset)]">
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl border',
                  isPdf
                    ? 'border-rose-400/25 bg-rose-500/10 text-rose-400'
                    : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-400'
                )}
              >
                {isPdf ? (
                  <FileText className="size-5" />
                ) : (
                  <FileSpreadsheet className="size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-high" dir="auto">
                  {employee.fileOriginalName}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-low">
                  <span className="rounded bg-surface-strong px-1.5 py-0.5 font-mono uppercase">
                    {ext.replace('.', '')}
                  </span>
                  <span>{formatFileSize(employee.fileSize)}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {t('employees.file.linkedAt')}: {formatDate(employee.fileLinkedAt, language)}
                  </span>
                </p>
              </div>
              <Paperclip className="size-4 shrink-0 text-accent-300" />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center text-xs text-ink-low">
              {t('employees.details.noFile')}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
