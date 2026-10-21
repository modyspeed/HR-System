import { motion } from 'framer-motion'
import { staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * جداول موحّدة الشكل في كل الشاشات.
 *
 * كل جدول في التطبيق يمرّ من هنا، فيكون treatment واحد: رأس ثابت أثناء
 * التمرير، وتذييل إجماليات ثابت، وترويسة موحّدة الألوان والمسافات.
 */

/** ارتفاعات منطقة التمرير — الأصغر داخل النوافذ المنبثقة. */
const SIZES = {
  xs: 'max-h-[18vh]',
  sm: 'max-h-[34vh]',
  md: 'max-h-[52vh]',
  lg: 'max-h-[68vh]'
} as const

export type DataTableSize = keyof typeof SIZES
export type DataTableAlign = 'start' | 'center' | 'end'

const ALIGN: Record<DataTableAlign, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end'
}

interface DataTableProps {
  children: React.ReactNode
  /** أقصى ارتفاع لمنطقة التمرير — يجعل الرأس ثابتًا. */
  size?: DataTableSize
  /** تجاوز صريح للارتفاع — صنف Tailwind كامل. */
  maxHeight?: string
  /** أقل عرض للجدول (صف أفقي على الشاشات الضيقة) — صنف Tailwind كامل. */
  minWidth?: string
  className?: string
}

export function DataTable({
  children,
  size = 'lg',
  maxHeight,
  minWidth,
  className
}: DataTableProps) {
  return (
    <div className={cn('scroll-area overflow-auto', maxHeight ?? SIZES[size], className)}>
      <table className={cn('w-full border-collapse text-sm', minWidth)}>{children}</table>
    </div>
  )
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-30 shadow-key">{children}</thead>
}

export function DataTableHeadRow({
  children,
  dense = false
}: {
  children: React.ReactNode
  /** رأس مضغوط لشبكات المعاينة داخل النوافذ. */
  dense?: boolean
}) {
  return (
    <tr
      className={cn(
        'border-b border-line-strong bg-bg-700 uppercase tracking-wider text-ink-low',
        dense ? 'text-[10px]' : 'text-[11px]'
      )}
    >
      {children}
    </tr>
  )
}

interface DataTableHeadCellProps {
  children: React.ReactNode
  align?: DataTableAlign
  className?: string
  /** خلية مضغوطة لشبكات المعاينة داخل النوافذ. */
  dense?: boolean
}

export function DataTableHeadCell({
  children,
  align = 'start',
  className,
  dense = false
}: DataTableHeadCellProps) {
  return (
    <th
      className={cn(
        'border-b border-line-strong bg-bg-700 font-semibold',
        dense ? 'px-3 py-2.5' : 'px-5 py-3.5',
        ALIGN[align],
        className
      )}
    >
      {children}
    </th>
  )
}

/** جسم الجدول بحركة تدريجية موحّدة. */
export function DataTableBody({ children }: { children: React.ReactNode }) {
  return (
    <motion.tbody
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="divide-y divide-surface-base"
    >
      {children}
    </motion.tbody>
  )
}

export function DataTableFoot({ children }: { children: React.ReactNode }) {
  return (
    <tfoot className="sticky bottom-0 z-20 shadow-[0_-14px_24px_-16px_rgba(0,0,0,0.6)]">
      {children}
    </tfoot>
  )
}

export function DataTableFootRow({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <tr
      className={cn(
        'border-t border-line-strong bg-bg-700 text-sm font-bold text-ink-high',
        className
      )}
    >
      {children}
    </tr>
  )
}

interface DataTableFootCellProps {
  children?: React.ReactNode
  align?: DataTableAlign
  className?: string
  /** للأرقام والعناوين اللاتينية داخل نص عربي. */
  dir?: 'ltr' | 'rtl'
}

export function DataTableFootCell({
  children,
  align = 'center',
  className,
  dir
}: DataTableFootCellProps) {
  return (
    <td dir={dir} className={cn('bg-bg-700 px-5 py-3.5', ALIGN[align], className)}>
      {children}
    </td>
  )
}
