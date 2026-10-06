import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Mail, User } from 'lucide-react'
import type { RoleRecord, UserRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { Toggle } from '@/components/ui/Toggle'

interface UserFormModalProps {
  open: boolean
  user: UserRecord | null
  roles: RoleRecord[]
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  fullName: string
  username: string
  email: string
  roleId: string
  password: string
  isActive: boolean
}

export function UserFormModal({ open, user, roles, onClose, onSaved }: UserFormModalProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const isEdit = user !== null

  const schema = useMemo(() => {
    const base = z.object({
      fullName: z.string().trim().min(3, t('validation.namesMin')),
      username: z
        .string()
        .trim()
        .min(3, t('validation.usernameMin'))
        .max(30, t('validation.usernameMax'))
        .regex(/^[a-zA-Z0-9_.-]+$/, t('validation.usernamePattern')),
      email: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
          message: t('validation.emailInvalid')
        }),
      roleId: z.string().min(1, t('validation.required')),
      isActive: z.boolean()
    })

    return base.extend({
      password:
        isEdit
          ? z
              .string()
              .optional()
              .refine((value) => !value || value.length >= 6, {
                message: t('validation.passwordMin')
              })
          : z.string().min(6, t('validation.passwordMin')).max(72, t('validation.passwordMax'))
    })
  }, [t, isEdit])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      roleId: '',
      password: '',
      isActive: true
    }
  })

  // reset the form whenever the target user changes
  useEffect(() => {
    if (!open) return
    reset({
      fullName: user?.fullName ?? '',
      username: user?.username ?? '',
      email: user?.email ?? '',
      roleId: user?.roleId ?? '',
      password: '',
      isActive: user?.isActive ?? true
    })
  }, [open, user, reset])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.users.create({
        fullName: values.fullName,
        username: values.username,
        email: values.email || null,
        roleId: values.roleId,
        password: values.password,
        isActive: values.isActive
      })
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.users.update(user!.id, {
        fullName: values.fullName,
        username: values.username,
        email: values.email || null,
        roleId: values.roleId,
        password: values.password || undefined,
        isActive: values.isActive
      })
  })

  const onSubmit = handleSubmit(async (values) => {
    // username / email uniqueness can only be verified by the main process
    const taken = await api.users.checkUnique({
      username: values.username,
      email: values.email || undefined,
      excludeId: user?.id ?? null
    })
    if (taken.username) {
      setError('username', { message: t('validation.usernameTaken') })
      return
    }
    if (values.email && taken.email) {
      setError('email', { message: t('validation.emailTaken') })
      return
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
        toast.success(t('toasts.userUpdated'))
      } else {
        await createMutation.mutateAsync(values)
        toast.success(t('toasts.userCreated'))
      }
      onSaved()
    } catch (error) {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const roleOptions = roles.map((role) => ({
    value: role.id,
    label: `${language === 'ar' ? role.nameAr : role.nameEn} · ${role.key}`
  }))

  const busy = isSubmitting || createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('users.editTitle') : t('users.createTitle')}
      description={isEdit ? t('users.edit') : t('users.subtitle')}
      size="md"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </SoftButton>
          <SoftButton
            variant="primary"
            loading={busy}
            icon={<User className="size-4" />}
            onClick={() => void onSubmit()}
          >
            {t('common.save')}
          </SoftButton>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2" noValidate>
        <Input
          containerClassName="sm:col-span-2"
          label={t('users.fullName')}
          icon={<User className="size-4" />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label={t('users.username')}
          icon={<span className="text-ink-low">@</span>}
          error={errors.username?.message}
          autoComplete="off"
          {...register('username')}
        />
        <Input
          label={t('users.email')}
          type="email"
          icon={<Mail className="size-4" />}
          error={errors.email?.message}
          placeholder="name@example.com"
          autoComplete="off"
          {...register('email')}
        />
        <Select
          containerClassName="sm:col-span-2"
          label={t('users.role')}
          placeholder={t('users.selectRole')}
          options={roleOptions}
          error={errors.roleId?.message}
          {...register('roleId')}
        />
        <Input
          containerClassName="sm:col-span-2"
          label={isEdit ? t('profile.changePassword') : t('login.passwordLabel')}
          type="password"
          hint={isEdit ? t('users.passwordHint') : undefined}
          error={errors.password?.message}
          autoComplete="new-password"
          {...register('password')}
        />
        <div className="sm:col-span-2">
          <div className="flex cursor-pointer items-center justify-between gap-3 rounded-full bg-surface-soft px-5 py-3 shadow-[var(--shadow-inset)]">
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-ink-high">{t('users.status')}</span>
              <span className="text-[11px] text-ink-low">
                {t('users.active')} / {t('users.inactive')}
              </span>
            </span>
            <Toggle
              checked={watch('isActive')}
              onChange={(value) => setValue('isActive', value)}
              label={t('users.status')}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
