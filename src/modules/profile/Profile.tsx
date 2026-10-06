import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Calendar, KeyRound, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { formatDateTime } from '@/lib/utils'
import { fadeUp, spring } from '@/lib/motion'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { SoftButton } from '@/components/ui/SoftButton'
import { PageHeader } from '@/components/layout/PageHeader'

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function Profile() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const language = i18n.language

  const schema = useMemo(
    () =>
      z.object({
        currentPassword: z.string().min(1, t('validation.required')),
        newPassword: z
          .string()
          .min(6, t('validation.passwordMin'))
          .max(72, t('validation.passwordMax')),
        confirmPassword: z.string().min(1, t('validation.required'))
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  })

  if (!user) return null

  const onSubmit = handleSubmit(async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      setError('confirmPassword', { message: t('validation.passwordsMismatch') })
      return
    }
    try {
      await api.users.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      })
      toast.success(t('profile.passwordChanged'))
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const info = [
    { icon: <User className="size-4" />, label: t('users.username'), value: `@${user.username}` },
    { icon: <Mail className="size-4" />, label: t('users.email'), value: user.email ?? '—' },
    {
      icon: <ShieldCheck className="size-4" />,
      label: t('profile.role'),
      value: language === 'ar' ? user.roleNameAr : user.roleNameEn
    },
    {
      icon: <Calendar className="size-4" />,
      label: t('profile.lastLogin'),
      value: formatDateTime(user.lastLoginAt, language)
    }
  ]

  return (
    <div>
      <PageHeader title={t('profile.title')} accent="My Profile" subtitle={t('profile.subtitle')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* account summary */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={spring}
          className="lg:col-span-2"
        >
          <GlassCard tilt className="p-7">
            <div className="flex flex-col items-center text-center">
              <Avatar fullName={user.fullName} id={user.id} size="lg" />
              <h2 className="mt-4 text-lg font-bold text-ink-high">{user.fullName}</h2>
              <p className="mt-0.5 text-xs text-ink-low">@{user.username}</p>
              <div className="mt-3">
                <Badge tone="gold" dot>
                  {language === 'ar' ? user.roleNameAr : user.roleNameEn}
                </Badge>
              </div>
            </div>

            <div className="divider my-6" />

            <div className="space-y-4">
              {info.map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-soft text-ink-low">
                    {row.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-low">{row.label}</p>
                    <p className="truncate text-sm text-ink-high">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* change password */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={spring}
          className="lg:col-span-3"
        >
          <GlassCard withLightBar={false} className="p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full border border-violet-400/25 bg-violet-400/10 text-violet-400">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-high">{t('profile.changePassword')}</h2>
                <p className="text-[11px] text-ink-low">{t('profile.securitySection')}</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Input
                label={t('profile.currentPassword')}
                type="password"
                placeholder={t('profile.currentPasswordPlaceholder')}
                icon={<Lock className="size-4" />}
                error={errors.currentPassword?.message}
                autoComplete="current-password"
                {...register('currentPassword')}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={t('profile.newPassword')}
                  type="password"
                  placeholder={t('profile.newPasswordPlaceholder')}
                  icon={<Lock className="size-4" />}
                  error={errors.newPassword?.message}
                  autoComplete="new-password"
                  {...register('newPassword')}
                />
                <Input
                  label={t('profile.confirmPassword')}
                  type="password"
                  placeholder={t('profile.confirmPasswordPlaceholder')}
                  icon={<Lock className="size-4" />}
                  error={errors.confirmPassword?.message}
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
              </div>

              <div className="pt-2">
                <SoftButton
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  icon={<KeyRound className="size-4" />}
                >
                  {t('common.save')}
                </SoftButton>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}
