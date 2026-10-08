import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Download, FileText, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ExportPayload } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { SoftButton } from './SoftButton'

const GAP = 6

interface ExportMenuProps {
  /** `null` when there is nothing to export — the trigger then stays disabled. */
  payload: ExportPayload | null
}

/**
 * "Export" split button: PDF report or styled Excel sheet, both written through
 * a native save dialog. The menu is portalled to <body> (same anchoring rules
 * as `RowActions`) so it is never clipped by the page's scroll containers.
 */
export function ExportMenu({ payload }: ExportMenuProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  // anchor to the trigger, flip up near the bottom edge, stay in the viewport
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

  const run = async (kind: 'pdf' | 'excel') => {
    if (!payload) return
    setOpen(false)
    setBusy(kind)
    try {
      const savedPath = kind === 'pdf' ? await api.export.toPdf(payload) : await api.export.toExcel(payload)
      if (savedPath) toast.success(t('export.success'), { description: savedPath })
      else toast.info(t('export.cancelled'))
    } catch (error) {
      toast.error(t('export.failed'), { description: resolveApiError(error) })
    } finally {
      setBusy(null)
    }
  }

  const items = [
    {
      key: 'pdf',
      label: t('export.pdf'),
      hint: t('export.pdfHint'),
      icon: <FileText className="size-4 shrink-0 text-accent-300" />,
      onClick: () => void run('pdf')
    },
    {
      key: 'excel',
      label: t('export.excel'),
      hint: t('export.excelHint'),
      icon: <Table2 className="size-4 shrink-0 text-teal-400" />,
      onClick: () => void run('excel')
    }
  ]

  return (
    <div className="relative" ref={containerRef}>
      <SoftButton
        variant="ghost"
        icon={<Download className="size-4" />}
        loading={busy !== null}
        disabled={!payload}
        title={!payload ? t('export.noRows') : undefined}
        onClick={() => {
          setPosition(null)
          setOpen((value) => !value)
        }}
      >
        {busy !== null ? t('export.exporting') : t('export.title')}
        {busy === null && <ChevronDown className="size-3.5 opacity-60" />}
      </SoftButton>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="glass-strong shadow-pop fixed z-[70] w-56 overflow-hidden rounded-xl p-1.5"
              style={position ?? { top: -9999, left: -9999 }}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-surface-strong"
                >
                  {item.icon}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-ink-high">{item.label}</span>
                    <span className="text-[10px] leading-tight text-ink-low">{item.hint}</span>
                  </span>
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
