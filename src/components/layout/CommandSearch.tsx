import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CornerDownLeft, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { hasPermission } from '@shared/permissions'
import { NAV_ITEMS } from './nav'
import { scaleIn } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
  group: string
}

export function CommandSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = useUiStore((state) => state.commandOpen)
  const setOpen = useUiStore((state) => state.setCommandOpen)
  const user = useAuthStore((state) => state.user)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const commands = useMemo<Command[]>(() => {
    const items = NAV_ITEMS.filter(
      (item) => !item.permission || hasPermission(user, item.permission)
    )
    return items.map((item) => ({
      id: item.to,
      label: t(item.labelKey),
      group: t('common.open'),
      run: () => navigate(item.to)
    }))
  }, [navigate, t, user])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return commands
    return commands.filter((command) => command.label.toLowerCase().includes(normalized))
  }, [commands, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const command = filtered[activeIndex]
        if (command) {
          command.run()
          setOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, activeIndex, setOpen])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-6 pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 bg-scrim backdrop-blur-md"
            onClick={() => setOpen(false)}
          />

          <motion.div
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="glass-strong light-bar shadow-modal relative w-full max-w-xl overflow-hidden rounded-[28px]"
          >
            <div className="flex h-14 items-center gap-3 border-b border-line px-4">
              <Search className="size-4.5 text-ink-low" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`${t('common.search')}…`}
                className="h-full w-full bg-transparent text-sm text-ink-high placeholder:text-ink-low outline-none"
              />
              <kbd className="rounded-md border border-line bg-surface-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-low">
                Esc
              </kbd>
            </div>

            <div className="scroll-area max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-low">{t('users.noResults')}</p>
              ) : (
                filtered.map((command, index) => {
                  const active = index === activeIndex
                  return (
                    <button
                      key={command.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        command.run()
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors',
                        active ? 'bg-accent-500/[0.12] text-ink-high' : 'text-ink-med hover:bg-surface-soft'
                      )}
                    >
                      <span className="flex-1 font-medium">{command.label}</span>
                      {active && <CornerDownLeft className="size-3.5 text-accent-300" />}
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
