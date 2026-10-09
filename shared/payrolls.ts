/** أنواع الأجور/المرتبات — يُستنتج من اسم ملف الكشف (حافز / مرتب / غير ذلك). */
export const PAYROLL_TYPE_KEYS = ['salary', 'incentive', 'other'] as const

export type PayrollTypeKey = (typeof PAYROLL_TYPE_KEYS)[number]

/** يُستنتج نوع الدفعة من اسم الملف العربي. */
export function detectPayrollType(fileName: string): PayrollTypeKey {
  const name = fileName.toLowerCase()
  if (name.includes('حافز') || name.includes('bonus') || name.includes('incentive')) return 'incentive'
  if (name.includes('مرتب') || name.includes('راتب') || name.includes('salary')) return 'salary'
  return 'other'
}

/** يستخرج الشهر والسنة من اسم ملف مثل «مرتب شهر 092026.pdf» أو «حافز 052026.pdf». */
export function detectPayrollPeriod(fileName: string): { month: number; year: number } | null {
  const match = fileName.match(/(\d{2})(\d{4})\.pdf/i) ?? fileName.match(/(\d{2})[-/]?(\d{4})/)
  if (!match) return null
  const month = Number(match[1])
  const year = Number(match[2])
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null
  return { month, year }
}
