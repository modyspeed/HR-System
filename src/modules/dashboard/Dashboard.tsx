import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  ShieldCheck,
  Slash,
  UserPlus,
  Users as UsersIcon
} from 'lucide-react'
import { api } from '@/lib/ipc'
import { formatDateTime } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useAnyPermission } from '@/hooks/usePermission'
import { GlassCard } from '@/components/ui/GlassCard'
import { SoftButton } from '@/components/ui/SoftButton'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/layout/PageHeader'

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const canSeeUsers = useAnyPermission(['users.view'])
  const canSeeRoles = useAnyPermission(['roles.view'])
  const canCreateUsers = useAnyPermission(['users.create'])

  const users = useQuery({
    queryKey: ['users', 'list', {}],
    queryFn: () => api.users.list({}),
    enabled: canSeeUsers
  })
  const roles = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => api.roles.list(),
    enabled: canSeeRoles
  })

  const userList = users.data ?? []
  const roleList = roles.data ?? []
  const activeCount = userList.filter((user) => user.isActive).length
  const disabledCount = userList.length - activeCount
  const language = i18n.language

  const stats = [
    { label: t('dashboard.statTotalUsers'), value: userList.length, icon: UsersIcon, tone: 'gold' },
    { label: t('dashboard.statActiveUsers'), value: activeCount, icon: CheckCircle2, tone: 'teal' },
    { label: t('dashboard.statDisabledUsers'), value: disabledCount, icon: Slash, tone: 'rose' },
    { label: t('dashboard.statRoles'), value: roleList.length, icon: ShieldCheck, tone: 'violet' }
  ] as const

  const recent = [...userList]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <div>
      <PageHeader title={t('dashboard.title')} accent="Dashboard" subtitle={t('dashboard.subtitle')} />

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.label} variants={staggerItem} transition={springSoft()}>
              <GlassCard tilt className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-ink-low">{stat.label}</p>
                    {users.isLoading || roles.isLoading ? (
                      <Skeleton className="mt-2.5 h-8 w-14" />
                    ) : (
                      <p className="mt-1 text-3xl font-bold tabular-nums text-ink-high">
                        {stat.value}
                      </p>
                    )}
                  </div>
                  <div
                    className={cnTone(stat.tone)}
                  >
                    <Icon className="size-5" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </motion.div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* recent users */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="lg:col-span-3"
        >
          <GlassCard className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.recentUsers')}</h2>
              {canSeeUsers && (
                <Link
                  to="/users"
                  className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-400"
                >
                  {t('dashboard.viewAll')}
                </Link>
              )}
            </div>
            <div className="divider" />
            {canSeeUsers ? (
              recent.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-ink-low">
                  {t('dashboard.noUsersYet')}
                </p>
              ) : (
                <div className="divide-y divide-surface-base">
                  {recent.map((user, index) => (
                    <motion.div
                      key={user.id}
                      variants={staggerItem}
                      transition={springSoft(index)}
                      className="flex items-center gap-3.5 px-6 py-3.5"
                    >
                      <Avatar fullName={user.fullName} id={user.id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-high">
                          {user.fullName}
                        </p>
                        <p className="truncate text-[11px] text-ink-low">@{user.username}</p>
                      </div>
                      <div className="hidden sm:block">
                        <Badge tone={user.isActive ? 'teal' : 'rose'} dot>
                          {user.isActive ? t('users.activeBadge') : t('users.inactiveBadge')}
                        </Badge>
                      </div>
                      <span className="hidden whitespace-nowrap text-[11px] text-ink-low md:block">
                        {formatDateTime(user.lastLoginAt, language)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              <p className="px-6 py-10 text-center text-sm text-ink-low">{t('noAccess.body')}</p>
            )}
          </GlassCard>
        </motion.div>

        {/* role distribution */}
        <motion.div variants={staggerItem} transition={springSoft()} className="lg:col-span-2">
          <GlassCard className="p-6">
            <h2 className="mb-5 text-sm font-semibold text-ink-high">
              {t('dashboard.roleDistribution')}
            </h2>
            {canSeeRoles && roleList.length > 0 ? (
              <div className="space-y-4">
                {roleList.map((role) => {
                  const count = role._count?.users ?? 0
                  const max = Math.max(1, ...roleList.map((r) => r._count?.users ?? 0))
                  const pct = Math.max(6, Math.round((count / max) * 100))
                  return (
                    <div key={role.id}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-ink-med">
                          {language === 'ar' ? role.nameAr : role.nameEn}
                        </span>
                        <span className="tabular-nums text-ink-low">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-strong">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
                          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-300"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-ink-low">{t('roles.noRoles')}</p>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* quick actions */}
      {canCreateUsers && (
        <motion.div variants={staggerItem} transition={springSoft()} className="mt-5">
          <GlassCard className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-high">
                {t('dashboard.quickActions')}
              </h2>
              <p className="mt-1 text-xs text-ink-low">{t('dashboard.welcomeBody')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/users?new=1">
                <SoftButton variant="primary" icon={<UserPlus className="size-4" />}>
                  {t('dashboard.newUser')}
                </SoftButton>
              </Link>
              <Link to="/roles">
                <SoftButton variant="ghost" icon={<ShieldCheck className="size-4" />}>
                  {t('dashboard.managePermissions')}
                </SoftButton>
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}

function springSoft(delay = 0) {
  return { type: 'spring' as const, stiffness: 220, damping: 24, delay }
}

const TONES = {
  gold: 'border-accent-500/25 bg-accent-500/10 text-accent-300',
  teal: 'border-teal-400/25 bg-teal-400/10 text-teal-400',
  violet: 'border-violet-400/25 bg-violet-400/10 text-violet-400',
  rose: 'border-rose-400/25 bg-rose-400/10 text-rose-400'
}

function cnTone(tone: keyof typeof TONES) {
  return `grid size-11 shrink-0 place-items-center rounded-full border ${TONES[tone]}`
}
