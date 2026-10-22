/**
 * تقرير المعاشات: من أُحيل للمعاش، وتاريخ إحالته.
 *
 * **تاريخ المعاش** يُحسب من تاريخ الميلاد (بلوغ السن القانونية) لأنه التاريخ
 * الحقيقي للإحالة، ويصلح للتجميع بالشهر والسنة. أما تاريخ تسجيل الحالة في
 * السجل فهو وقت اكتشاف النظام للحالة — وقد يكون يومًا واحدًا لكل الموظفين
 * القدامى (أول تشغيل)، فلا يصلح للتجميع. لذلك:
 *   1) تاريخ الميلاد + السن القانونية (`retirementDateOf`)،
 *   2) وإذا غاب تاريخ الميلاد (إحالة يدوية بلا ميلاد): تاريخ تسجيل الحالة.
 *
 * المصدر (`auto` / `manual`) يُستنتج من منفّذ التغيير: التحويل التلقائي يسجّله
 * النظام (`SYSTEM_ACTOR`)، وأي منفّذ آخر يعني إحالة يدوية.
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
function toRetirementRow(source: RetirementSourceRow): RetirementRow {
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
    retirementDate,
    source: isAutomatic ? 'auto' : 'manual',
    changedBy: history?.changedBy ?? null,
    reason: history?.reason ?? null
  }
}

/**
 * يبني تقرير المعاشات من صفوف الموظفين.
 *
 * الأعداد المرجعية (السنوات/الشهور) تُحسب من **كل** المحالين قبل الفلتر حتى
 * تظل قوائم الاختيار ثابتة، ثم يُطبَّق فلتر السنة/الشهر والبحث والقسم.
 */
export function buildRetirementsReport(params: {
  employees: RetirementSourceRow[]
  query?: RetirementsQuery
}): RetirementsReport {
  const query = params.query ?? {}
  const allRows = params.employees.map(toRetirementRow)

  // السنوات والشهور من كل الإحالات التي لها تاريخ (بلا فلتر).
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
  const years = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year)

  const search = query.search?.trim().toLowerCase()
  const rows = allRows
    .filter((row) => {
      // فلتر السنة: من ليس له تاريخ معاش لا يظهر داخل سنة محددة.
      if (query.year !== undefined) {
        if (!row.retirementDate) return false
        const { year } = monthOf(row.retirementDate)
        if (year !== query.year) return false
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
      // الأحدث إحالة أولًا، ثم بالكود — ومن لا تاريخ له في الآخر.
      if (a.retirementDate && b.retirementDate && a.retirementDate !== b.retirementDate) {
        return b.retirementDate.localeCompare(a.retirementDate)
      }
      if (a.retirementDate && !b.retirementDate) return -1
      if (!a.retirementDate && b.retirementDate) return 1
      return a.employeeCode.localeCompare(b.employeeCode)
    })

  const filteredYears = new Set<number>()
  let latest: string | null = null
  for (const row of rows) {
    if (!row.retirementDate) continue
    filteredYears.add(monthOf(row.retirementDate).year)
    if (!latest || row.retirementDate > latest) latest = row.retirementDate
  }

  return {
    rows,
    years,
    periods,
    totals: {
      total: allRows.length,
      filtered: rows.length,
      years: filteredYears.size,
      latest
    }
  }
}
