/**
 * تقرير المعاشات: من أُحيل للمعاش، ومن سيُحال (المؤهلون)، وتاريخ كل منهما.
 *
 * **تاريخ المعاش** يُحسب من تاريخ الميلاد (بلوغ السن القانونية) لأنه التاريخ
 * الحقيقي للإحالة، ويصلح للتجميع بالشهر والسنة. أما تاريخ تسجيل الحالة في
 * السجل فهو وقت اكتشاف النظام للحالة — وقد يكون يومًا واحدًا لكل الموظفين
 * القدامى (أول تشغيل)، فلا يصلح للتجميع. لذلك:
 *   1) تاريخ الميلاد + السن القانونية (`retirementDateOf`)،
 *   2) وإذا غاب تاريخ الميلاد (إحالة يدوية بلا ميلاد): تاريخ تسجيل الحالة.
 *
 * **عرضان:**
 *   - `retired`: من أُحيل بالفعل (حالته `retired`) — المصدر auto أو manual.
 *   - `eligible`: من ما زال على قوة العمل وسيبلغ السن (متوقع) — يوم إحالته
 *     المتوقع، وحالته الحالية تُعرض بدل نوع الإحالة. هذا هو ما يجيب سؤال
 *     «من سيخرج في سنة كذا؟» قبل حدوثه.
 */
import type { RetirementPeriodCount, RetirementRow, RetirementsQuery, RetirementsReport } from '../../shared/types'
import { SYSTEM_ACTOR, retirementDateOf } from '../../shared/employeeStatuses'

/** الحد الأدنى من بيانات الموظف التي يحتاجها التقرير. */
export interface RetirementSourceRow {
  id: string
  code: string
  name: string
  /** تاريخ الميلاد (yyyy-mm-dd) — كما تُخزَّن بقية التواريخ في التطبيق. */
  birthDate: string | null
  departmentId: string | null
  departmentName: string | null
  /** الحالة الوظيفية الحالية. */
  status: string
  /** الدرجة الوظيفية (للتمييز بين المناصب القيادية). */
  grade: string | null
  /** إحالات المعاش المسجَّلة في السجل، الأقدم أولًا. */
  retiredHistory: {
    changedAt: string
    changedBy: string | null
    reason: string | null
  }[]
}

function monthOf(isoDate: string): { year: number; month: number; period: string } {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  return { year, month, period: isoDate.slice(0, 7) }
}

/** يحوّل صف الموظف إلى صف تقرير بتاريخ معاش محدَّد. */
function toRetirementRow(source: RetirementSourceRow, view: 'retired' | 'eligible'): RetirementRow {
  const history = source.retiredHistory[0] ?? null
  // التاريخ القانوني أدق وأصلح للتجميع؛ تاريخ السجل بديل عند غياب الميلاد.
  const legalDate = retirementDateOf(source.birthDate)
  const recordedAt = history ? history.changedAt.slice(0, 10) : null
  const retirementDate = legalDate ?? recordedAt
  const isAutomatic = history?.changedBy === SYSTEM_ACTOR

  return {
    employeeId: source.id,
    employeeCode: source.code,
    employeeName: source.name,
    departmentId: source.departmentId,
    departmentName: source.departmentName,
    birthDate: source.birthDate,
    grade: source.grade ?? null,
    retirementDate,
    // المؤهل لم يُحل بعد، فلا مصدر إحالة له.
    source: view === 'eligible' ? 'expected' : isAutomatic ? 'auto' : 'manual',
    employeeStatus: source.status,
    changedBy: history?.changedBy ?? null,
    reason: history?.reason ?? null
  }
}

/**
 * يبني تقرير المعاشات من صفوف الموظفين، للعرض المطلوب فقط.
 *
 * الأعداد المرجعية (السنوات/الشهور) تُحسب من **كل** صفوف العرض قبل الفلتر حتى
 * تظل قوائم الاختيار ثابتة، ثم يُطبَّق فلتر السنة/الشهر والبحث والقسم.
 */
export function buildRetirementsReport(params: {
  /** المحالون للمعاش بالفعل. */
  employees: RetirementSourceRow[]
  /** المؤهلون للمعاش (ما زالوا على قوة العمل). */
  eligible: RetirementSourceRow[]
  query?: RetirementsQuery
}): RetirementsReport {
  const query = params.query ?? {}
  const view = query.view === 'eligible' ? 'eligible' : 'retired'
  const sources = view === 'eligible' ? params.eligible : params.employees

  const allRows = sources
    .map((source) => toRetirementRow(source, view))
    // من لا تاريخ ميلاد له ولا سجل لا يمكن تحديد سنة إحالته — لا يدخل العرضين.
    .filter((row) => row.retirementDate !== null)

  // السنوات والشهور من كل صفوف العرض (بلا فلتر).
  const periodCounts = new Map<string, RetirementPeriodCount>()
  for (const row of allRows) {
    if (!row.retirementDate) continue
    const { year, month, period } = monthOf(row.retirementDate)
    const existing = periodCounts.get(period)
    if (existing) existing.count += 1
    else periodCounts.set(period, { period, year, month, count: 1 })
  }

  const periods = [...periodCounts.values()].sort((a, b) => b.period.localeCompare(a.period))
  const yearCounts = new Map<number, number>()
  for (const entry of periods) {
    yearCounts.set(entry.year, (yearCounts.get(entry.year) ?? 0) + entry.count)
  }
  // المحالون: الأحدث أولًا. المؤهلون: الأقرب أولًا (الأهم للتخطيط).
  const years = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => (view === 'eligible' ? a.year - b.year : b.year - a.year))

  const search = query.search?.trim().toLowerCase()
  const rows = allRows
    .filter((row) => {
      // فلتر السنة/الشهر: لا صف بلا تاريخ داخل سنة محددة.
      if (query.year !== undefined) {
        if (!row.retirementDate) return false
        if (monthOf(row.retirementDate).year !== query.year) return false
      }
      if (query.month !== undefined) {
        if (!row.retirementDate) return false
        if (monthOf(row.retirementDate).month !== query.month) return false
      }
      if (query.departmentId && row.departmentId !== query.departmentId) return false
      if (search) {
        const haystack = `${row.employeeCode} ${row.employeeName}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
    .sort((a, b) => {
      // المؤهلون: الأقرب أولًا. المحالون: الأحدث أولًا.
      if (a.retirementDate && b.retirementDate && a.retirementDate !== b.retirementDate) {
        return view === 'eligible'
          ? a.retirementDate.localeCompare(b.retirementDate)
          : b.retirementDate.localeCompare(a.retirementDate)
      }
      return a.employeeCode.localeCompare(b.employeeCode)
    })

  const filteredYears = new Set<number>()
  let latest: string | null = null
  let earliest: string | null = null
  for (const row of rows) {
    if (!row.retirementDate) continue
    filteredYears.add(monthOf(row.retirementDate).year)
    if (!latest || row.retirementDate > latest) latest = row.retirementDate
    if (!earliest || row.retirementDate < earliest) earliest = row.retirementDate
  }

  return {
    view,
    rows,
    years,
    periods,
    totals: {
      total: allRows.length,
      filtered: rows.length,
      years: filteredYears.size,
      latest,
      earliest
    }
  }
}
