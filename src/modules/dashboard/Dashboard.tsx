import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Contact,
  CreditCard,
  FolderOpen,
  Landmark,
  ShieldCheck,
  Shuffle,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users as UsersIcon,
  AlertCircle,
  HelpCircle
} from 'lucide-react'
import { api } from '@/lib/ipc'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem, fadeUp } from '@/lib/motion'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import { GlassCard } from '@/components/ui/GlassCard'
import { SoftButton } from '@/components/ui/SoftButton'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useTranslation } from 'react-i18next'

type Tone = 'gold' | 'teal' | 'violet' | 'rose' | 'sky'
const TONES: Record<Tone, string> = {
  gold: 'border-accent-500/25 bg-accent-500/10 text-accent-300',
  teal: 'border-teal-400/25 bg-teal-400/10 text-teal-400',
  violet: 'border-violet-400/25 bg-violet-400/10 text-violet-400',
  rose: 'border-rose-400/25 bg-rose-400/10 text-rose-400',
  sky: 'border-sky-400/25 bg-sky-400/10 text-sky-400'
}
const STATUS_COLORS: Record<string, string> = {
  active: '#2DD4BF',
  retired: '#A78BFA',
  resigned: '#FB7185',
  terminated: '#F43F5E',
  deceased: '#94A3B8',
  unpaid_leave: '#FBBF24',
  suspended: '#94A3B8'
}

function springSoft(delay = 0) {
  return { type: 'spring' as const, stiffness: 220, damping: 24, delay }
}

function cnTone(tone: Tone) {
  return `grid size-11 shrink-0 place-items-center rounded-full border ${TONES[tone]}`
}

