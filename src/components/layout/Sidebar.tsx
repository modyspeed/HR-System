import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { hasPermission } from '@shared/permissions'
import { NAV_ITEMS } from './nav'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const language = useUiStore((state) => state.language)
  const isRtl = language === 'ar'

  const visible = NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission))

  const sections: { key: 'management' | 'account'; label: string }[] = [
    { key: 'management', label: t('nav.sectionManagement') },
    { key: 'account', label: t('nav.sectionAccount') }
  ]

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 260 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.7 }}
      className="glass glass-card flex h-full flex-col px-3 py-5"
    >
      {/* brand */}
      <div className={cn('flex items-center gap-3 px-3', collapsed && 'justify-center px-0')}>
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-accent-300 to-accent-500 shadow-[var(--shadow-cta),var(--shadow-rim)]">
          <span className="font-serif text-base font-bold text-accent-ink">HR</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-bold text-ink-high">HR System</p>
            <p className="truncate text-[10px] text-ink-low">User & Permission Module</p>
          </div>
        )}
      </div>

      <div className="divider mx-3 my-4" />

      {/* nav */}
      <nav className="scroll-area flex-1 space-y-5 overflow-y-auto">
        {sections.map((section) => {
          const items = visible.filter((item) => item.section === section.key)
          if (items.length === 0) return null
          return (
            <div key={section.key} className="space-y-2">
              {!collapsed && (
                <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-low">
                  {section.label}
                </p>
              )}
              {items.map((item) => {
                const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
                const Icon = item.icon
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className={cn(
                      'group relative flex h-[52px] w-full items-center gap-3 rounded-full px-2.5 text-sm font-semibold transition-all',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-surface-strong text-ink-high shadow-[var(--shadow-raised),var(--shadow-glow)]'
                        : 'text-muted hover:bg-surface-soft hover:text-ink-high'
                    )}
                    title={collapsed ? t(item.labelKey) : undefined}
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-full bg-surface-strong shadow-[var(--shadow-raised),var(--shadow-rim)]',
                        active ? 'text-accent-300' : 'text-muted'
                      )}
                    >
                      <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
                    </span>
                    {!collapsed && <span className="relative truncate">{t(item.labelKey)}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="divider mx-3 my-4" />

      {/* collapse toggle */}
      <div className="px-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex h-11 w-full items-center gap-3 rounded-full text-sm font-semibold text-muted transition-colors hover:bg-surface-soft hover:text-ink-high',
            collapsed && 'justify-center px-0'
          )}
          title={t('common.close')}
        >
          {isRtl ? (
            collapsed ? (
              <ChevronLeft className="size-[18px]" />
            ) : (
              <ChevronRight className="size-[18px]" />
            )
          ) : collapsed ? (
            <ChevronRight className="size-[18px]" />
          ) : (
            <ChevronLeft className="size-[18px]" />
          )}
          {!collapsed && <span>{t('common.close')}</span>}
        </button>
      </div>
    </motion.aside>
  )
}
