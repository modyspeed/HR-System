import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowRight, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { ALL_PERMISSION_KEYS } from '@/lib/permissions'
import { staggerContainer, staggerItem, spring } from '@/lib/motion'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { SoftButton } from '@/components/ui/SoftButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RowActions } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'

export function RolesList() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const language = i18n.language
  const [toDelete, setToDelete] = useState<string | null>(null)

  const rolesQuery = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => api.roles.list()
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.roles.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.roleDeleted'))
      setToDelete(null)
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const roles = rolesQuery.data ?? []
  const target = roles.find((role) => role.id === toDelete) ?? null

  return (
    <div>
      <PageHeader
        title={t('roles.title')}
        accent="Roles & Permissions"
        subtitle={t('roles.subtitle')}
        actions={
          <SoftButton
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => navigate('/roles/new')}
          >
            {t('roles.new')}
          </SoftButton>
        }
      />

      {rolesQuery.isLoading ? (
        <GlassCard withLightBar={false} className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="shimmer-surface h-20 rounded-xl" />
          ))}
        </GlassCard>
      ) : roles.length === 0 ? (
        <GlassCard withLightBar={false}>
          <EmptyState
            icon={<ShieldCheck className="size-7" />}
            title={t('roles.noRoles')}
            action={
              <SoftButton
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => navigate('/roles/new')}
              >
                {t('roles.new')}
              </SoftButton>
            }
          />
        </GlassCard>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {roles.map((role) => {
            const granted =
              role.key === 'super_admin' ? ALL_PERMISSION_KEYS.length : role.permissions.length
            return (
              <motion.div key={role.id} variants={staggerItem} transition={spring}>
                <GlassCard tilt className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-11 place-items-center rounded-full border border-accent-500/25 bg-accent-500/10 text-accent-300">
                        <ShieldCheck className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-ink-high">
                          {language === 'ar' ? role.nameAr : role.nameEn}
                        </h3>
                        <p className="font-mono text-[11px] text-ink-low">{role.key}</p>
                      </div>
                    </div>
                    <RowActions
                      actions={[
                        {
                          key: 'edit',
                          label: t('common.edit'),
                          icon: <Pencil className="size-3.5" />,
                          onClick: () => navigate(`/roles/${role.id}`)
                        },
                        {
                          key: 'delete',
                          label: t('common.delete'),
                          icon: <Trash2 className="size-3.5" />,
                          danger: true,
                          disabled: role.isSystem || (role._count?.users ?? 0) > 0,
                          onClick: () => setToDelete(role.id)
                        }
                      ]}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {role.isSystem && <Badge tone="violet">{t('roles.systemRole')}</Badge>}
                    <Badge tone="neutral">
                      {role._count?.users ?? 0} {t('roles.usersCount')}
                    </Badge>
                    <Badge tone="gold">
                      {granted} {t('roles.permissions')}
                    </Badge>
                  </div>

                  {role.key === 'super_admin' ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-accent-300/80">
                      {t('roles.superAdminNote')}
                    </p>
                  ) : role.isSystem ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-ink-low">
                      {t('roles.systemRoleHint')}
                    </p>
                  ) : null}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate(`/roles/${role.id}`)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-low transition-colors hover:text-accent-300"
                    >
                      {t('roles.permissionMatrix')}
                      <ArrowRight className="size-3.5 rtl:rotate-180" />
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('roles.confirmDeleteTitle')}
        body={
          target
            ? t('roles.confirmDeleteBody', {
                name: language === 'ar' ? target.nameAr : target.nameEn
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
