import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck, Copy, FilePlus2 } from 'lucide-react'
import type { EmployeeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SoftButton } from '@/components/ui/SoftButton'
import { Badge } from '@/components/ui/Badge'

interface RehireDialogProps {
  open: boolean
  source: EmployeeRecord | null
  onClose: () => void
  /** Called with the new employee id after a successful rehire. */
  onRehired: (newEmployeeId: string) => void
}

interface FormValues {
  code: string
  contractType: string
  hireDate: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * عقد جديد لموظف سابق: يُنشئ سجل موظف جديد بنفس البيانات الشخصية للملف
 * الحالي (الذي يبقى كما هو بحالته) مع رقم موظف جديد ونوع تعاقد جديد.
 */
export function RehireDialog({ open, source, onClose, onRehired }: RehireDialogProps) {
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .min(1, t('validation.required'))
          .max(40, t('validation.codePattern'))
          .regex(/^[0-9a-zA-Z._-]+$/, t('validation.codePattern')),
        contractType: z.string().trim().min(1, t('validation.required')),
        hireDate: z
          .string()
          .trim()
          .min(1, t('validation.required'))
          .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), { message: t('validation.dateInvalid') })
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
    defaultValues: { code: '', contractType: '', hireDate: todayIso() }
  })

  useEffect(() => {
    reset({ code: '', contractType: '', hireDate: todayIso() })
  }, [open, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.employees.rehire(source!.id, {
        code: values.code.trim(),
        contractType: values.contractType.trim(),
        hireDate: values.hireDate
      })
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await mutation.mutateAsync(values)
      toast.success(t('toasts.employeeRehired'), { description: created.code })
      onRehired(created.id)
    } catch (error) {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const busy = isSubmitting || mutation.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <FilePlus2 className="size-4 text-accent-300" />
          {t('employees.rehireTitle')}
        </span>
      }
      description={t('employees.rehireHint')}
      size="md"
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
            {t('employees.rehireSave')}
          </SoftButton>
        </>
      }
    >
      {source && (
        <div className="flex flex-col gap-4 py-2">
          {/* copied data summary */}
          <div className="rounded-2xl border border-line bg-surface-soft px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-low">
              <Copy className="size-3" />
              {t('employees.rehireCopied')}
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-ink-med sm:grid-cols-2">
              <li dir="auto">{source.name}</li>
              <li className="font-mono">{source.insuranceNo ?? '—'}</li>
              <li className="font-mono">{source.nationalId ?? '—'}</li>
              <li dir="ltr" className="font-mono text-end">
                {source.birthDate ?? '—'}
              </li>
              <li dir="auto">{source.qualification ?? '—'}</li>
              <li>{t('employees.rehireDepartment')}: {source.departmentName ?? t('departments.noDepartment')}</li>
            </ul>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              label={t('employees.rehireNewCode')}
              dir="ltr"
              icon={<FilePlus2 className="size-4" />}
              placeholder="1809-A"
              error={errors.code?.message}
              autoFocus
              {...register('code')}
            />
            <Input
              label={t('employees.rehireContractType')}
              dir="auto"
              placeholder={t('employees.contractType')}
              error={errors.contractType?.message}
              {...register('contractType')}
            />
            <Input
              label={t('employees.rehireHireDate')}
              type="date"
              dir="ltr"
              error={errors.hireDate?.message}
              {...register('hireDate')}
            />
          </form>

          <p className="flex items-start gap-2 rounded-2xl border border-line bg-surface-soft px-4 py-3 text-[11px] leading-relaxed text-ink-low">
            <Badge tone="gold">{t('employees.rehireNoteTitle')}</Badge>
            <span>{t('employees.rehireNote')}</span>
          </p>
        </div>
      )}
    </Modal>
  )
}
