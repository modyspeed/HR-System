import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Languages, LogOut, Moon, Search, Sun, UserCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePermission } from '@/hooks/usePermission'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export function Topbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const language = useUiStore((state) => state.language)
  const setLanguage = useUiStore((state) => state.setLanguage)
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const setCommandOpen = useUiStore((state) => state.setCommandOpen)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const canSeeSettings = usePermission('settings.view')

  const roleLabel = language === 'ar' ? user?.roleNameAr : user?.roleNameEn

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) return null

  return (
    <header
      className="glass glass-card relative z-30 flex h-[66px] shrink-0 items-center gap-3 overflow-visible px-4"
    >
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="field focus-ring group flex h-12 flex-1 max-w-md items-center gap-3 px-5 text-sm text-ink-low transition-colors hover:border-line-strong"
      >
        <Search className="size-4" />
        <span className="flex-1 text-start">{t('common.search')}…</span>
        <kbd className="rounded-md border border-line bg-surface-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-low">
          Ctrl K
        </kbd>
      </button>

      <div className="flex-1" />

      {/* theme switch */}
      <button
        type="button"
        onClick={toggleTheme}
        className="focus-ring group grid size-12 place-items-center rounded-full bg-surface-strong text-ink-med shadow-[var(--shadow-raised),var(--shadow-rim)] transition-colors hover:text-ink-high"
        title={t('settings.toggleTheme')}
        aria-label={t('settings.toggleTheme')}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="grid place-items-center"
          >
            {theme === 'light' ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
          </motion.span>
        </AnimatePresence>
      </button>

      {/* language switch */}
      <button
        type="button"
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className="focus-ring flex h-12 items-center gap-2 rounded-full bg-surface-strong px-4 text-sm font-semibold text-ink-med shadow-[var(--shadow-raised),var(--shadow-rim)] transition-colors hover:text-ink-high"
        title={t('settings.language')}
      >
        <Languages className="size-4" />
        <span>{language === 'ar' ? 'ع' : 'EN'}</span>
      </button>

      {/* account menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="focus-ring flex h-12 items-center gap-2.5 rounded-full bg-surface-strong ps-2 pe-4 shadow-[var(--shadow-raised),var(--shadow-rim)] transition-colors hover:border-line-strong"
        >
          <Avatar fullName={user.fullName} id={user.id} size="sm" />
          <span className="flex flex-col items-start leading-tight">
            <span className="max-w-[140px] truncate text-xs font-bold text-ink-high">
              {user.fullName}
            </span>
            <span className="max-w-[140px] truncate text-[10px] text-ink-low">{roleLabel}</span>
          </span>
          <ChevronDown className={cn('size-3.5 text-ink-low transition-transform', menuOpen && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className={cn(
                'glass-strong shadow-pop absolute top-12 z-50 w-64 overflow-hidden rounded-2xl p-2',
                language === 'ar' ? 'left-0' : 'right-0'
              )}
            >
              <div className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
                <Avatar fullName={user.fullName} id={user.id} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-high">{user.fullName}</p>
                  <p className="truncate text-[11px] text-ink-low">@{user.username}</p>
                </div>
              </div>
              <div className="px-2.5 pb-2">
                <Badge tone="gold" dot>
                  {roleLabel}
                </Badge>
              </div>
              <div className="divider mb-1.5" />
              <MenuItem
                icon={<UserCircle className="size-4" />}
                label={t('nav.profile')}
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/profile')
                }}
              />
              {canSeeSettings && (
                <MenuItem
                  icon={<Languages className="size-4" />}
                  label={i18n.language === 'ar' ? 'English' : 'العربية'}
                  onClick={() => {
                    setMenuOpen(false)
                    void setLanguage(i18n.language === 'ar' ? 'en' : 'ar')
                  }}
                />
              )}
              <div className="divider my-1.5" />
              <MenuItem
                icon={<LogOut className="size-4" />}
                label={t('nav.signOut')}
                danger
                onClick={() => {
                  setMenuOpen(false)
                  void logout().then(() => navigate('/login'))
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors',
        danger
          ? 'text-rose-400 hover:bg-rose-500/10'
          : 'text-ink-med hover:bg-surface-strong hover:text-ink-high'
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  )
}