function greetingByHour() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const location = useLocation()
  const canSeeUsers = useAnyPermission(['users.view'])
  const canCreateUsers = useAnyPermission(['users.create', 'employees.create', 'leaves.create', 'payrolls.create'])
  const canEmployees = usePermission('employees.view')
  const canDepartments = usePermission('departments.view')
  const canLeaves = usePermission('leaves.view')
  const canPayrolls = usePermission('payrolls.view')
  const canSettings = usePermission('settings.view')

  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.dashboard.summary()
  })
  const s = summary.data

  const kpis = useMemo(() => {
    const items: { label: string; value: number | null; icon: typeof Contact; tone: Tone; hint?: string; trend?: { label: string; up: boolean } }[] = []
    if (s?.employees) {
      items.push(
        { label: t('dashboard.empTotal'), value: s.employees.total, icon: UsersIcon, tone: 'gold', hint: t('dashboard.empTotalHint'), trend: { label: t('dashboard.empActive'), up: true } },
        { label: t('dashboard.empActive'), value: s.employees.active, icon: CheckCircle2, tone: 'teal' },
        { label: t('dashboard.empInactive'), value: s.employees.inactive, icon: Contact, tone: 'rose' }
      )
    }
    if (s?.departments) {
      items.push({ label: t('dashboard.departments'), value: s.departments.total, icon: Building2, tone: 'violet', hint: t('dashboard.departmentsHint', { active: s.departments.active }) })
    }
    if (s?.leaves) {
      items.push({ label: t('dashboard.leavesPending'), value: s.leaves.byStatus['pending'] ?? 0, icon: CalendarDays, tone: 'gold', hint: String(s.leaves.byStatus['approved'] ?? 0) + ' ' + t('dashboard.leavesApproved') })
    }
    if (s?.payrolls) {
      items.push({ label: t('dashboard.payrollMonths'), value: s.payrolls.months, icon: Banknote, tone: 'sky', hint: s.payrolls.entries ? `${s.payrolls.entries} ${t('dashboard.payrollEntries')}` : undefined })
    }
    if (s?.transfers) {
      items.push({ label: t('dashboard.transfers'), value: s.transfers.total, icon: Shuffle, tone: 'violet', hint: `${s.transfers.open} ${t('dashboard.transfersOpen')}` })
    }
    return items
  }, [s, t])

  const donut = useMemo(() => {
    if (!s?.employees) return null
    const entries = Object.entries(s.employees.byStatus)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
    const total = s.employees.total || 1
    let cursor = 0
    const segments = entries.map(([status, count]) => {
      const from = (cursor / total) * 360
      cursor += count
      const to = (cursor / total) * 360
      return { status, count, from, to }
    })
    const gradient = segments
      .map((seg) => `${STATUS_COLORS[seg.status] ?? '#64748B'} ${seg.from.toFixed(1)}deg ${seg.to.toFixed(1)}deg`)
      .join(', ')
    return { entries, gradient, total }
  }, [s])

  const tabs = [
    { key: 'employees', label: t('dashboard.tabEmployees'), to: '/employees', icon: UsersIcon, visible: canEmployees },
    { key: 'departments', label: t('dashboard.tabDepartments'), to: '/departments', icon: Building2, visible: canDepartments },
    { key: 'leaves', label: t('dashboard.tabLeaves'), to: '/leaves', icon: CalendarDays, visible: canLeaves },
    { key: 'payrolls', label: t('dashboard.tabPayrolls'), to: '/payrolls', icon: Banknote, visible: canPayrolls },
    { key: 'backups', label: t('dashboard.tabBackups'), to: '/settings', icon: FolderOpen, visible: canSettings }
  ]

  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.to))

  return (
    <div className="min-h-full">
      {/* Hero / Welcome section */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="mb-8">
        <PageHeader
          title={t('dashboard.title')}
          accent="Dashboard"
          subtitle={t('dashboard.subtitle')}
          actions={
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line bg-surface-base">
                <Clock className="size-4 text-ink-low" />
                <span className="text-ink-med">
                  {new Date().toLocaleDateString(language, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          }
        />
        <p className="text-sm text-ink-med">
          {t('dashboard.welcomeGreeting', { time: t(`dashboard.${greetingByHour()}`) })}{' '}
          {t('dashboard.overviewBody')}
        </p>
      </motion.div>

      {/* KPIs */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 mb-8"
      >
        {kpis.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.label} variants={staggerItem} transition={springSoft(index * 0.02)}>
              <GlassCard tilt className="p-6 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Icon className="size-16" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-low uppercase tracking-wider">{stat.label}</p>
                    {summary.isLoading ? (
                      <Skeleton className="mt-2.5 h-10 w-20" />
                    ) : (
                      <div className="mt-1 flex items-baseline gap-1">
                        <p className="text-3xl font-bold tabular-nums text-ink-high">
                          {stat.value ?? '—'}
                        </p>
                        {stat.trend && (
                          <span className={stat.trend.up ? 'text-teal-400' : 'text-rose-400'}>
                            <span className={stat.trend.up ? 'text-teal-400' : 'text-rose-400'}>{stat.trend.up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}</span>{' '}
                            {stat.trend.label}
                          </span>
                        )}
                      </div>
                    )}
                    {stat.hint && <p className="mt-1.5 truncate text-[11px] text-ink-low">{stat.hint}</p>}
                  </div>
                  <div className={cnTone(stat.tone)}>
                    <Icon className="size-5" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Main overview grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mb-8">
        {/* Employee status donut (left) */}
        <motion.div variants={staggerItem} transition={springSoft(0.04)} className="lg:col-span-5">
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.statusDistribution')}</h2>
              {canEmployees && (
                <Link to="/employees" className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-400">
                  {t('dashboard.viewAll')}
                </Link>
              )}
            </div>
            {donut ? (
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                <div className="relative grid size-40 shrink-0 place-items-center rounded-full">
                  <div
                    className="absolute inset-0 grid size-40 place-items-center rounded-full"
                    style={{ background: `conic-gradient(${donut.gradient})` }}
                  />
                  <div className="relative grid size-28 place-items-center rounded-full bg-[var(--surface-card)] z-10">
                    <div className="text-center">
                      <p className="text-2xl font-bold tabular-nums text-ink-high">{donut.total}</p>
                      <p className="text-[10px] text-ink-low">{t('dashboard.employees')}</p>
                    </div>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2">
                  {donut.entries.map(([status, count]) => (
                    <li key={status} className="flex items-center gap-2 text-xs">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: STATUS_COLORS[status] ?? '#64748B' }}
                      />
                      <span className="flex-1 truncate text-ink-med">
                        {t(`employeeStatuses.${status}`)}
                      </span>
                      <span className="tabular-nums text-ink-low">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="py-10 text-center">
                <AlertCircle className="size-12 mx-auto mb-3 text-ink-low/30" />
                <p className="text-sm text-ink-low">{t('noAccess.body')}</p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Top departments (right) */}
        <motion.div variants={staggerItem} transition={springSoft(0.06)} className="lg:col-span-7">
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.topDepartments')}</h2>
              {canDepartments && (
                <Link to="/departments" className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-400">
                  {t('dashboard.viewAll')}
                </Link>
              )}
            </div>
            {s?.employees ? (
              s.employees.byDepartment.length === 0 ? (
                <div className="py-10 text-center">
                  <HelpCircle className="size-12 mx-auto mb-3 text-ink-low/30" />
                  <p className="text-sm text-ink-low">{t('dashboard.noDepartmentData')}</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {s.employees.byDepartment.map((dept, index) => {
                    const max = s.employees?.byDepartment[0]?.count ?? 1
                    const pct = Math.max(8, Math.round((dept.count / max) * 100))
                    return (
                      <div key={dept.id}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <div className="min-w-0 flex-1 truncate">
                            <span className="ms-0.5 me-2 inline-block w-5 text-end tabular-nums text-ink-low">
                              {index + 1}
                            </span>
                            <span dir="auto" className="font-medium text-ink-med">{dept.name}</span>
                          </div>
                          <span className="tabular-nums text-ink-low font-semibold">{dept.count}</span>
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
              )
            ) : (
              <div className="py-10 text-center">
                <AlertCircle className="size-12 mx-auto mb-3 text-ink-low/30" />
                <p className="text-sm text-ink-low">{t('noAccess.body')}</p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Secondary overview grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mb-8">
        {/* Leaves overview */}
        <motion.div variants={staggerItem} transition={springSoft(0.08)} className="lg:col-span-4">
          <GlassCard className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.leavesOverview')}</h2>
              {canLeaves && (
                <Link to="/leaves" className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-400">
                  {t('dashboard.viewAll')}
                </Link>
              )}
            </div>
            {s?.leaves ? (
              <div className="space-y-3">
                {(['pending', 'approved', 'rejected'] as const).map((status) => (
                  <div key={status} className="flex items-center justify-between rounded-2xl border border-line bg-surface-soft px-4 py-2.5">
                    <Badge tone={status === 'approved' ? 'teal' : status === 'rejected' ? 'rose' : 'gold'} dot>
                      {t(`leaves.statuses.${status}`)}
                    </Badge>
                    <span className="text-lg font-bold tabular-nums text-ink-high">
                      {s.leaves?.byStatus[status] ?? 0}
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-ink-low">{t('dashboard.leavesNote')}</p>
              </div>
            ) : (
              <div className="py-10 text-center">
                <AlertCircle className="size-12 mx-auto mb-3 text-ink-low/30" />
                <p className="text-sm text-ink-low">{t('noAccess.body')}</p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Payroll overview */}
        <motion.div variants={staggerItem} transition={springSoft(0.1)} className="lg:col-span-4">
          <GlassCard className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.payrollOverview')}</h2>
              {canPayrolls && (
                <Link to="/payrolls" className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-400">
                  {t('dashboard.viewAll')}
                </Link>
              )}
            </div>
            {s?.payrolls ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-soft px-4 py-2.5">
                  <span className="text-xs text-ink-med">{t('dashboard.payrollMonths')}</span>
                  <span className="text-lg font-bold tabular-nums text-ink-high">{s.payrolls.months}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-soft px-4 py-2.5">
                  <span className="text-xs text-ink-med">{t('dashboard.payrollEntries')}</span>
                  <span className="text-lg font-bold tabular-nums text-ink-high">{s.payrolls.entries}</span>
                </div>
                {s.payrolls.latest && (
                  <div className="rounded-2xl border border-accent-500/30 bg-accent-500/10 px-4 py-3">
                    <p className="text-[11px] text-ink-low">{t('dashboard.latestPeriod')}</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-accent-300">
                      {s.payrolls.latest.period}
                    </p>
                    <p dir="auto" className="mt-0.5 truncate text-[11px] text-ink-low">
                      {s.payrolls.latest.originalName}
                    </p>
                    <p className="mt-1 text-[10px] text-ink-low">
                      {t('dashboard.uploadedAt', { date: formatDateTime(s.payrolls.latest.uploadedAt, language) })}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-10 text-center">
                <CreditCard className="size-12 mx-auto mb-3 text-ink-low/30" />
                <p className="text-sm text-ink-low">{t('dashboard.noPayrollData')}</p>
                {canPayrolls && (
                  <Link to="/payrolls" className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-accent-300 transition-colors hover:text-accent-400">
                    <Banknote className="size-4" /> {t('dashboard.uploadPayroll')}
                  </Link>
                )}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Transfers overview */}
        <motion.div variants={staggerItem} transition={springSoft(0.12)} className="lg:col-span-4">
          <GlassCard className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.transfersOverview')}</h2>
              {canEmployees && (
                <Link to="/employees" className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-400">
                  {t('dashboard.viewAll')}
                </Link>
              )}
            </div>
            {s?.transfers !== undefined && s.transfers !== null ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-soft px-4 py-2.5">
                  <span className="text-xs text-ink-med">{t('dashboard.transfersTotal')}</span>
                  <span className="text-lg font-bold tabular-nums text-ink-high">{s.transfers.total}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-soft px-4 py-2.5">
                  <span className="text-xs text-ink-med">{t('dashboard.transfersOpen')}</span>
                  <span className="text-lg font-bold tabular-nums text-gold-400">{s.transfers.open}</span>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <AlertCircle className="size-12 mx-auto mb-3 text-ink-low/30" />
                <p className="text-sm text-ink-low">{t('noAccess.body')}</p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div variants={staggerItem} transition={springSoft(0.14)} className="mb-8">
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.quickActions')}</h2>
            <span className="text-xs text-ink-low">{t('dashboard.quickActionsHint')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon
              if (!tab.visible) return null
              return (
                <Link
                  key={tab.key}
                  to={tab.to}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3.5 transition-colors',
                    activeTab?.key === tab.key
                      ? 'border-accent-400 bg-accent-500/10'
                      : 'hover:border-accent-400/40 hover:bg-surface-strong'
                  )}
                >
                  <span className={cnTone('teal')}>
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-high">{tab.label}</span>
                  <ArrowLeft className="size-4 text-ink-low rtl:rotate-180" />
                </Link>
              )
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* System section (admins) */}
      {canSeeUsers && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mb-8">
          <motion.div variants={staggerItem} transition={springSoft(0.16)} className="lg:col-span-7">
            <RecentUsersCard language={language} />
          </motion.div>
          <motion.div variants={staggerItem} transition={springSoft(0.18)} className="lg:col-span-5">
            <SystemCard language={language} />
          </motion.div>
        </div>
      )}

      {canCreateUsers && (
        <motion.div variants={staggerItem} transition={springSoft(0.2)} className="mb-8">
          <GlassCard className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.systemActions')}</h2>
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
              <Link to="/settings">
                <SoftButton variant="ghost" icon={<Landmark className="size-4" />}>
                  {t('dashboard.backups')}
                </SoftButton>
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}

function RecentUsersCard({ language }: { language: string }) {
  const { t } = useTranslation()
  const canSeeUsers = usePermission('users.view')
  const users = useQuery({
    queryKey: ['users', 'list', {}],
    queryFn: () => api.users.list({}),
    enabled: canSeeUsers
  })
  const recent = (users.data ?? [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-ink-high">{t('dashboard.recentUsers')}</h2>
        {canSeeUsers && (
          <Link to="/users" className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-400">
            {t('dashboard.viewAll')}
          </Link>
        )}
      </div>
      <div className="divider" />
      {canSeeUsers ? (
        recent.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <UsersIcon className="size-12 mx-auto mb-3 text-ink-low/30" />
            <p className="text-sm text-ink-low">{t('dashboard.noUsersYet')}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-base">
            {recent.map((user) => (
              <div key={user.id} className="flex items-center gap-3.5 px-6 py-3.5">
                <Avatar fullName={user.fullName} id={user.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-high">{user.fullName}</p>
                  <p className="truncate text-[11px] text-ink-low">@{user.username}</p>
                </div>
                <Badge tone={user.isActive ? 'teal' : 'rose'} dot>
                  {user.isActive ? t('users.activeBadge') : t('users.inactiveBadge')}
                </Badge>
                <span className="hidden whitespace-nowrap text-[11px] text-ink-low md:block">
                  {formatDateTime(user.lastLoginAt, language)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="px-6 py-10 text-center">
          <AlertCircle className="size-12 mx-auto mb-3 text-ink-low/30" />
          <p className="text-sm text-ink-low">{t('noAccess.body')}</p>
        </div>
      )}
    </GlassCard>
  )
}

function SystemCard({ language }: { language: string }) {
  const { t } = useTranslation()
  const roles = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => api.roles.list(),
    enabled: usePermission('roles.view')
  })
  const roleList = roles.data ?? []
  return (
    <GlassCard className="p-6">
      <h2 className="mb-5 text-sm font-semibold text-ink-high">{t('dashboard.roleDistribution')}</h2>
      {roleList.length > 0 ? (
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
        <div className="py-8 text-center">
          <ShieldCheck className="size-12 mx-auto mb-3 text-ink-low/30" />
          <p className="text-sm text-ink-low">{t('roles.noRoles')}</p>
        </div>
      )}
    </GlassCard>
  )
}
