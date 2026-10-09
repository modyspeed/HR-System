/**
 * Employee status catalogue (حالة الموظف الوظيفية).
 *
 * Every record carries a single `status`; `isActive` on the row is derived
 * from it (`active` is the only live status) so the two can never drift.
 * Status changes are logged in `EmployeeStatusHistory` — each transition
 * keeps the acting user and the reason, forming a full audit trail.
 */
export const EMPLOYEE_STATUS_KEYS = [
  'active', // نشط — فقط هذه الحالة تعتبر مفعَّلة
  'unpaid_leave', // إجازة بدون مرتب
  'retired', // إحالة للمعاش
  'deceased', // وفاة
  'resigned', // استقالة
  'terminated', // إنهاء خدمة / فصل
  'suspended' // موقوف عن العمل
] as const

export type EmployeeStatusKey = (typeof EMPLOYEE_STATUS_KEYS)[number]

export const ACTIVE_EMPLOYEE_STATUS = 'active'

/**
 * سن المعاش القانوني (بالسنوات) وفق قانون التأمينات الاجتماعية الموحد
 * 148/2019 — مرجعية التطبيق الافتراضية 60 عامًا؛ تُستخدم تلقائيًا في تحويل
 * الموظف إلى «محال للمعاش».
 */
export const RETIREMENT_AGE_YEARS = 60

/** تاريخ بلوغ سن المعاش من تاريخ الميلاد (yyyy-mm-dd)، أو `null`. */
export function retirementDateOf(birthDate: string | null): string | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  const date = new Date(Date.UTC(year + RETIREMENT_AGE_YEARS, month - 1, day))
  return date.toISOString().slice(0, 10)
}

/** The only status that counts as an active (enabled) employee. */
export function isActiveStatus(status: string): boolean {
  return status === ACTIVE_EMPLOYEE_STATUS
}
