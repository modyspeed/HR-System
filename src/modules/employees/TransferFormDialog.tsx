import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarDays, FileText } from 'lucide-react'
import type { DepartmentTransferRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'

interface TransferFormDialogProps {
  open: boolean
  employeeId: string
  transfer: DepartmentTransferRecord | null
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  fromDepartmentId: string
  toDepartmentId: string
  fromDate: string
  toDate: string
  note: string
  applyAsCurrent: boolean
}

/** تسجيل تنقل بين الأقسام: من → إلى مع الفترة والملاحظة، واعتماد الهدف كقسم حالي. */
export function TransferFormDialog({
  open,
  employeeId,
  transfer,
  onClose,
  onSaved
}: TransferFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = transfer !== null

  const schema = useMemo(
    () =>
      z
        .object({
          fromDepartmentId: z.string().trim().optional(),
          toDepartmentId: z.string().trim().min(1, t('validation.required')),
          fromDate: z
            .string()
            .trim()
            .min(1, t('validation.required'))
            .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), { message: t('validation.dateInvalid') }),
          toDate: z
            .string()
            .trim()
            .optional()
            .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: t('validation.dateInvalid') }),
          note: z.string().trim().optional(),
          applyAsCurrent: z.boolean()
        })
        .refine((values) => !values.toDate || values.toDate >= values.fromDate, {
          message: t('employees.transferRangeInvalid'),
          path: ['toDate']
        }),
    [t]
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromDepartmentId: '',
      toDepartmentId: '',
      fromDate: '',
      toDate: '',
      note: '',
      applyAsCurrent: true
    }
  })

  useEffect(() => {
    if (!open) return
    reset({
      fromDepartmentId: transfer?.fromDepartmentId ?? '',
      toDepartmentId: transfer?.toDepartmentId ?? '',
      fromDate: transfer?.fromDate ?? '',
      toDate: transfer?.toDate ?? '',
      note: transfer?.note ?? '',
      applyAsCurrent: true
    })
  }, [open, transfer, reset])

  const departmentsQuery = useQuery({
    queryKey: ['departments', 'list', { search: undefined, isActive: null, sort: 'code', order: 'asc' }],
    queryFn: () => api.departments.list({}),
    enabled: open
  })
  const departmentOptions = (departmentsQuery.data ?? [])
    .filter((department) => department.isActive)
    .map((department) => ({ value: department.id, label: department.name }))

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.employees.departmentTransfers.create({
        employeeId,
        fromDepartmentId: values.fromDepartmentId || null,
        toDepartmentId: values.toDepartmentId,
        fromDate: values.fromDate,
        toDate: values.toDate || null,
        note: values.note.trim() || null,
        applyAsCurrent: values.applyAsCurrent
      })
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.employees.departmentTransfers.update(transfer!.id, {
        fromDepartmentId: values.fromDepartmentId || null,
        toDepartmentId: values.toDepartmentId,
        fromDate: values.fromDate,
        toDate: values.toDate || null,
        note: values.note.trim() || null,
        applyAsCurrent: values.applyAsCurrent
      })
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
        toast.success(t('toasts.transferUpdated'))
      } else {
        await createMutation.mutateAsync(values)
        toast.success(t('toasts.transferCreated'))
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
      title={isEdit ? t('employees.transferEditTitle') : t('employees.transferAddTitle')}
      description={t('employees.transferFormHint')}
      size="md"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </SoftButton>
          <SoftButton variant="primary" loading={busy} onClick={() => void onSubmit()}>
            {t('common.save')}
          </SoftButton>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2" noValidate>
        <Select
          label={t('employees.transferFromDepartment')}
          value={watch('fromDepartmentId')}
          onChange={(event) => setValue('fromDepartmentId', event.target.value, { shouldValidate: true })}
          options={departmentOptions}
          placeholder={t('employees.transferNoFrom')}
        />
        <Select
          label={t('employees.transferToDepartment')}
          value={watch('toDepartmentId')}
          onChange={(event) => setValue('toDepartmentId', event.target.value, { shouldValidate: true })}
          options={departmentOptions}
          placeholder={t('employees.transferSelectTo')}
          error={errors.toDepartmentId?.message}
        />
        <Input
          label={t('employees.transferFromDate')}
          type="date"
          dir="ltr"
          icon={<CalendarDays className="size-4" />}
          error={errors.fromDate?.message}
          {...register('fromDate')}
        />
        <Input
          label={t('employees.transferToDate')}
          type="date"
          dir="ltr"
          hint={t('employees.transferToDateHint')}
          error={errors.toDate?.message}
          {...register('toDate')}
        />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="transfer-note" className="text-xs font-medium text-ink-med">
            {t('employees.transferNote')}
          </label>
          <div className="field flex items-start gap-2.5 px-5 py-3.5">
            <FileText className="mt-0.5 size-4 shrink-0 text-ink-low" />
            <textarea
              id="transfer-note"
              rows={3}
              placeholder={t('employees.transferNotePlaceholder')}
              className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-ink-high placeholder:text-ink-low outline-none"
              {...register('note')}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3 sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent-500)]"
            checked={watch('applyAsCurrent')}
            onChange={(event) => setValue('applyAsCurrent', event.target.checked)}
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink-high">{t('employees.transferApplyAsCurrent')}</span>
            <span className="text-[11px] text-ink-low">{t('employees.transferApplyAsCurrentHint')}</span>
          </span>
        </label>
      </form>
    </Modal>
  )
}