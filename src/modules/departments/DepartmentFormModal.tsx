import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Hash, Percent } from 'lucide-react'
import type { DepartmentRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SoftButton } from '@/components/ui/SoftButton'
import { Toggle } from '@/components/ui/Toggle'

interface DepartmentFormModalProps {
  open: boolean
  department: DepartmentRecord | null
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  code: string
  name: string
  natureAllowancePct: string
  isActive: boolean
}

export function DepartmentFormModal({
  open,
  department,
  onClose,
  onSaved
}: DepartmentFormModalProps) {
  const { t } = useTranslation()
  const isEdit = department !== null

  const schema = useMemo(
    () =>
      z.object({
        code: z.string().trim().min(1, t('validation.required')),
        name: z.string().trim().min(1, t('validation.required')),
        natureAllowancePct: z
          .string()
          .trim()
          .optional()
          .refine((value) => !value || !Number.isNaN(Number(value)), {
            message: t('validation.numberRequired')
          })
          .refine((value) => !value || (Number(value) >= 0 && Number(value) <= 100), {
            message: t('validation.pctRange')
          }),
        isActive: z.boolean()
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', natureAllowancePct: '', isActive: true }
  })

  useEffect(() => {
    if (!open) return
    reset({
      code: department?.code ?? '',
      name: department?.name ?? '',
      natureAllowancePct:
        department?.natureAllowancePct === null || department?.natureAllowancePct === undefined
          ? ''
          : String(department.natureAllowancePct),
      isActive: department?.isActive ?? true
    })
  }, [open, department, reset])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.departments.create({
        code: values.code.trim(),
        name: values.name.trim(),
        natureAllowancePct: values.natureAllowancePct ? Number(values.natureAllowancePct) : null,
        isActive: values.isActive
      })
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.departments.update(department!.id, {
        code: values.code.trim(),
        name: values.name.trim(),
        natureAllowancePct: values.natureAllowancePct ? Number(values.natureAllowancePct) : null,
        isActive: values.isActive
      })
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
        toast.success(t('toasts.departmentUpdated'))
      } else {
        await createMutation.mutateAsync(values)
        toast.success(t('toasts.departmentCreated'))
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
      title={isEdit ? t('departments.editTitle') : t('departments.createTitle')}
      description={t('departments.subtitle')}
      size="md"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </SoftButton>
          <SoftButton
            variant="primary"
            loading={busy}
            icon={<Building2 className="size-4" />}
            onClick={() => void onSubmit()}
          >
            {t('common.save')}
          </SoftButton>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2" noValidate>
        <Input
          label={t('departments.code')}
          icon={<Hash className="size-4" />}
          error={errors.code?.message}
          autoComplete="off"
          {...register('code')}
        />
        <Input
          label={t('departments.name')}
          icon={<Building2 className="size-4" />}
          error={errors.name?.message}
          autoComplete="off"
          {...register('name')}
        />
        <Input
          containerClassName="sm:col-span-2"
          label={t('departments.allowance')}
          hint={t('departments.allowanceHint')}
          icon={<Percent className="size-4" />}
          error={errors.natureAllowancePct?.message}
          inputMode="decimal"
          placeholder="0 - 100"
          autoComplete="off"
          {...register('natureAllowancePct')}
        />
        <div className="sm:col-span-2">
          <div className="flex cursor-pointer items-center justify-between gap-3 rounded-full bg-surface-soft px-5 py-3 shadow-[var(--shadow-inset)]">
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-ink-high">{t('departments.status')}</span>
              <span className="text-[11px] text-ink-low">
                {t('departments.active')} / {t('departments.inactive')}
              </span>
            </span>
            <Toggle
              checked={watch('isActive')}
              onChange={(value) => setValue('isActive', value)}
              label={t('departments.status')}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
