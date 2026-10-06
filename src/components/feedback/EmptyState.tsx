import { motion } from 'framer-motion'
import { fadeUp, spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  body?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={spring}
      className={cn('flex flex-col items-center px-6 py-16 text-center', className)}
    >
      <div className="mb-5 grid size-16 place-items-center rounded-full border border-line bg-surface-soft text-ink-low">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink-high">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-low">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}
