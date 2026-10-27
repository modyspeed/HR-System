/**
 * مراجعة بدل الطبيعة: مقارنة النسبة المصروفة فعلًا في ظرف المرتب
 * (بدل الطبيعة ÷ الأساسي × 100) بنسبة القسم المعتمد للموظف في الشهر نفسه.
 *
 * النسبة الفعلية لا تتأثر بشهر المعاش أو الأيام الجزئية لأن الأساسي والبدل
 * يُوزَّعان بالنسبة نفسها؛ فالمقارنة صالحة لأي ظرف مرتب.
 */
import type { NatureAllowanceRow, NatureAllowanceStatus } from '../../shared/types'
import { itemLabelKey } from './payroll-text'

/** هامش التقريب المقبول: نصف نقطة مئوية وجنيه واحد — فروق الكسور ليست اختلافًا. */
export const NATURE_PCT_TOLERANCE = 0.5
export const NATURE_AMOUNT_TOLERANCE = 1

/** المناصب القيادية التي يُحسب بدل الطبيعة لها من القسم السابق قبل الترقية. */
const EXECUTIVE_GRADES = new Set(['مدير عام', 'درجة عالية', 'درجة فوق الممتازة'])
const EXECUTIVE_DEPARTMENT_NAMES = new Set([
  'المدير التنفيذي',
  'الرئيس التنفيذي',
  'رئيس قطاع',
  'رؤساء قطاع',
  'رؤساء قطاعات',
  'مديرين عموم'
])

export function isExecutiveGrade(grade: string | null, departmentName: string | null): boolean {
  return (
    (grade !== null && EXECUTIVE_GRADES.has(grade.trim())) ||
    (departmentName !== null && EXECUTIVE_DEPARTMENT_NAMES.has(departmentName.trim()))
  )
}

/**
 * تعاقد بمكافأة شاملة («مكافأة شاملة» / «م شاملة» / «م.شاملة»): المكافأة
 * تشمل كل شيء فلا يستحق بدل طبيعة — النسبة المعتمدة له صفر.
 */
export function isLumpSumContract(contractType: string | null | undefined): boolean {
  if (!contractType) return false
  return itemLabelKey(contractType).includes('شامل')
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function isNatureAllowanceLabel(label: string): boolean {
  const key = itemLabelKey(label)
  return key.includes('بدل') && key.includes('طبيع')
}

export function isBasicSalaryLabel(label: string): boolean {
  return itemLabelKey(label).includes('اساسي')
}

export interface NatureSlipItem {
  kind: string
  label: string
  value: number
}

/** استخراج الأساسي وبدل الطبيعة من بنود الظرف (مع الرجوع لأساسي رأس الظرف). */
export function readNatureSlip(
  items: NatureSlipItem[],
  headerBasic: number | null
): { basic: number | null; allowance: number | null } {
  let basic: number | null = null
  let allowance: number | null = null
  for (const item of items) {
    if (item.kind !== 'earning') continue
    if (isNatureAllowanceLabel(item.label)) {
      allowance = (allowance ?? 0) + item.value
    } else if (isBasicSalaryLabel(item.label)) {
      basic = (basic ?? 0) + item.value
    }
  }
  return {
    basic: basic ?? headerBasic,
    allowance: allowance === null ? null : round2(allowance)
  }
}

export function classifyNatureAllowance(params: {
  basic: number | null
  allowance: number | null
  departmentPct: number | null
}): Pick<
  NatureAllowanceRow,
  'actualPct' | 'expectedAllowance' | 'difference' | 'pctDifference' | 'status'
> {
  const { basic, departmentPct } = params
  const allowance = params.allowance ?? 0
  const hasBasic = basic !== null && basic > 0
  const actualPct = hasBasic ? round2((allowance / basic) * 100) : null
  const expectedAllowance =
    hasBasic && departmentPct !== null ? round2((basic * departmentPct) / 100) : null
  const difference = expectedAllowance === null ? null : round2(allowance - expectedAllowance)
  const pctDifference =
    actualPct === null || departmentPct === null ? null : round2(actualPct - departmentPct)

  let status: NatureAllowanceStatus
  if (!hasBasic) {
    status = 'basicMissing'
  } else if (departmentPct === null) {
    status = 'departmentPctMissing'
  } else if (departmentPct <= 0 && allowance > NATURE_AMOUNT_TOLERANCE) {
    status = 'unexpected'
  } else if (departmentPct > 0 && allowance <= NATURE_AMOUNT_TOLERANCE) {
    status = 'noAllowance'
  } else if (
    pctDifference !== null &&
    difference !== null &&
    Math.abs(pctDifference) > NATURE_PCT_TOLERANCE &&
    Math.abs(difference) > NATURE_AMOUNT_TOLERANCE
  ) {
    status = 'mismatch'
  } else {
    status = 'match'
  }

  return { actualPct, expectedAllowance, difference, pctDifference, status }
}

/** الأقسام التي تطابق نسبتُها النسبةَ المصروفة — تلمّح إلى مصدر البدل الفعلي. */
export function matchingDepartments(
  actualPct: number | null,
  departments: { id: string; name: string; natureAllowancePct: number | null }[],
  excludeId: string | null
): string[] {
  if (actualPct === null || actualPct <= 0) return []
  return departments
    .filter(
      (department) =>
        department.id !== excludeId &&
        department.natureAllowancePct !== null &&
        department.natureAllowancePct > 0 &&
        Math.abs(department.natureAllowancePct - actualPct) <= NATURE_PCT_TOLERANCE
    )
    .map((department) => department.name)
    .slice(0, 3)
}
