/**
 * قواعد احتساب مستحقات شهر المعاش.
 *
 * - تاريخ المعاش = الميلاد + 60 سنة − يوم واحد (في `retirementDateOf`).
 * - الأيام الفعلية = يوم تاريخ المعاش، بحد أقصى 30 يومًا.
 * - نسبة الأساس = الأيام الفعلية ÷ 30.
 * - الراتب الموزع = الأساسي × نسبة الأساس.
 * - بدل الطبيعة = الراتب الموزع × (نسبة القسم ÷ 100).
 * - في الأقسام القيادية، نسبة القسم هي نسبة القسم السابق للترقية.
 */
export const RETIREMENT_MONTH_DAYS = 30

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** يوم تاريخ المعاش مع حد أقصى 30، أو 0 إن كان التاريخ غير صالح. */
export function retirementActualDays(retirementDate: string | null): number {
  if (!retirementDate || !/^\d{4}-\d{2}-\d{2}$/.test(retirementDate)) return 0
  const day = Number(retirementDate.slice(8, 10))
  if (!Number.isFinite(day) || day <= 0) return 0
  return Math.min(day, RETIREMENT_MONTH_DAYS)
}

/** نسبة الأساس = الأيام الفعلية ÷ 30. */
export function retirementBaseRatio(actualDays: number): number {
  if (!Number.isFinite(actualDays) || actualDays <= 0) return 0
  return Math.min(actualDays, RETIREMENT_MONTH_DAYS) / RETIREMENT_MONTH_DAYS
}

/** الراتب الموزع = الأساسي × نسبة الأساس. */
export function distributedSalary(
  basicSalary: number | null,
  ratio: number
): number | null {
  if (basicSalary === null || !Number.isFinite(basicSalary)) return null
  return round2(basicSalary * ratio)
}

/** بدل الطبيعة = الراتب الموزع × (نسبة القسم ÷ 100). */
export function retirementNatureAllowance(
  distributed: number | null,
  natureAllowancePct: number | null
): number | null {
  if (distributed === null || !Number.isFinite(distributed)) return null
  if (
    natureAllowancePct === null ||
    !Number.isFinite(natureAllowancePct) ||
    natureAllowancePct < 0 ||
    natureAllowancePct > 100
  ) {
    return null
  }
  return round2(distributed * (natureAllowancePct / 100))
}
