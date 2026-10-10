import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck, Hash, Settings2, User } from 'lucide-react'
import type { EmployeeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { usePermission } from '@/hooks/usePermission'
import { ContractTypesDialog } from './ContractTypesDialog'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'

interface EmployeeFormModalProps {
  open: boolean
  employee: EmployeeRecord | null
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  code: string
  name: string
  insuranceNo: string
  nationalId: string
  grade: string
  gradeDate: string
  birthDate: string
  permanentDate: string
  hireDate: string
  qualification: string
  qualificationYear: string
  contractTypeId: string
  departmentId: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function EmployeeFormModal({ open, employee, onClose, onSaved }: EmployeeFormModalProps) {
  const { t } = useTranslation()
  const isEdit = employee !== null
  const canManageTypes = usePermission('employees.manage_contract_types')
  const [manageTypesOpen, setManageTypesOpen] = useState(false)

  const schema = useMemo(() => {
    const optionalDate = z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || ISO_DATE.test(value), { message: t('validation.dateInvalid') })

    return z.object({
      code: z.string().trim().min(1, t('validation.required')),
      name: z.string().trim().min(1, t('validation.required')),
      insuranceNo: z.string().trim().optional(),
      nationalId: z.string().trim().optional(),
      grade: z.string().trim().optional(),
      gradeDate: optionalDate,
      birthDate: optionalDate,
      permanentDate: optionalDate,
      hireDate: optionalDate,
      qualification: z.string().trim().optional(),
      qualificationYear: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || /^\d{4}$/.test(value), { message: t('validation.yearInvalid') }),
      contractTypeId: z.string().trim().optional(),
      departmentId: z.string().trim().optional()
    })
  }, [t])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      insuranceNo: '',
      nationalId: '',
      grade: '',
      gradeDate: '',
      birthDate: '',
      permanentDate: '',
      hireDate: '',
      qualification: '',
      qualificationYear: '',
      contractTypeId: '',
      departmentId: ''
    }
  })

  useEffect(() => {
    if (!open) return
    reset({
      code: employee?.code ?? '',
      name: employee?.name ?? '',
      insuranceNo: employee?.insuranceNo ?? '',
      nationalId: employee?.nationalId ?? '',
      grade: employee?.grade ?? '',
      gradeDate: employee?.gradeDate ?? '',
      birthDate: employee?.birthDate ?? '',
      permanentDate: employee?.permanentDate ?? '',
      hireDate: employee?.hireDate ?? '',
      qualification: employee?.qualification ?? '',
      qualificationYear: employee?.qualificationYear ? String(employee.qualificationYear) : '',
      contractTypeId:
        employee?.contractTypeId ??
        (employee?.contractType ? `__legacy__${employee.contractType}` : ''),
      departmentId: employee?.departmentId ?? ''
    })
  }, [open, employee, reset])

  // department picker — cached under the same key the departments list uses
  const departmentsQuery = useQuery({
    queryKey: ['departments', 'list', { search: undefined, isActive: null, sort: 'code', order: 'asc' }],
    queryFn: () => api.departments.list({}),
    enabled: open
  })
  const departmentOptions = (departmentsQuery.data ?? []).map((department) => ({
    value: department.id,
    label: department.name
  }))

  const contractTypesQuery = useQuery({
    queryKey: ['employees', 'contractTypes'],
    queryFn: () => api.employees.contractTypeList(),
    enabled: open
  })
  const catalogTypes = contractTypesQuery.data ?? []
  const currentName = employee?.contractType?.trim()
  const currentInCatalog = Boolean(
    currentName && catalogTypes.some((type) => type.name === currentName)
  )
  const contractOptions = [
    ...catalogTypes.map((type) => ({ value: type.id, label: type.name })),
    ...(currentName && !currentInCatalog
      ? [{ value: `__legacy__${currentName}`, label: `${currentName} *` }]
      : [])
  ]

  const toInput = (values: FormValues) => ({
    code: values.code.trim(),
    name: values.name.trim(),
    insuranceNo: values.insuranceNo.trim() || null,
    nationalId: values.nationalId.trim() || null,
    grade: values.grade.trim() || null,
    gradeDate: values.gradeDate || null,
    birthDate: values.birthDate || null,
    permanentDate: values.permanentDate || null,
    hireDate: values.hireDate || null,
    qualification: values.qualification.trim() || null,
    qualificationYear: values.qualificationYear ? Number(values.qualificationYear) : null,
    contractType: values.contractTypeId.startsWith('__legacy__')
      ? values.contractTypeId.slice('__legacy__'.length)
      : undefined,
    contractTypeId: values.contractTypeId.startsWith('__legacy__')
      ? null
      : values.contractTypeId || null,
    departmentId: values.departmentId || null
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.employees.create(toInput(values))
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => api.employees.update(employee!.id, toInput(values))
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
        toast.success(t('toasts.employeeUpdated'))
      } else {
        await createMutation.mutateAsync(values)
        toast.success(t('toasts.employeeCreated'))
      }
      onSaved()
    } catch (error) {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const busy = isSubmitting || createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('employees.editTitle') : t('employees.createTitle')}
      description={t('employees.subtitle')}
      size="lg"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </SoftButton>
          <SoftButton
            variant="primary"
            loading={busy}
            icon={<BadgeCheck className="size-4" />}
            onClick={() => void onSubmit()}
          >
            {t('common.save')}
          </SoftButton>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2" noValidate>
        <Input
          label={t('employees.code')}
          icon={<Hash className="size-4" />}
          error={errors.code?.message}
          autoComplete="off"
          {...register('code')}
        />
        <Input
          label={t('employees.name')}
          icon={<User className="size-4" />}
          error={errors.name?.message}
          autoComplete="off"
          {...register('name')}
        />
        <Input
          label={t('employees.insuranceNo')}
          dir="ltr"
          error={errors.insuranceNo?.message}
          autoComplete="off"
          {...register('insuranceNo')}
        />
        <Input
          label={t('employees.nationalId')}
          dir="ltr"
          error={errors.nationalId?.message}
          autoComplete="off"
          {...register('nationalId')}
        />
        <Input
          label={t('employees.grade')}
          error={errors.grade?.message}
          autoComplete="off"
          {...register('grade')}
        />
        <Input
          label={t('employees.qualification')}
          error={errors.qualification?.message}
          autoComplete="off"
          {...register('qualification')}
        />
        <Input
          label={t('employees.qualificationYear')}
          inputMode="numeric"
          placeholder="1986"
          dir="ltr"
          error={errors.qualificationYear?.message}
          autoComplete="off"
          {...register('qualificationYear')}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="contract-type" className="text-xs font-medium text-ink-med">
              {t('employees.contractType')}
            </label>
            {canManageTypes && (
              <button
                type="button"
                onClick={() => setManageTypesOpen(true)}
                className="focus-ring flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent-300 transition-colors hover:bg-surface-strong"
              >
                <Settings2 className="size-3" />
                {t('employees.contractTypesManage')}
              </button>
            )}
          </div>
          <Select
            containerClassName="w-full"
            id="contract-type"
            value={watch('contractTypeId')}
            onChange={(event) => setValue('contractTypeId', event.target.value)}
            options={contractOptions}
            placeholder={t('employees.contractTypePlaceholder')}
            error={errors.contractTypeId?.message}
          />
          {currentName && !currentInCatalog && (
            <p className="text-[11px] leading-relaxed text-ink-low">{t('employees.contractTypeLegacy')}</p>
          )}
        </div>
        <Select
          label={t('employees.department')}
          options={departmentOptions}
          placeholder={departmentsQuery.isLoading ? '…' : t('employees.noDepartment')}
          error={errors.departmentId?.message}
          {...register('departmentId')}
        />
        <Input
          label={t('employees.hireDate')}
          type="date"
          dir="ltr"
          error={errors.hireDate?.message}
          {...register('hireDate')}
        />
        <Input
          label={t('employees.birthDate')}
          type="date"
          dir="ltr"
          error={errors.birthDate?.message}
          {...register('birthDate')}
        />
        <Input
          label={t('employees.permanentDate')}
          type="date"
          dir="ltr"
          error={errors.permanentDate?.message}
          {...register('permanentDate')}
        />
        <Input
          containerClassName="sm:col-span-2"
          label={t('employees.gradeDate')}
          type="date"
          dir="ltr"
          error={errors.gradeDate?.message}
          {...register('gradeDate')}
        />

        <ContractTypesDialog
          open={manageTypesOpen}
          onClose={() => setManageTypesOpen(false)}
        />
      </form>
    </Modal>
  )
}
