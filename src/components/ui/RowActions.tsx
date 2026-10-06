import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RowAction {
  key: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const enabled = actions.filter((action) => !action.disabled)

  return (
    <div className="relative flex justify-end" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-ink-high"
        aria-label="Actions"
      >
        <span className="flex flex-col gap-[3px]">
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="glass-strong shadow-pop absolute top-9 z-40 w-44 overflow-hidden rounded-xl p-1.5"
            style={{ insetInlineEnd: 0 }}
          >
            {enabled.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  setOpen(false)
                  action.onClick()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors',
                  action.danger
                    ? 'text-rose-400 hover:bg-rose-500/10'
                    : 'text-ink-med hover:bg-surface-strong hover:text-ink-high'
                )}
              >
                {action.icon}
                <span className="font-medium">{action.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
