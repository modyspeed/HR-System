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

/** The only status that counts as an active (enabled) employee. */
export function isActiveStatus(status: string): boolean {
  return status === ACTIVE_EMPLOYEE_STATUS
}
