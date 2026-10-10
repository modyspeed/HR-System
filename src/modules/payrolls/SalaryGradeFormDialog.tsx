import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Banknote, CalendarDays, FileText } from 'lucide-react'
import type { SalaryGradeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SoftButton } from '@/components/ui/SoftButton'

interface SalaryGradeFormDialogProps {
  open: boolean
  employeeId: string
  grade: SalaryGradeRecord | null
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  date: string
  amount: string
  note: string
}

/** سجل تدرج أساسي: تاريخ السريان + القيمة + ملاحظات. */
export function SalaryGradeFormDialog({
  open,
  employeeId,
  grade,
  onClose,
  onSaved
}: SalaryGradeFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = grade !== null

  const schema = useMemo(
    () =>
      z.object({
        date: z
          .string()
          .trim()
          .min(1, t('validation.required'))
          .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), { message: t('validation.dateInvalid') }),
        amount: z
          .string()
          .trim()
          .min(1, t('validation.required'))
          .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0, {
            message: t('validation.numberInvalid')
          }),
        note: z.string().trim().optional()
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: '', amount: '', note: '' }
  })

  useEffect(() => {
    if (!open) return
    reset({
      date: grade?.date ?? '',
      amount: grade ? String(grade.amount) : '',
      note: grade?.note ?? ''
    })
  }, [open, grade, reset])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.payrolls.salaryGrades.create({
        employeeId,
        date: values.date,
        amount: Number(values.amount),
        note: values.note.trim() || null
      })
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.payrolls.salaryGrades.update(grade!.id, {
        employeeId,
        date: values.date,
        amount: Number(values.amount),
        note: values.note.trim() || null
      })
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
        toast.success(t('toasts.salaryGradeUpdated'))
      } else {
        await createMutation.mutateAsync(values)
        toast.success(t('toasts.salaryGradeCreated'))
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
      title={isEdit ? t('payrolls.gradeEditTitle') : t('payrolls.gradeAddTitle')}
      description={t('payrolls.gradeFormHint')}
      size="sm"
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
      <form onSubmit={onSubmit} className="flex flex-col gap-4 py-2" noValidate>
        <Input
          label={t('payrolls.gradeDate')}
          type="date"
          dir="ltr"
          icon={<CalendarDays className="size-4" />}
          error={errors.date?.message}
          {...register('date')}
        />
        <Input
          label={t('payrolls.gradeAmount')}
          inputMode="decimal"
          dir="ltr"
          icon={<Banknote className="size-4" />}
          placeholder="8255.98"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="grade-note" className="text-xs font-medium text-ink-med">
            {t('payrolls.gradeNote')}
          </label>
          <div className="field flex items-start gap-2.5 px-5 py-3.5">
            <FileText className="mt-0.5 size-4 shrink-0 text-ink-low" />
            <textarea
              id="grade-note"
              rows={3}
              placeholder={t('payrolls.gradeNotePlaceholder')}
              className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-ink-high placeholder:text-ink-low outline-none"
              {...register('note')}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}