import { motion } from 'framer-motion'
import { fadeUp, spring } from '@/lib/motion'

interface PageHeaderProps {
  title: string
  subtitle?: string
  accent?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, accent, actions }: PageHeaderProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={spring}
      className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        {accent && (
          <div className="font-serif text-[15px] tracking-wide text-accent-300">{accent}</div>
        )}
        <h1 className="text-[32px] font-bold leading-tight text-ink-high">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-med">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </motion.div>
  )
}
