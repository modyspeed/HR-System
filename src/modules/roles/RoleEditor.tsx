import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { MODULE_PERMISSIONS, PERMISSION_MODULES } from '@shared/permissions'
import { fadeUp, spring, staggerContainer, staggerItem } from '@/lib/motion'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { SoftButton } from '@/components/ui/SoftButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

function actionOf(permissionKey: string): string {
  return permissionKey.split('.')[1]
}

const TOTAL_PERMISSIONS = Object.values(MODULE_PERMISSIONS).flat().length

export function RoleEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'

  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [key, setKey] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const roleQuery = useQuery({
    queryKey: ['roles', 'get', id],
    queryFn: () => api.roles.getById(id as string),
    enabled: !isNew
  })

  const role = roleQuery.data ?? null

  useEffect(() => {
    if (role) {
      setNameAr(role.nameAr)
      setNameEn(role.nameEn)
      setKey(role.key)
      setPermissions(role.permissions)
    }
  }, [role])

  const createMutation = useMutation({
    mutationFn: () => api.roles.create({ key, nameAr, nameEn, permissions }),
    onSuccess: () => {
      toast.success(t('toasts.roleCreated'))
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      navigate('/roles', { replace: true })
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const updateMutation = useMutation({
    mutationFn: () => api.roles.update(id as string, { key, nameAr, nameEn, permissions }),
    onSuccess: () => {
      toast.success(t('toasts.roleUpdated'))
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      navigate('/roles', { replace: true })
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const busy = createMutation.isPending || updateMutation.isPending
  const isSystem = role?.isSystem ?? false

  const toggle = (permissionKey: string, value: boolean) => {
    setPermissions((current) =>
      value
        ? Array.from(new Set([...current, permissionKey]))
        : current.filter((item) => item !== permissionKey)
    )
  }

  const toggleModule = (module: (typeof PERMISSION_MODULES)[number], value: boolean) => {
    setPermissions((current) => {
      const moduleKeys: readonly string[] = MODULE_PERMISSIONS[module]
      const rest = current.filter((item) => !moduleKeys.includes(item))
      return value ? [...rest, ...moduleKeys] : rest
    })
  }

  const moduleState = useMemo(() => {
    const map: Record<string, { all: boolean; some: boolean }> = {}
    for (const module of PERMISSION_MODULES) {
      const keys = MODULE_PERMISSIONS[module]
      const granted = keys.filter((item) => permissions.includes(item)).length
      map[module] = { all: granted === keys.length, some: granted > 0 && granted < keys.length }
    }
    return map
  }, [permissions])

  const onSubmit = () => {
    const next: Record<string, string> = {}
    if (!nameAr.trim()) next.nameAr = t('validation.required')
    if (!nameEn.trim()) next.nameEn = t('validation.required')
    if (!key.trim()) next.key = t('validation.keyRequired')
    else if (!/^[A-Z][A-Z0-9_]*$/.test(key.trim())) next.key = t('validation.keyPattern')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    if (isNew) createMutation.mutate()
    else updateMutation.mutate()
  }

  if (roleQuery.isLoading) {
    return (
      <div>
        <PageHeader title={t('roles.editTitle')} subtitle={t('roles.permissionMatrix')} />
        <GlassCard withLightBar={false} className="space-y-4 p-6">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-64 w-full" />
        </GlassCard>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={isNew ? t('roles.createTitle') : t('roles.editTitle')}
        accent="Permission Matrix"
        subtitle={t('roles.permissionMatrix')}
        actions={
          <button
            type="button"
            onClick={() => navigate('/roles')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-med transition-colors hover:text-ink-high"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t('common.back')}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* identity */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={spring}
          className="xl:col-span-2"
        >
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full border border-accent-500/25 bg-accent-500/10 text-accent-300">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-high">{t('roles.title')}</h2>
                <p className="text-[11px] text-ink-low">
                  {permissions.length} {t('roles.permissions')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label={t('roles.nameAr')}
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
                error={errors.nameAr}
                dir="rtl"
                disabled={isSystem}
              />
              <Input
                label={t('roles.nameEn')}
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
                error={errors.nameEn}
                dir="ltr"
                disabled={isSystem}
              />
              <Input
                label={t('roles.key')}
                value={key}
                onChange={(event) => setKey(event.target.value.toUpperCase())}
                error={errors.key}
                hint={isSystem ? t('roles.systemRoleHint') : t('roles.keyHint')}
                disabled={isSystem}
                className="font-mono"
              />

              {role && (
                <div className="flex flex-wrap gap-2">
                  {role.isSystem && <Badge tone="violet">{t('roles.systemRole')}</Badge>}
                  <Badge tone="neutral">
                    {role._count?.users ?? 0} {t('roles.usersCount')}
                  </Badge>
                </div>
              )}

              {isSystem && role?.key === 'super_admin' && (
                <p className="rounded-xl border border-accent-500/20 bg-accent-500/[0.06] p-3 text-[11px] leading-relaxed text-accent-300/80">
                  {t('roles.superAdminNote')}
                </p>
              )}

              <SoftButton
                variant="primary"
                block
                loading={busy}
                icon={<Save className="size-4" />}
                onClick={onSubmit}
                className="mt-2"
              >
                {t('common.save')}
              </SoftButton>
            </div>
          </GlassCard>
        </motion.div>

        {/* permission matrix */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="xl:col-span-3"
        >
          <GlassCard withLightBar={false} className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5">
              <h2 className="text-base font-bold text-ink-high">{t('roles.permissionMatrix')}</h2>
              <Badge tone="gold">
                {permissions.length} / {TOTAL_PERMISSIONS}
              </Badge>
            </div>
            <div className="divider" />
            <div className="px-6 py-2">
              {PERMISSION_MODULES.map((module) => {
                const keys = MODULE_PERMISSIONS[module]
                const state = moduleState[module]
                return (
                  <motion.div key={module} variants={staggerItem} transition={spring} className="py-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleModule(module, !state.all)}
                          className={cn(
                            'grid size-6 place-items-center rounded-full border transition-all',
                            state.all
                              ? 'border-accent-400 bg-gradient-to-b from-accent-300 to-accent-500'
                              : state.some
                                ? 'border-accent-500/50 bg-accent-500/15'
                                : 'border-line-strong bg-surface-soft'
                          )}
                        >
                          {state.all && (
                            <Check className="size-3.5 text-accent-ink" strokeWidth={3.5} />
                          )}
                          {state.some && !state.all && (
                            <span className="size-1.5 rounded-full bg-accent-300" />
                          )}
                        </button>
                        <span className="text-sm font-semibold text-ink-high">
                          {t(`permissions.modules.${module}`)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleModule(module, !state.all)}
                        className="text-[11px] font-medium text-ink-low transition-colors hover:text-accent-300"
                      >
                        {state.all ? t('roles.clearAll') : t('roles.selectAll')}
                      </button>
                    </div>
                    <div
                      className="grid items-center gap-x-3 gap-y-2 ps-9"
                      style={{ gridTemplateColumns: `repeat(${Math.min(keys.length, 3)}, minmax(0, 1fr))` }}
                    >
                      {keys.map((permissionKey) => (
                        <div
                          key={permissionKey}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-surface-soft px-3.5 py-2"
                        >
                          <span className="text-xs text-ink-med">
                            {t(`permissions.actions.${actionOf(permissionKey)}`)}
                          </span>
                          <Toggle
                            checked={permissions.includes(permissionKey)}
                            onChange={(value) => toggle(permissionKey, value)}
                            label={t(`permissions.actions.${actionOf(permissionKey)}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>
            <div className="border-t border-line p-5">
              <SoftButton
                variant="primary"
                loading={busy}
                icon={<Save className="size-4" />}
                onClick={onSubmit}
                className="ms-auto"
              >
                {t('common.save')}
              </SoftButton>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}
