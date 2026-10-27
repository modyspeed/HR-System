/**
 * مراجعة أثر الغياب: مقارنة **الفعلي** من ظرف المرتب/الحافز بـ**المتوقع**
 * المحسوب من قواعد الغياب.
 *
 * القاعدة الزمنية:
 *   غيابات حافز شهر X  →  تؤثر على حافز X نفسه، وعلى مرتب X+1.
 *
 * والمتوقع محسوب على أساس شهر من 30 يومًا (انظر `shared/absenceRules.ts`):
 *   - مرتب، «غياب بدون اذن»: (الأساسي / 30) × أيام الغياب.
 *   - مرتب، «جزاءات غياب بدون اذن»: (إجمالي الاستحقاق / 30) × أيام الجزاء.
 *   - حافز بإذن: الحافز × (الأيام / 30)
 *   - حافز بدون إذن: الحافز × نسبة الجزاء
 *
 * أما البنود غير المرتبطة بالغياب (البدلات، التأمينات، الضرائب…) فلا يوجد
 * مصدر مستقل لقيمتها المتوقعة، لذلك تُطابَق بالفعلي صراحةً بدل اختلاق رقم.
 */
import {
  ABSENCE_MONTH_DAYS,
  absencePenaltyDays,
  incentiveAbsenceRate
} from '../../shared/absenceRules'
import type {
  AbsenceReviewItem,
  AbsenceReviewNote,
  AbsenceReviewSlip,
  AbsenceReviewTotals
} from '../../shared/types'
import { itemLabelKey, normalizeItemText } from './payroll-text'

export interface ReviewEntryItem {
  kind: string
  label: string
  value: number
  sortOrder: number
}

export interface ReviewEntry {
  period: string
  type: string
  departmentId: string | null
  basicSalary: number | null
  totalEarned: number | null
  totalDeductions: number | null
  netSalary: number | null
  fileName: string | null
  items: ReviewEntryItem[]
}

type SalaryAbsenceCategory = 'withPermission' | 'withoutPermission' | 'penalty'

