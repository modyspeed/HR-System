/**
 * قواعد الغياب المشتركة بين الخلفية والواجهة.
 *
 * الشهر محسوب **30 يومًا** في كل حسابات المتوقع، كما تنصّ القواعد:
 *   - مرتب، بند «غياب بدون اذن» = (الأساسي / 30) × أيام الغياب بدون إذن.
 *   - مرتب، بند «جزاءات غياب بدون اذن» = (إجمالي الاستحقاق / 30) × أيام الجزاء.
 *     أساس الجزاء هنا إجمالي استحقاق ظرف المرتب، وليس الأساسي.
 *   - خصم الحافز بإذن = الحافز × (الأيام / 30)
 *   - خصم الحافز بدون إذن = الحافز × نسبة الجزاء
 *   - خصم المرتب بدون إذن = بندان مستقلان بأساسين مختلفين:
 *       1) «غياب بدون اذن»: الأيام كاملة من الأساسي.
 *       2) «جزاءات غياب بدون اذن»: أيام الجدول (0.25 / 0.5 / 1 / 2 / 4)
 *          من إجمالي الاستحقاق.
 */
export const ABSENCE_MONTH_DAYS = 30

/**
 * أيام الجزاء الإضافي على المرتب بحسب عدد أيام الغياب بدون إذن:
 * يوم واحد = 0.25، يومان = 0.5، 3 أيام = 1، 4 أيام = 2،
 * و5 أيام فأكثر = 4 أيام جزاء.
 * هذه قيمة أيام تُضرب في قيمة اليوم من إجمالي استحقاق المرتب، وليست نسبة مئوية.
 */
export function absencePenaltyDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0
  if (days <= 1) return 0.25
  if (days <= 2) return 0.5
  if (days <= 3) return 1
  if (days <= 4) return 2
  return 4
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
