import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Check, Database, Languages, Moon, Palette, Sun } from 'lucide-react'
import { api } from '@/lib/ipc'
import { fadeUp, spring } from '@/lib/motion'
import { useUiStore } from '@/store/uiStore'
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type Language } from '@/i18n'
import type { Theme } from '@shared/types'
import { GlassCard } from '@/components/ui/GlassCard'
import { SoftButton } from '@/components/ui/SoftButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'

export function Settings() {
  const { t } = useTranslation()
  const language = useUiStore((state) => state.language)
  const setLanguage = useUiStore((state) => state.setLanguage)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)

  const versions = useQuery({
    queryKey: ['system', 'versions'],
    queryFn: () => api.system.versions()
  })

  return (
    <div>
      <PageHeader title={t('settings.title')} accent="Settings" subtitle={t('settings.subtitle')} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* appearance */}
        <motion.div variants={fadeUp} initial="initial" animate="animate" transition={spring}>
          <GlassCard className="p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full border border-accent-500/25 bg-accent-500/10 text-accent-300">
                <Palette className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-high">{t('settings.themeSection')}</h2>
                <p className="text-[11px] text-ink-low">{t('settings.themeHint')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as Theme[]).map((value) => {
                const active = theme === value
                const isDark = value === 'dark'
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      void setTheme(value).then(() => toast.success(t('toasts.themeChanged')))
                    }}
                    className={`focus-ring relative flex flex-col items-start gap-2.5 overflow-hidden rounded-3xl border p-4 text-start transition-all ${
                      active
                        ? 'border-accent-400/60 bg-accent-500/[0.09]'
                        : 'border-line bg-surface-soft hover:border-line-strong'
                    }`}
                  >
                    {/* mini theme preview */}
                    <span
                      className="relative h-12 w-full overflow-hidden rounded-lg border border-line"
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, #151519, #0A0A0C)'
                          : 'linear-gradient(135deg, #F5EDE2, #E2D5C2)'
                      }}
                    >
                      <span
                        className="absolute bottom-1.5 h-2.5 w-2.5 rounded-full"
                        style={{
                          left: isDark ? 'auto' : '8px',
                          right: isDark ? '8px' : 'auto',
                          background: isDark ? '#E9C898' : '#A26A32',
                        }}
                      />
                      <span
                        className="absolute top-1.5 h-1.5 w-12 rounded-full"
                        style={{
                          left: isDark ? '8px' : 'auto',
                          right: isDark ? 'auto' : '8px',
                          background: isDark ? 'rgba(255,255,255,.28)' : 'rgba(74,52,32,.3)',
                        }}
                      />
                    </span>
                    <span className="flex items-center gap-2 text-sm font-bold text-ink-high">
                      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
                      {t(`settings.theme${value === 'dark' ? 'Dark' : 'Light'}`)}
                    </span>
                    {active && (
                      <span className="absolute end-3 top-3 grid size-5 place-items-center rounded-full bg-gradient-to-b from-accent-300 to-accent-500">
                        <Check className="size-3 text-accent-ink" strokeWidth={3.5} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </GlassCard>
        </motion.div>

        {/* language */}
        <motion.div variants={fadeUp} initial="initial" animate="animate" transition={spring}>
          <GlassCard className="p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full border border-accent-500/25 bg-accent-500/10 text-accent-300">
                <Languages className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-high">{t('settings.languageSection')}</h2>
                <p className="text-[11px] text-ink-low">{t('settings.languageHint')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((value) => {
                const active = language === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      void setLanguage(value as Language).then(() =>
                        toast.success(t('toasts.languageChanged'))
                      )
                    }}
                    className={`focus-ring relative flex flex-col items-start gap-1 overflow-hidden rounded-3xl border p-4 text-start transition-all ${
                      active
                        ? 'border-accent-400/60 bg-accent-500/[0.09]'
                        : 'border-line bg-surface-soft hover:border-line-strong'
                    }`}
                  >
                    {active && (
                      <span className="absolute end-3 top-3 grid size-5 place-items-center rounded-full bg-gradient-to-b from-accent-300 to-accent-500">
                        <Check className="size-3 text-accent-ink" strokeWidth={3.5} />
                      </span>
                    )}
                    <span className="text-base font-bold text-ink-high">
                      {LANGUAGE_LABELS[value]}
                    </span>
                    <span className="text-[11px] text-ink-low">
                      {value === 'ar' ? 'RTL · العربية' : 'LTR · English'}
                    </span>
                  </button>
                )
              })}
            </div>
          </GlassCard>
        </motion.div>

        {/* data */}
        <motion.div variants={fadeUp} initial="initial" animate="animate" transition={spring}>
          <GlassCard withLightBar={false} className="p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full border border-teal-400/25 bg-teal-400/10 text-teal-400">
                <Database className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-high">{t('settings.dataSection')}</h2>
                <p className="text-[11px] text-ink-low">{t('settings.revealDatabaseHint')}</p>
              </div>
            </div>

            <SoftButton
              variant="ghost"
              icon={<Database className="size-4" />}
              onClick={() => void api.system.revealDatabase()}
            >
              {t('settings.revealDatabase')}
            </SoftButton>
          </GlassCard>
        </motion.div>

        {/* about */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={spring}
          className="xl:col-span-2"
        >
          <GlassCard withLightBar={false} className="p-7">
            <h2 className="mb-5 text-sm font-bold text-ink-high">{t('settings.aboutSection')}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(versions.data
                ? [
                    { label: t('settings.version'), value: versions.data.app },
                    { label: t('settings.electronVersion'), value: versions.data.electron },
                    { label: t('settings.nodeVersion'), value: versions.data.node },
                    { label: t('settings.chromeVersion'), value: versions.data.chrome }
                  ]
                : []
              ).map((row) => (
                <div
                  key={row.label}
                  className="rounded-3xl border border-line bg-surface-soft p-4"
                >
                  <p className="text-[10px] uppercase tracking-wider text-ink-low">{row.label}</p>
                  <p className="mt-1.5 truncate font-mono text-sm text-ink-high">{row.value}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}
