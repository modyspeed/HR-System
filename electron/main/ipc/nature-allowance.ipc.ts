/**
 * مراجعة بدل الطبيعة (IPC): لكل موظف له ظرف مرتب في الشهر المختار، تُقارن
 * نسبة بدل الطبيعة المصروفة بنسبة قسمه — فيظهر من يأخذ بدلًا مختلفًا عن قسمه.
 *
 * القسم المعتمد هو القسم المستدل عليه من نص الظرف نفسه (قسم ذلك الشهر)، وإن
 * غاب فقسم الموظف الحالي. المناصب القيادية تأخذ نسبة القسم السابق للترقية.
 */
import type { PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type {
  NatureAllowanceQuery,
  NatureAllowanceReport,
  NatureAllowanceRow
} from '../../../shared/types'
import { requirePermission } from '../auth'
import {
  classifyNatureAllowance,
  isExecutiveGrade,
  isLumpSumContract,
  matchingDepartments,
  readNatureSlip,
  round2
} from '../nature-allowance'
import type { IpcRegistry } from './registry'

export function registerNatureAllowanceIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle(
    'natureAllowance:list',
    async (_event, query: NatureAllowanceQuery = {}): Promise<NatureAllowanceReport> => {
      requirePermission('reviews.view')
      if (query.period && !/^\d{4}-\d{2}$/.test(query.period)) {
        throw new ApiError('VALIDATION', 'Invalid period')
      }

      const batches = await prisma.payrollBatch.findMany({
        where: { type: 'salary' },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        select: { period: true }
      })
      const periods = [...new Set(batches.map((batch) => batch.period))]
      const period =
        query.period && periods.includes(query.period) ? query.period : (periods[0] ?? null)

      if (!period) {
        return { period: null, periods, rows: [], totals: emptyTotals() }
      }

      const [entries, departments] = await Promise.all([
        prisma.payrollEntry.findMany({
          where: { type: 'salary', period },
          orderBy: { createdAt: 'desc' },
          select: {
            employeeId: true,
            departmentId: true,
            basicSalary: true,
            items: { select: { kind: true, label: true, value: true } },
            employee: {
              select: {
                code: true,
                name: true,
                grade: true,
                contractType: true,
                contractTypeRef: { select: { name: true } },
                departmentId: true,
                department: { select: { name: true } }
              }
            }
          }
        }),
        prisma.department.findMany({
          select: { id: true, name: true, natureAllowancePct: true }
        })
      ])

      const departmentById = new Map(departments.map((department) => [department.id, department]))

      // ظرف واحد لكل موظف — الأحدث رفعًا إن تكرر الكشف لنفس الشهر.
      const latestEntries = new Map<string, (typeof entries)[number]>()
      for (const entry of entries) {
        if (!latestEntries.has(entry.employeeId)) latestEntries.set(entry.employeeId, entry)
      }

      const executiveIds = [...latestEntries.values()]
        .filter((entry) => {
          const departmentId = entry.departmentId ?? entry.employee.departmentId
          const departmentName = departmentId ? departmentById.get(departmentId)?.name ?? null : null
          return isExecutiveGrade(entry.employee.grade, departmentName)
        })
        .map((entry) => entry.employeeId)

      const transfers =
        executiveIds.length === 0
          ? []
          : await prisma.departmentTransfer.findMany({
              where: { employeeId: { in: executiveIds }, fromDepartmentId: { not: null } },
              orderBy: [{ employeeId: 'asc' }, { fromDate: 'desc' }],
              select: { employeeId: true, fromDepartmentId: true, toDepartmentId: true }
            })

      const allRows: NatureAllowanceRow[] = [...latestEntries.values()].map((entry) => {
        const departmentId = entry.departmentId ?? entry.employee.departmentId
        const department = departmentId ? departmentById.get(departmentId) ?? null : null
        const executive = isExecutiveGrade(entry.employee.grade, department?.name ?? null)

        let pctSourceId = department?.id ?? null
        if (executive) {
          const promotion = transfers.find(
            (transfer) =>
              transfer.employeeId === entry.employeeId && transfer.toDepartmentId === departmentId
          )
          pctSourceId = promotion?.fromDepartmentId ?? null
        }
        const pctSource = pctSourceId ? departmentById.get(pctSourceId) ?? null : null
        const lumpSum = isLumpSumContract(
          entry.employee.contractTypeRef?.name ?? entry.employee.contractType
        )
        // المكافأة الشاملة لا تستحق بدل طبيعة أيًّا كان القسم: النسبة المعتمدة صفر.
        const departmentPct = lumpSum ? 0 : (pctSource?.natureAllowancePct ?? null)

        const slip = readNatureSlip(entry.items, entry.basicSalary)
        const classified = classifyNatureAllowance({
          basic: slip.basic,
          allowance: slip.allowance,
          departmentPct
        })
        const result =
          lumpSum && (classified.status === 'match' || classified.status === 'basicMissing')
            ? { ...classified, status: 'lumpSumExempt' as const }
            : classified

        return {
          employeeId: entry.employeeId,
          employeeCode: entry.employee.code,
          employeeName: entry.employee.name,
          departmentId: department?.id ?? null,
          departmentName: department?.name ?? entry.employee.department?.name ?? null,
          executive,
          pctSourceDepartmentName: executive ? (pctSource?.name ?? null) : null,
          lumpSum,
          basicSalary: slip.basic === null ? null : round2(slip.basic),
          allowance: slip.allowance,
          departmentPct,
          ...result,
          matchedDepartments:
            result.status === 'match' || result.status === 'lumpSumExempt'
              ? []
              : matchingDepartments(result.actualPct, departments, pctSourceId)
        }
      })

      allRows.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, 'en', { numeric: true }))

      const search = query.search?.trim().toLowerCase() ?? ''
      const filteredByScope = allRows.filter((row) => {
        if (query.departmentId && row.departmentId !== query.departmentId) return false
        if (!search) return true
        return (
          row.employeeCode.toLowerCase().includes(search) ||
          row.employeeName.toLowerCase().includes(search)
        )
      })

      const flagged = filteredByScope.filter(
        (row) => row.status !== 'match' && row.status !== 'lumpSumExempt'
      )
      // الزيادة/النقص بنفس تعريف بطاقات الإجمالي حتى يطابق عدد الصفوف المبلغ المعروض.
      const overpaidRows = flagged.filter((row) => (row.difference ?? 0) > 0)
      const underpaidRows = flagged.filter((row) => (row.difference ?? 0) < 0)

      const byDifference = (a: NatureAllowanceRow, b: NatureAllowanceRow) =>
        Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0)
      const rows =
        query.view === 'all'
          ? filteredByScope
          : query.view === 'overpaid'
            ? [...overpaidRows].sort(byDifference)
            : query.view === 'underpaid'
              ? [...underpaidRows].sort(byDifference)
              : [...flagged].sort(byDifference)

      return {
        period,
        periods,
        rows,
        totals: {
          total: allRows.length,
          scoped: filteredByScope.length,
          flagged: flagged.length,
          overpaid: round2(overpaidRows.reduce((sum, row) => sum + (row.difference ?? 0), 0)),
          underpaid: round2(underpaidRows.reduce((sum, row) => sum + (row.difference ?? 0), 0)),
          pctMissing: filteredByScope.filter((row) => row.status === 'departmentPctMissing').length,
          overpaidCount: overpaidRows.length,
          underpaidCount: underpaidRows.length,
          lumpSum: filteredByScope.filter((row) => row.lumpSum).length
        }
      }
    }
  )
}

function emptyTotals(): NatureAllowanceReport['totals'] {
  return {
    total: 0,
    scoped: 0,
    flagged: 0,
    overpaid: 0,
    underpaid: 0,
    pctMissing: 0,
    overpaidCount: 0,
    underpaidCount: 0,
    lumpSum: 0
  }
}