const SALARY_ABSENCE_LABELS: Record<SalaryAbsenceCategory, string> = {
  withPermission: 'غياب باذن',
  withoutPermission: 'غياب بدون اذن',
  penalty: 'جزاءات غياب بدون اذن'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function emptyTotals(): AbsenceReviewTotals {
  return {
    actualEarnings: null,
    expectedEarnings: null,
    actualDeductions: null,
    expectedDeductions: null,
    actualNet: null,
    expectedNet: null,
    difference: null
  }
}

/** مفتاح مبسّط للمطابقة مع اختلاف الإملاء والهمزات والتشكيل. */
function labelKey(label: string): string {
  return normalizeItemText(label)
    .replace(/[\s\u0640]+/g, '')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
}

/** يصنّف بند المرتب المرتبط بالغياب (أو null لبند عادي). */
export function classifySalaryAbsence(label: string): SalaryAbsenceCategory | null {
  const key = labelKey(label)
  if (!key.includes('غياب') && !key.includes('جزاء')) return null
  if (key.includes('بدوناذن')) {
    return key.includes('جزاء') ? 'penalty' : 'withoutPermission'
  }
  if (key.includes('باذن')) return 'withPermission'
  return null
}

function isIncentiveGross(label: string): boolean {
  const key = labelKey(label)
  return key.includes('حافز') && key.includes('شهر')
}

function kindOf(item: ReviewEntryItem): 'earning' | 'deduction' {
  return item.kind === 'earning' ? 'earning' : 'deduction'
}

/** مفتاح ثابت للبند داخل الظرف — يبقى نفسه بعد إعادة الاستخراج. */
function reviewItemKey(prefix: 'salary' | 'incentive', item: ReviewEntryItem): string {
  const label = itemLabelKey(item.label).replace(/[^\w\u0600-\u06FF]+/g, '') || 'item'
  return `${prefix}-${item.kind}-${label}-${item.sortOrder}`
}

/** بنود الظرف مرتّبة: الاستحقاقات أولًا ثم الاستقطاعات، مع ترتيب الظرف. */
function sortedItems(entry: ReviewEntry): ReviewEntryItem[] {
  return entry.items
    .filter((item) => item.kind === 'earning' || item.kind === 'deduction')
    .sort(
      (a, b) =>
        (a.kind === 'earning' ? 0 : 1) - (b.kind === 'earning' ? 0 : 1) ||
        a.sortOrder - b.sortOrder
    )
}

function sum(
  items: AbsenceReviewItem[],
  kind: 'earning' | 'deduction',
  field: 'actual' | 'expected'
): number {
  return round2(
    items
      .filter((item) => !item.informational && item.kind === kind)
      .reduce((total, item) => total + (item[field] ?? 0), 0)
  )
}

function expectedSalaryAbsence(
  basicSalary: number | null,
  totalEarnings: number | null,
  withPermission: number,
  withoutPermission: number
): Record<SalaryAbsenceCategory, number | null> {
  const basicDaily =
    basicSalary !== null && basicSalary > 0 ? basicSalary / ABSENCE_MONTH_DAYS : null
  const earningsDaily =
    totalEarnings !== null && totalEarnings > 0
      ? totalEarnings / ABSENCE_MONTH_DAYS
      : null
  return {
    withPermission: basicDaily === null ? null : round2(basicDaily * withPermission),
    // بند الغياب نفسه يُخصم من الأساسي عن كل أيام الغياب بدون إذن.
    withoutPermission:
      basicDaily === null ? null : round2(basicDaily * withoutPermission),
    // الجزاء الإضافي يُحسب على إجمالي استحقاق ظرف المرتب، وبأيام الجزاء.
    penalty:
      earningsDaily === null
        ? null
        : round2(earningsDaily * absencePenaltyDays(withoutPermission))
  }
}

/** مراجعة ظرف المرتب المتأثر بغيابات الشهر السابق. */
export function reviewSalary(params: {
  period: string
  basicSalary: number | null
  withPermission: number
  withoutPermission: number
  entry: ReviewEntry | null
}): AbsenceReviewSlip {
  const notes: AbsenceReviewNote[] = []
  const basicSalary = params.basicSalary ?? params.entry?.basicSalary ?? null
  if (basicSalary === null) notes.push('basicMissing')
  // Prefer the printed total; if it is absent, reconstruct gross earnings from
  // the slip's earning items so the penalty still uses the correct base.
  const totalEarnings =
    params.entry?.totalEarned ??
    (params.entry
      ? round2(
          params.entry.items
            .filter((item) => item.kind === 'earning')
            .reduce((total, item) => total + item.value, 0)
        )
      : null)

  const expected = expectedSalaryAbsence(
    basicSalary,
    totalEarnings,
    params.withPermission,
    params.withoutPermission
  )

  const items: AbsenceReviewItem[] = []
  const found = new Set<SalaryAbsenceCategory>()
  const entry = params.entry

  if (!entry) {
    notes.push('salarySlipMissing')
  } else {
    for (const item of sortedItems(entry)) {
      const category = classifySalaryAbsence(item.label)
      if (category) found.add(category)
      const expectedValue = category ? expected[category] : round2(item.value)
      items.push({
        key: reviewItemKey('salary', item),
        label: item.label,
        kind: kindOf(item),
        actual: round2(item.value),
        expected: expectedValue,
        difference: expectedValue === null ? null : round2(item.value - expectedValue),
        informational: false
      })
    }
  }

  // خصم متوقع لم يظهر في الظرف أصلًا ⇒ الفعلي صفر، والفرق سالب بمقدار المتوقع.
  for (const category of Object.keys(SALARY_ABSENCE_LABELS) as SalaryAbsenceCategory[]) {
    const expectedValue = expected[category]
    if (found.has(category) || expectedValue === null || expectedValue <= 0.005) continue
    items.push({
      key: `salary-expected-${category}`,
      label: SALARY_ABSENCE_LABELS[category],
      kind: 'deduction',
      actual: entry ? 0 : null,
      expected: expectedValue,
      difference: entry ? round2(-expectedValue) : null,
      informational: false
    })
  }

  if (!entry) {
    return {
      type: 'salary',
      period: params.period,
      available: false,
      fileName: null,
      basicSalary,
      rate: null,
      rateSource: null,
      items,
      totals: {
        ...emptyTotals(),
        expectedDeductions: sum(items, 'deduction', 'expected') || null
      },
      notes
    }
  }

  const actualEarnings = sum(items, 'earning', 'actual')
  const expectedEarnings = sum(items, 'earning', 'expected')
  const actualDeductions = sum(items, 'deduction', 'actual')
  const expectedDeductions = sum(items, 'deduction', 'expected')
  const actualNet = entry.netSalary ?? round2(actualEarnings - actualDeductions)
  const expectedMissing =
    basicSalary === null && (params.withPermission > 0 || params.withoutPermission > 0)
  const expectedNet = expectedMissing ? null : round2(expectedEarnings - expectedDeductions)

  return {
    type: 'salary',
    period: params.period,
    available: true,
    fileName: entry.fileName,
    basicSalary,
    rate: null,
    rateSource: null,
    items,
    totals: {
      actualEarnings,
      expectedEarnings,
      actualDeductions,
      expectedDeductions,
      actualNet: round2(actualNet),
      expectedNet,
      difference: expectedNet === null ? null : round2(actualNet - expectedNet)
    },
    notes
  }
}

function incentiveInfoItems(
  base: number | null,
  withPermissionDeduction: number | null,
  withoutPermissionDeduction: number | null,
  penaltyApplied: boolean,
  penaltyLabel: string
): AbsenceReviewItem[] {
  const rows: AbsenceReviewItem[] = []
  if (base !== null) {
    rows.push({
      key: 'incentive-expected-base',
      label: 'الحافز قبل الغياب',
      kind: 'earning',
      actual: null,
      expected: base,
      difference: null,
      informational: true
    })
  }
  if (withPermissionDeduction !== null && withPermissionDeduction > 0.005) {
    rows.push({
      key: 'incentive-expected-with-permission',
      label: 'خصم غياب بإذن',
      kind: 'deduction',
      actual: null,
      expected: withPermissionDeduction,
      difference: null,
      informational: true
    })
  }
  if (withoutPermissionDeduction !== null && withoutPermissionDeduction > 0.005) {
    rows.push({
      key: penaltyApplied ? 'incentive-penalty-info' : 'incentive-expected-without-permission',
      label: penaltyApplied ? penaltyLabel : 'خصم غياب بدون إذن',
      kind: 'deduction',
      actual: null,
      expected: withoutPermissionDeduction,
      difference: null,
      informational: true
    })
  }
  return rows
}

/** مراجعة ظرف الحافز الذي وقعت فيه الغيابات. */
export function reviewIncentive(params: {
  period: string
  basicSalary: number | null
  rate: number | null
  rateSource: 'employee' | 'department' | null
  withPermission: number
  withoutPermission: number
  entry: ReviewEntry | null
  penalty?: { rate: number | null; amount: number } | null
}): AbsenceReviewSlip {
  const notes: AbsenceReviewNote[] = []
  const basicSalary = params.basicSalary ?? params.entry?.basicSalary ?? null
  if (basicSalary === null) notes.push('basicMissing')
  if (params.rate === null) notes.push('rateMissing')

  const base =
    basicSalary !== null && params.rate !== null
      ? round2(basicSalary * params.rate)
      : null
  const withPermissionDeduction =
    base === null ? null : round2(base * (params.withPermission / ABSENCE_MONTH_DAYS))
  const ruleWithoutPermissionDeduction =
    base === null ? null : round2(base * incentiveAbsenceRate(params.withoutPermission))
  const penaltyAmount = params.penalty?.amount ?? 0
  const penaltyRateValue = params.penalty?.rate ?? null
  const penaltyRateDeduction =
    base === null || penaltyRateValue === null ? null : round2(base * (penaltyRateValue / 100))
  const penaltyValue = Math.max(penaltyRateDeduction ?? 0, penaltyAmount)
  const hasPenalty =
    params.penalty != null && (penaltyAmount > 0.005 || penaltyRateValue !== null)
  // الحرمان المسجّل قد يكون نسبة أو مبلغًا. إذا تجاوز جزاء الغياب المحسوب
  // بالقواعد فهو المطبّق؛ وإلا يبقى جزاء الغياب هو المرجع. لا نجمع الاثنين
  // تفاديًا لخصم الحرمان مرتين.
  const penaltyApplied =
    hasPenalty && penaltyValue > (ruleWithoutPermissionDeduction ?? 0) + 0.005
  const withoutPermissionDeduction = hasPenalty
    ? round2(Math.max(ruleWithoutPermissionDeduction ?? 0, penaltyValue))
    : ruleWithoutPermissionDeduction
  const penaltyLabel =
    penaltyRateValue !== null ? `حرمان من الحافز (${penaltyRateValue}%)` : 'حرمان من الحافز'
  const expectedGross =
    base === null
      ? null
      : Math.max(
          0,
          round2(base - (withPermissionDeduction ?? 0) - (withoutPermissionDeduction ?? 0))
        )

  const entry = params.entry
  const items: AbsenceReviewItem[] = []

  if (!entry) {
    notes.push('incentiveSlipMissing')
    if (expectedGross !== null) {
      items.push({
        key: 'incentive-gross',
        label: 'الحافز الشهري',
        kind: 'earning',
        actual: null,
        expected: expectedGross,
        difference: null,
        informational: false
      })
    }
  } else {
    const actualItems = sortedItems(entry)
    const grossIndex = actualItems.findIndex(
      (item) => item.kind === 'earning' && isIncentiveGross(item.label)
    )
    const firstEarningIndex = actualItems.findIndex((item) => item.kind === 'earning')
    const expectedGrossIndex = grossIndex >= 0 ? grossIndex : firstEarningIndex

    for (const [index, item] of actualItems.entries()) {
      const isGross = index === expectedGrossIndex
      const expectedValue = isGross ? expectedGross : round2(item.value)
      items.push({
        key: reviewItemKey('incentive', item),
        label: item.label,
        kind: kindOf(item),
        actual: round2(item.value),
        expected: expectedValue,
        difference: expectedValue === null ? null : round2(item.value - expectedValue),
        informational: false
      })
    }

    // ظرف بلا بند استحقاق (حالة نادرة): نُظهر الحافز المتوقع كصف مستقل
    // بدل أن يختفي الفرق من المراجعة.
    if (expectedGrossIndex < 0 && expectedGross !== null) {
      items.push({
        key: 'incentive-gross',
        label: 'الحافز الشهري',
        kind: 'earning',
        actual: 0,
        expected: expectedGross,
        difference: round2(-expectedGross),
        informational: false
      })
    }
  }

  items.push(
    ...incentiveInfoItems(
      base,
      withPermissionDeduction,
      withoutPermissionDeduction,
      penaltyApplied,
      penaltyLabel
    )
  )

  if (!entry) {
    return {
      type: 'incentive',
      period: params.period,
      available: false,
      fileName: null,
      basicSalary,
      rate: params.rate,
      rateSource: params.rateSource,
      items,
      totals: {
        ...emptyTotals(),
        expectedEarnings: expectedGross
      },
      notes
    }
  }

  const actualEarnings = sum(items, 'earning', 'actual')
  const actualDeductions = sum(items, 'deduction', 'actual')
  const actualNet = entry.netSalary ?? round2(actualEarnings - actualDeductions)
  const expectedEarnings = expectedGross
  const expectedNet =
    expectedEarnings === null ? null : round2(expectedEarnings - actualDeductions)

  return {
    type: 'incentive',
    period: params.period,
    available: true,
    fileName: entry.fileName,
    basicSalary,
    rate: params.rate,
    rateSource: params.rateSource,
    items,
    totals: {
      actualEarnings,
      expectedEarnings,
      actualDeductions,
      expectedDeductions: actualDeductions,
      actualNet: round2(actualNet),
      expectedNet,
      difference:
        expectedNet === null ? null : round2(actualNet - expectedNet)
    },
    notes
  }
}
