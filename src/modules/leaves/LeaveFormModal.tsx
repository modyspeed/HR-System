import { useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck, CalendarDays, Contact, FileText } from 'lucide-react'
import type { LeaveRecord } from '@shared/types'
import { LEAVE_STATUS_KEYS, LEAVE_TYPE_KEYS } from '@shared/leaves'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { EmployeePicker } from './EmployeePicker'

interface LeaveFormModalProps {
  open: boolean
  leave: LeaveRecord | null
  /** Pre-selects the employee when creating a leave from an employee profile. */
  presetEmployeeId?: string
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  employeeId: string
  type: string
  startDate: string
  endDate: string
  daysCount: string
  status: string
  reason: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function inclusiveDays(start: string, end: string): number | null {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return null
  const from = new Date(`${start}T00:00:00.000Z`)
  const to = new Date(`${end}T00:00:00.000Z`)
  if (to < from) return null
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
}

export function LeaveFormModal({ open, leave, presetEmployeeId, onClose, onSaved }: LeaveFormModalProps) {
  const { t } = useTranslation()
  const isEdit = leave !== null

  const schema = useMemo(() => {
    const requiredDate = z
      .string()
      .trim()
      .min(1, t('validation.required'))
      .refine((value) => ISO_DATE.test(value), { message: t('validation.dateInvalid') })

    return z
      .object({
        employeeId: z.string().trim().min(1, t('validation.required')),
        type: z.string().trim().min(1, t('validation.required')),
        startDate: requiredDate,
        endDate: requiredDate,
        daysCount: z
          .string()
          .trim()
          .refine((value) => /^\d{1,3}$/.test(value), { message: t('validation.numberInvalid') }),
        status: z.string().trim().min(1, t('validation.required')),
        reason: z.string().trim().optional()
      })
      .refine((values) => !values.endDate || !values.startDate || values.endDate >= values.startDate, {
        message: t('leaves.validation.range'),
        path: ['endDate']
      })
      .refine((values) => !values.daysCount || Number(values.daysCount) >= 1, {
        message: t('validation.numberInvalid'),
        path: ['daysCount']
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
      employeeId: '',
      type: '',
      startDate: '',
      endDate: '',
      daysCount: '',
      status: 'pending',
      reason: ''
    }
  })

  const watchedEmployeeId = watch('employeeId')

  useEffect(() => {
    if (!open) return
    reset({
      employeeId: leave?.employeeId ?? presetEmployeeId ?? '',
      type: leave?.type ?? '',
      startDate: leave?.startDate ?? '',
      endDate: leave?.endDate ?? '',
      daysCount: leave ? String(leave.daysCount) : '',
      status: leave?.status ?? 'pending',
      reason: leave?.reason ?? ''
    })
  }, [open, leave, presetEmployeeId, reset])

  // Days are derived from the inclusive date range; the user can still fine-tune.
  const startDate = watch('startDate')
  const endDate = watch('endDate')
  useEffect(() => {
    const days = inclusiveDays(startDate, endDate)
    if (days !== null) setValue('daysCount', String(days))
  }, [startDate, endDate, setValue])

  const year = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate.slice(0, 4) : '—'

  const handleEmployeeSelect = useCallback(
    (employeeId: string) => setValue('employeeId', employeeId, { shouldValidate: true }),
    [setValue]
  )

  const typeOptions = LEAVE_TYPE_KEYS.map((key) => ({ value: key, label: t(`leaves.types.${key}`) }))
  const statusOptions = LEAVE_STATUS_KEYS.map((key) => ({
    value: key,
    label: t(`leaves.statuses.${key}`)
  }))

  const watchedType = watch('type')

  const toInput = (values: FormValues) => ({
    employeeId: values.employeeId.trim(),
    type: values.type.trim(),
    startDate: values.startDate,
    endDate: values.endDate,
    daysCount: Number(values.daysCount),
    status: values.status.trim(),
    reason: values.reason.trim() || null
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.leaves.create(toInput(values))
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => api.leaves.update(leave!.id, toInput(values))
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
        toast.success(t('toasts.leaveUpdated'))
      } else {
        await createMutation.mutateAsync(values)
        toast.success(t('toasts.leaveCreated'))
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
      title={isEdit ? t('leaves.editTitle') : t('leaves.createTitle')}
      description={t('leaves.formHint')}
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
        <EmployeePicker
          value={watchedEmployeeId}
          onSelect={handleEmployeeSelect}
          error={errors.employeeId?.message}
        />

        <Select
          containerClassName="sm:col-span-2"
          label={t('leaves.type')}
          options={typeOptions}
          placeholder={t('leaves.selectType')}
          hint={watchedType ? t(`leaves.typeHints.${watchedType}`) : t('leaves.typeHintGeneral')}
          error={errors.type?.message}
          {...register('type')}
        />

        <Input
          label={t('leaves.startDate')}
          type="date"
          dir="ltr"
          icon={<CalendarDays className="size-4" />}
          error={errors.startDate?.message}
          {...register('startDate')}
        />
        <Input
          label={t('leaves.endDate')}
          type="date"
          dir="ltr"
          error={errors.endDate?.message}
          {...register('endDate')}
        />

        <Input
          label={t('leaves.daysCount')}
          inputMode="numeric"
          dir="ltr"
          hint={t('leaves.daysCountHint')}
          error={errors.daysCount?.message}
          {...register('daysCount')}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-med">{t('leaves.year')}</label>
          <div className="field flex h-12 items-center px-5">
            <span className="text-sm font-bold tabular-nums text-ink-high">{year}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-low">{t('leaves.yearHint')}</p>
        </div>

        <Select
          containerClassName="sm:col-span-2"
          label={t('leaves.status')}
          options={statusOptions}
          error={errors.status?.message}
          placeholder={t('leaves.allStatuses')}
          {...register('status')}
        />

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="leave-reason" className="text-xs font-medium text-ink-med">
            {t('leaves.reason')}
          </label>
          <div className={cn('field flex items-start gap-2.5 px-5 py-3.5', errors.reason && 'field-invalid')}>
            <FileText className="mt-0.5 size-4 shrink-0 text-ink-low" />
            <textarea
              id="leave-reason"
              rows={3}
              placeholder={t('leaves.reasonPlaceholder')}
              className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-ink-high placeholder:text-ink-low outline-none"
              {...register('reason')}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-ink-low">{t('leaves.reasonHint')}</p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-soft px-4 py-3 sm:col-span-2">
          <Contact className="size-4 shrink-0 text-accent-300" />
          <p className="text-[11px] leading-relaxed text-ink-low">{t('leaves.formNote')}</p>
        </div>
      </form>
    </Modal>
  )
}
