import type { PayrollTypeKey } from '@shared/payrolls'
import { PAYROLL_TYPE_KEYS } from '@shared/payrolls'

export type { PayrollTypeKey }
export { PAYROLL_TYPE_KEYS }

export type BadgeTone = 'gold' | 'teal' | 'violet' | 'rose' | 'neutral'

const TYPE_TONES: Record<string, BadgeTone> = {
  salary: 'gold',
  incentive: 'teal',
  other: 'violet'
}

export function payrollTypeTone(type: string): BadgeTone {
  return TYPE_TONES[type] ?? 'neutral'
}

/** «2026-09» → عرض عربي مقروء «09 / 2026». */
export function periodLabel(period: string): string {
  const [year, month] = period.split('-')
  return `${month} / ${year}`
}
