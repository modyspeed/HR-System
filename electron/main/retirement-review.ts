/**
 * مراجعة مستحقات شهر المعاش: الفعلي من ظرف المرتب مقابل المتوقع من قواعد
 * المعاش (الأيام الفعلية ÷ 30، الأساسي الموزع، وبدل الطبيعة).
 *
 * البنود غير المرتبطة بالقواعد (بدلات/استقطاعات أخرى) تُطابَق بالفعلي لعدم
 * وجود مصدر متوقع مستقل لها — أسوةً بمراجعة الغيابات.
 */
import {
  RETIREMENT_MONTH_DAYS,
  distributedSalary,
  retirementActualDays,
  retirementBaseRatio,
  retirementNatureAllowance
} from '../../shared/retirementRules'
import type {
  RetirementReviewItem,
  RetirementReviewNoteKey,
  RetirementReviewSlip,
  RetirementReviewTotals
} from '../../shared/types'
import { itemLabelKey } from './payroll-text'

export interface RetirementReviewEntryItem {
  kind: string
  label: string
  value: number
  sortOrder: number
}

export interface RetirementReviewEntry {
  period: string
  basicSalary: number | null
  totalEarned: number | null
  totalDeductions: number | null
  netSalary: number | null
  fileName: string | null
  items: RetirementReviewEntryItem[]
}

type SalaryItemCategory = 'basic' | 'nature'

const EXPECTED_LABELS: Record<SalaryItemCategory, string> = {
  basic: 'المرتب الاساسي',
  nature: 'بدل طبيعة عمل'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function kindOf(item: RetirementReviewEntryItem): 'earning' | 'deduction' {
  return item.kind === 'earning' ? 'earning' : 'deduction'
}

function sortedItems(entry: RetirementReviewEntry): RetirementReviewEntryItem[] {
  return entry.items
    .filter((item) => item.kind === 'earning' || item.kind === 'deduction')
    .sort(
      (a, b) =>
        (a.kind === 'earning' ? 0 : 1) - (b.kind === 'earning' ? 0 : 1) ||
        a.sortOrder - b.sortOrder
    )
}

function reviewItemKey(item: RetirementReviewEntryItem): string {
  const label = itemLabelKey(item.label).replace(/[^\w\u0600-\u06FF]+/g, '') || 'item'
  return `retirement-${item.kind}-${label}-${item.sortOrder}`
}

function classifySalaryItem(label: string): SalaryItemCategory | null {
  const key = itemLabelKey(label)
  if (key.includes('بدل') && key.includes('طبيع')) return 'nature'
  if (key.includes('اساسي')) return 'basic'
  return null
}

function sum(
  items: RetirementReviewItem[],
  kind: 'earning' | 'deduction',
  field: 'actual' | 'expected'
): number {
  return round2(
    items
      .filter((item) => !item.informational && item.kind === kind)
      .reduce((total, item) => total + (item[field] ?? 0), 0)
  )
}

function emptyTotals(): RetirementReviewTotals {
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

/** بناء مراجعة ظرف مرتب شهر المعاش. */
export function reviewRetirementSalary(params: {
  period: string
  retirementDate: string
  birthDateMissing: boolean
  basicSalary: number | null
  natureAllowancePct: number | null
  entry: RetirementReviewEntry | null
}): RetirementReviewSlip {
  const notes: RetirementReviewNoteKey[] = []
  const actualDays = params.birthDateMissing
    ? 0
    : retirementActualDays(params.retirementDate)
  const ratio = params.birthDateMissing ? 0 : retirementBaseRatio(actualDays)
  const distributedBasic = params.birthDateMissing
    ? null
    : distributedSalary(params.basicSalary, ratio)
  const expectedNature = params.birthDateMissing
    ? null
    : retirementNatureAllowance(distributedBasic, params.natureAllowancePct)

  if (params.birthDateMissing) notes.push('birthDateMissing')
  if (params.basicSalary === null) notes.push('basicMissing')
  if (params.natureAllowancePct === null) notes.push('natureAllowanceMissing')

  const expected: Record<SalaryItemCategory, number | null> = {
    basic: distributedBasic,
    nature: expectedNature
  }
  const items: RetirementReviewItem[] = []
  const found = new Set<SalaryItemCategory>()
  const entry = params.entry

  if (!entry) {
    notes.push('salarySlipMissing')
  } else {
    for (const item of sortedItems(entry)) {
      const category = classifySalaryItem(item.label)
      if (category) found.add(category)
      const expectedValue = category ? expected[category] : round2(item.value)
      items.push({
        key: reviewItemKey(item),
        label: item.label,
        kind: kindOf(item),
        actual: round2(item.value),
        expected: expectedValue,
        difference: expectedValue === null ? null : round2(item.value - expectedValue),
        informational: false
      })
    }
  }

  // بند متوقع غير موجود في الظرف: الفعلي صفر، والفرق سالب بمقدار المتوقع.
  for (const category of Object.keys(EXPECTED_LABELS) as SalaryItemCategory[]) {
    const expectedValue = expected[category]
    if (found.has(category) || expectedValue === null || expectedValue <= 0.005) continue
    items.push({
      key: `retirement-expected-${category}`,
      label: EXPECTED_LABELS[category],
      kind: 'earning',
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
      items,
      totals: {
        ...emptyTotals(),
        expectedEarnings:
          distributedBasic === null && expectedNature === null
            ? null
            : round2((distributedBasic ?? 0) + (expectedNature ?? 0))
      },
      notes
    }
  }

  const actualEarnings = sum(items, 'earning', 'actual')
  const expectedEarnings = sum(items, 'earning', 'expected')
  const actualDeductions = sum(items, 'deduction', 'actual')
  const expectedDeductions = sum(items, 'deduction', 'expected')
  const actualNet = entry.netSalary ?? round2(actualEarnings - actualDeductions)
  const expectedNet = round2(expectedEarnings - expectedDeductions)

  return {
    type: 'salary',
    period: params.period,
    available: true,
    fileName: entry.fileName,
    items,
    totals: {
      actualEarnings,
      expectedEarnings,
      actualDeductions,
      expectedDeductions,
      actualNet: round2(actualNet),
      expectedNet,
      difference: round2(actualNet - expectedNet)
    },
    notes
  }
}

/** معلومات إضافية تُعرض في رأس المراجعة (أيام/نسبة/موزع). */
export function retirementReviewMeta(params: {
  retirementDate: string
  birthDateMissing: boolean
  basicSalary: number | null
  natureAllowancePct: number | null
}): {
  actualDays: number
  monthDays: number
  ratio: number
  distributedBasic: number | null
  expectedNatureAllowance: number | null
} {
  const actualDays = params.birthDateMissing
    ? 0
    : retirementActualDays(params.retirementDate)
  const ratio = params.birthDateMissing ? 0 : retirementBaseRatio(actualDays)
  const distributedBasic = params.birthDateMissing
    ? null
    : distributedSalary(params.basicSalary, ratio)
  const expectedNatureAllowance = params.birthDateMissing
    ? null
    : retirementNatureAllowance(distributedBasic, params.natureAllowancePct)

  return {
    actualDays,
    monthDays: RETIREMENT_MONTH_DAYS,
    ratio,
    distributedBasic,
    expectedNatureAllowance
  }
}
