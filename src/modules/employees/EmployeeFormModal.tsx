import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck, Hash, User } from 'lucide-react'
import type { EmployeeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { Toggle } from '@/components/ui/Toggle'

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
  contractType: string
  departmentId: string
  isActive: boolean
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function EmployeeFormModal({ open, employee, onClose, onSaved }: EmployeeFormModalProps) {
  const { t } = useTranslation()
  const isEdit = employee !== null

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
      contractType: z.string().trim().optional(),
      departmentId: z.string().trim().optional(),
      isActive: z.boolean()
    })
  }, [t])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
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
      contractType: '',
      departmentId: '',
      isActive: true
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
      contractType: employee?.contractType ?? '',
      departmentId: employee?.departmentId ?? '',
      isActive: employee?.isActive ?? true
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
    contractType: values.contractType.trim() || null,
    departmentId: values.departmentId || null,
    isActive: values.isActive
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
        <Input
          label={t('employees.contractType')}
          placeholder={t('employees.contractTypeHint')}
          error={errors.contractType?.message}
          autoComplete="off"
          {...register('contractType')}
        />
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
        <div className="sm:col-span-2">
          <div className="flex cursor-pointer items-center justify-between gap-3 rounded-full bg-surface-soft px-5 py-3 shadow-[var(--shadow-inset)]">
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-ink-high">{t('employees.status')}</span>
              <span className="text-[11px] text-ink-low">
                {t('employees.active')} / {t('employees.inactive')}
              </span>
            </span>
            <Toggle
              checked={watch('isActive')}
              onChange={(value) => setValue('isActive', value)}
              label={t('employees.status')}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
