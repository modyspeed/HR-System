import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { scaleIn } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnBackdrop?: boolean
  className?: string
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Portal to <body>: the route wrapper inside <main> carries framer-motion
  // `filter: blur(0px)` after page transitions, and a filtered ancestor becomes
  // the containing block for `position: fixed` — which anchored the dialog to
  // the scrolled content instead of the viewport (reaching it needed a long
  // scroll). Portalling escapes that ancestor, so the dialog is viewport-locked.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-scrim backdrop-blur-md"
            onClick={() => closeOnBackdrop && onClose()}
          />

          <motion.div
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 0.8 }}
            className={cn(
              'glass-strong light-bar shadow-modal relative max-h-[calc(100vh-3rem)] w-full overflow-hidden rounded-[28px]',
              SIZES[size],
              className
            )}
          >
            <div className="flex max-h-full flex-col">
              {(title || description) && (
                <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
                  <div className="min-w-0">
                    {title && (
                      <h2 className="text-lg font-bold leading-tight text-ink-high">{title}</h2>
                    )}
                    {description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-med">{description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-ink-high"
                    aria-label="Close"
                  >
                    <X className="size-4.5" />
                  </button>
                </div>
              )}

              <div className="scroll-area max-h-[65vh] overflow-y-auto px-6">{children}</div>

              {footer && (
                <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
