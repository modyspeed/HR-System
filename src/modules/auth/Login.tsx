import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { animate, motion } from 'framer-motion'
import { KeyRound, Languages, Lock, ShieldCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { resolveApiError } from '@/lib/errors'
import { fadeUp, spring } from '@/lib/motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { SoftButton } from '@/components/ui/SoftButton'

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const status = useAuthStore((state) => state.status)
  const language = useUiStore((state) => state.language)
  const setLanguage = useUiStore((state) => state.setLanguage)

  const schema = useMemo(
    () =>
      z.object({
        username: z.string().min(1, t('validation.required')),
        password: z.string().min(1, t('validation.required'))
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ username: string; password: string }>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' }
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.username, values.password)
      toast.success(t('toasts.loginSuccess'))
      navigate('/', { replace: true })
    } catch (error) {
      // shake the panel to signal the rejected credentials
      void animate('.login-panel', { x: [0, -9, 9, -6, 6, 0] }, { duration: 0.42, ease: 'easeInOut' })
      toast.error(t('login.errorInvalid'), { description: resolveApiError(error) })
    }
  })

  if (user) return <Navigate to="/" replace />

  return (
    <div className="relative grid h-screen w-screen place-items-center p-6">
      <button
        type="button"
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className="focus-ring absolute top-6 flex h-12 items-center gap-2 rounded-full bg-surface-strong px-5 text-sm font-semibold text-ink-med shadow-[var(--shadow-raised),var(--shadow-rim)] transition-colors hover:text-ink-high"
        style={language === 'ar' ? { left: 24 } : { right: 24 }}
      >
        <Languages className="size-4" />
        <span className="font-medium">{language === 'ar' ? 'English' : 'العربية'}</span>
      </button>

      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={spring}
        className="login-panel w-full max-w-[440px]"
      >
        <GlassCard className="px-8 pb-8 pt-9" withLightBar tilt>
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-5 grid size-16 place-items-center rounded-full bg-gradient-to-b from-accent-300 to-accent-500 shadow-[var(--shadow-cta),var(--shadow-rim)]">
              <span className="font-serif text-2xl font-bold text-accent-ink">HR</span>
            </div>
            <h1 className="text-[22px] font-bold leading-tight text-ink-high">{t('login.title')}</h1>
            <p className="mt-2 text-sm text-ink-med">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              label={t('login.usernameLabel')}
              placeholder={t('login.usernamePlaceholder')}
              icon={<User className="size-4" />}
              error={errors.username ? t('validation.required') : undefined}
              autoComplete="username"
              autoFocus
              {...register('username')}
            />
            <Input
              label={t('login.passwordLabel')}
              placeholder={t('login.passwordPlaceholder')}
              type="password"
              icon={<Lock className="size-4" />}
              error={errors.password ? t('validation.required') : undefined}
              autoComplete="current-password"
              {...register('password')}
            />

            <SoftButton
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={isSubmitting || status === 'loading'}
              icon={<KeyRound className="size-4" />}
            >
              {isSubmitting ? t('login.signingIn') : t('login.submit')}
            </SoftButton>
          </form>

          <div className="mt-6 rounded-3xl border border-accent-500/20 bg-accent-500/[0.06] p-4">
            <div className="flex items-center gap-2 text-accent-300">
              <ShieldCheck className="size-4" />
              <p className="text-xs font-semibold">{t('login.hintTitle')}</p>
            </div>
            <p className="mt-1.5 text-center font-mono text-xs text-ink-med" dir="ltr">
              {t('login.hintBody')}
            </p>
          </div>

          <p className="mt-5 text-center text-[11px] text-ink-low">{t('login.secureNote')}</p>
        </GlassCard>
      </motion.div>
    </div>
  )
}
