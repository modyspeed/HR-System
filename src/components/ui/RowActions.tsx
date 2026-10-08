import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface RowAction {
  key: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

const GAP = 6

export function RowActions({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const enabled = actions.filter((action) => !action.disabled)

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  /**
   * The menu is portalled to <body> because the table scrolls on both axes
   * (`overflow-x-auto` makes the vertical axis clip too), which would otherwise
   * cut the dropdown off and force the user to scroll to reach it. Here it is
   * anchored to the button, flips up when the bottom edge is near, and stays
   * inside the viewport.
   */
  useLayoutEffect(() => {
    if (!open) return

    const place = () => {
      const button = containerRef.current
      const menu = menuRef.current
      if (!button || !menu) return

      const buttonRect = button.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      if (!menuRect.width || !menuRect.height) return

      let top = buttonRect.bottom + GAP
      if (top + menuRect.height > window.innerHeight) {
        top = Math.max(GAP, buttonRect.top - menuRect.height - GAP)
      }

      const isRtl = document.documentElement.dir === 'rtl'
      let left = isRtl ? buttonRect.left : buttonRect.right - menuRect.width
      const maxLeft = window.innerWidth - menuRect.width - GAP
      left = Math.max(GAP, Math.min(left, maxLeft))

      setPosition({ top, left })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  return (
    <div className="relative flex justify-end" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setPosition(null)
          setOpen((value) => !value)
        }}
        className="focus-ring grid size-8 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-ink-high"
        aria-label="Actions"
      >
        <span className="flex flex-col gap-[3px]">
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
        </span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="glass-strong shadow-pop fixed z-[70] w-44 overflow-hidden rounded-xl p-1.5"
              style={position ?? { top: -9999, left: -9999 }}
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
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
