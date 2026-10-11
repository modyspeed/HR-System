import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Archive,
  Check,
  Database,
  FolderOpen,
  HardDriveUpload,
  Languages,
  Loader2,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Trash2
} from 'lucide-react'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { formatDate, formatFileSize } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { fadeUp, spring } from '@/lib/motion'
import { useUiStore } from '@/store/uiStore'
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type Language } from '@/i18n'
import type { Theme } from '@shared/types'
import { GlassCard } from '@/components/ui/GlassCard'
import { SoftButton } from '@/components/ui/SoftButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'

export function Settings() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const queryClient = useQueryClient()
  const canEdit = usePermission('settings.edit')

  const uiLanguage = useUiStore((state) => state.language)
  const setLanguage = useUiStore((state) => state.setLanguage)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)

  const versions = useQuery({
    queryKey: ['system', 'versions'],
    queryFn: () => api.system.versions()
  })

  // ---------------- النسخ الاحتياطي ----------------
  const backupsQuery = useQuery({
    queryKey: ['backups', 'list'],
    queryFn: () => api.backups.list()
  })
  const backups = backupsQuery.data ?? []
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const invalidateBackups = () => void queryClient.invalidateQueries({ queryKey: ['backups'] })

  const createMutation = useMutation({
    mutationFn: () => api.backups.create(),
    onSuccess: (info) => {
      toast.success(t('toasts.backupCreated'), { description: info.fileName })
      invalidateBackups()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const restoreMutation = useMutation({
    mutationFn: (fileName: string) => api.backups.restore(fileName),
    onSuccess: ({ preRestore }) => {
      toast.success(t('toasts.backupRestored'), {
        description: preRestore ? t('toasts.backupPreRestore') : undefined
      })
      setConfirmRestore(null)
      window.setTimeout(() => window.location.reload(), 1600)
    },
    onError: (error) => {
      setConfirmRestore(null)
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const removeMutation = useMutation({
    mutationFn: (fileName: string) => api.backups.remove(fileName),
    onSuccess: () => {
      toast.success(t('toasts.backupDeleted'))
      setConfirmDelete(null)
      invalidateBackups()
    },
    onError: (error) => {
      setConfirmDelete(null)
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
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
                          background: isDark ? '#E9C898' : '#A26A32'
                        }}
                      />
                      <span
                        className="absolute top-1.5 h-1.5 w-12 rounded-full"
                        style={{
                          left: isDark ? '8px' : 'auto',
                          right: isDark ? 'auto' : '8px',
                          background: isDark ? 'rgba(255,255,255,.28)' : 'rgba(74,52,32,.3)'
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
                const active = uiLanguage === value
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

        {/* النسخ الاحتياطي */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={spring}
          className="xl:col-span-2"
        >
          <GlassCard withLightBar={false} className="p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full border border-teal-400/25 bg-teal-400/10 text-teal-400">
                <Archive className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-high">{t('settings.backupSection')}</h2>
                <p className="text-[11px] text-ink-low">{t('settings.backupHint')}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <SoftButton
                  variant="primary"
                  icon={<HardDriveUpload className="size-4" />}
                  loading={createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {t('settings.backupCreate')}
                </SoftButton>
              )}
              <SoftButton
                variant="ghost"
                icon={<FolderOpen className="size-4" />}
                onClick={() => void api.backups.revealDir()}
              >
                {t('settings.backupOpenFolder')}
              </SoftButton>
              <SoftButton
                variant="ghost"
                icon={<Database className="size-4" />}
                onClick={() => void api.system.revealDatabase()}
              >
                {t('settings.revealDatabase')}
              </SoftButton>
            </div>

            <div className="mt-5 scroll-area max-h-[42vh] overflow-auto rounded-2xl border border-line">
              {backupsQuery.isLoading ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-accent-300" />
                </div>
              ) : backups.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-ink-low">
                  {t('settings.backupEmpty')}
                </p>
              ) : (
                <ul className="divide-y divide-surface-base">
                  {backups.map((backup) => (
                    <li key={backup.fileName} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Archive className="size-4 shrink-0 text-teal-400" />
                      <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-xs text-ink-high">
                        {backup.fileName}
                      </span>
                      <span className="text-[11px] tabular-nums text-ink-low">
                        {formatFileSize(backup.size)}
                      </span>
                      <span className="text-[11px] tabular-nums text-ink-low">
                        {formatDate(backup.createdAt, language)}
                      </span>
                      {canEdit && (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            title={t('settings.backupRestore')}
                            onClick={() => setConfirmRestore(backup.fileName)}
                            className="focus-ring grid size-8 place-items-center rounded-lg text-teal-400 transition-colors hover:bg-surface-strong"
                          >
                            <RotateCcw className="size-4" />
                          </button>
                          <button
                            type="button"
                            title={t('common.delete')}
                            onClick={() => setConfirmDelete(backup.fileName)}
                            className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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

      <ConfirmDialog
        open={confirmRestore !== null}
        danger
        loading={restoreMutation.isPending}
        title={t('settings.backupRestoreTitle')}
        body={t('settings.backupRestoreBody')}
        confirmLabel={t('settings.backupRestore')}
        onConfirm={() => {
          if (confirmRestore) restoreMutation.mutate(confirmRestore)
        }}
        onClose={() => setConfirmRestore(null)}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={removeMutation.isPending}
        title={t('settings.backupDeleteTitle')}
        body={confirmDelete ? t('settings.backupDeleteBody', { name: confirmDelete }) : ''}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (confirmDelete) removeMutation.mutate(confirmDelete)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}