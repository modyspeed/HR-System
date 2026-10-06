import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from './Modal'
import { SoftButton } from './SoftButton'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onClose} size="sm" closeOnBackdrop={!loading}>
      <div className="flex gap-4 pb-2">
        <div
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-full border',
            danger
              ? 'border-rose-400/30 bg-rose-500/10 text-rose-400'
              : 'border-accent-500/30 bg-accent-500/10 text-accent-300'
          )}
        >
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-ink-high">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-med">{body}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-1 pt-5">
        <SoftButton variant="subtle" onClick={onClose} disabled={loading}>
          {cancelLabel ?? t('common.cancel')}
        </SoftButton>
        <SoftButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel ?? t('common.confirm')}
        </SoftButton>
      </div>
    </Modal>
  )
}
