/**
 * قواعد الغياب المشتركة بين الخلفية والواجهة.
 *
 * الشهر محسوب **30 يومًا** في كل حسابات المتوقع، كما تنصّ القواعد:
 *   - مرتب، بند «غياب بدون اذن» = (إجمالي الاستحقاق / 30) × أيام الغياب بدون إذن.
 *   - مرتب، بند «جزاءات غياب بدون اذن» = (إجمالي الاستحقاق / 30) × أيام الجزاء.
 *     أساس البندين إجمالي استحقاق ظرف المرتب، وليس الأساسي.
 *   - خصم الحافز بإذن = الحافز × (الأيام / 30)
 *   - خصم الحافز بدون إذن = الحافز × نسبة الجزاء
 *   - خصم المرتب بدون إذن = بندان مستقلان على إجمالي الاستحقاق:
 *       1) «غياب بدون اذن»: الأيام كاملة من إجمالي الاستحقاق.
*       2) «جزاءات غياب بدون اذن»: تُجمع معدلات الجدول (0.25 / 0.5 / 1 / 2 / 4)
*          يومًا بيوم عن كل يوم غياب بدون إذن، وتُضرب في قيمة اليوم من إجمالي الاستحقاق.
 */
export const ABSENCE_MONTH_DAYS = 30

/**
 * أيام الجزاء الإضافي على المرتب بحسب عدد أيام الغياب بدون إذن.
 * تُجمع معدلات الجزاء يومًا بيوم: اليوم الأول 0.25، الثاني 0.5، الثالث 1،
 * والرابع 2. والحد الأقصى لجزء الغياب 4 أيام غياب، أي مجموع (.25 + .5 + 1 + 2)
 * فلا يزيد الجزاء عن ذلك مهما زادت أيام الغياب.
 * مثال: 3 أيام غياب = 0.25 + 0.5 + 1 = 1.75 يوم جزاء.
 * هذه قيمة أيام تُضرب في قيمة اليوم من إجمالي استحقاق المرتب، وليست نسبة مئوية.
 */
const PENALTY_BY_DAY = [0.25, 0.5, 1, 2]

export function absencePenaltyDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0
  let total = 0
  const fullDays = Math.min(Math.floor(days), PENALTY_BY_DAY.length)
  for (let d = 1; d <= fullDays; d++) {
    total += PENALTY_BY_DAY[d - 1]
  }
  return total
}

/** نسبة الخصم من الحافز عند الغياب بدون إذن. */
export function incentiveAbsenceRate(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0
  if (days < 2) return 0.05
  if (days < 3) return 0.15
  if (days < 4) return 0.3
  if (days < 5) return 0.5
  if (days < 6) return 0.75
  return 1
}

/** «2026-09» → «2026-10». */
export function nextPeriod(period: string): string {
  return addMonths(period, 1)
}

/** يضيف أشهرًا إلى فترة «yyyy-mm» مع عبور السنة. */
export function addMonths(period: string, delta: number): string {
  const [yearText, monthText] = period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return period

  const zeroBased = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(zeroBased / 12)
  const nextMonth = (zeroBased % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

/** أول يوم في الشهر التالي — حدّ أعلى لمقارنة تواريخ الأساسي. */
export function periodEndDate(period: string): Date {
  const next = nextPeriod(period)
  const [yearText, monthText] = next.split('-')
  return new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1))
}
