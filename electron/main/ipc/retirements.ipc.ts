/**
 * تقرير المعاشات (IPC): المحالون للمعاش والمؤهلون له، مع تاريخ كل منهم،
 * بفلتر سنة/شهر. المؤهلون هم من ما زال على قوة العمل وسيبلغ السن القانونية
 * (`RETIREABLE_EMPLOYEE_STATUSES`) — فيُعرف «من سيخرج في سنة كذا» مسبقًا.
 *
 * الحالة تُحدَّث قبل بناء التقرير حتى يظهر من بلغ السن القانونية اليوم بدل أن
 * ينتظر فتح شاشة الموظفين — `applyAutomaticRetirement` هي نفسها المستخدمة هناك.
 *
 * إضافة إلى التقرير، يوفر الملف **مراجعة المعاشات**: لكل صف، مرتب شهر المعاش
 * بالفعل من الظرف، والمتوقع من قواعد الأيام/الأساسي الموزع/بدل الطبيعة، مع
 * ملاحظات محفوظة لكل بند.
 */
import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { ApiError } from '../../../shared/types'
import type {
  RetirementReviewNoteInput,
  RetirementReviewNoteRecord,
  RetirementReviewQuery,
  RetirementReviewReport,
  RetirementReviewRow,
  RetirementRow,
  RetirementsQuery,
  RetirementsReport
} from '../../../shared/types'
import {
  RETIREABLE_EMPLOYEE_STATUSES,
  RETIRED_EMPLOYEE_STATUS
} from '../../../shared/employeeStatuses'
import { addMonths, periodEndDate } from '../../../shared/absenceRules'
import { requirePermission } from '../auth'
import { applyAutomaticRetirement } from '../employee-status'
import { buildRetirementsReport } from '../retirements'
import {
  retirementReviewMeta,
  reviewRetirementSalary,
  type RetirementReviewEntry
} from '../retirement-review'
import type { IpcRegistry } from './registry'

type EmployeeRow = {
  id: string
  code: string
  name: string
  birthDate: Date | null
  departmentId: string | null
  status: string
  grade: string | null
  department: { name: string } | null
  statusHistory: { changedAt: Date; changedBy: string | null; reason: string | null }[]
}

const EMPLOYEE_SELECT = {
  id: true,
  code: true,
  name: true,
  birthDate: true,
  departmentId: true,
  status: true,
  grade: true,
  department: { select: { name: true } },
  statusHistory: {
    where: { toStatus: RETIRED_EMPLOYEE_STATUS },
    orderBy: { changedAt: 'asc' },
    select: { changedAt: true, changedBy: true, reason: true }
  }
} as const

/** تحميل صفوف التقرير المشتركة بين العرض العادي ومراجعة المعاشات. */
export async function loadRetirementsReport(
  prisma: PrismaClient,
  query: RetirementsQuery = {}
): Promise<RetirementsReport> {
  await applyAutomaticRetirement(prisma)

  const [retired, eligible] = await Promise.all([
    prisma.employee.findMany({
      where: { status: RETIRED_EMPLOYEE_STATUS },
      orderBy: { code: 'asc' },
      select: EMPLOYEE_SELECT
    }),
    prisma.employee.findMany({
      where: { status: { in: [...RETIREABLE_EMPLOYEE_STATUSES] } },
      orderBy: { code: 'asc' },
      select: EMPLOYEE_SELECT
    })
  ])

  return buildRetirementsReport({
    query,
    employees: retired.map(toSourceRow),
    eligible: eligible.map(toSourceRow)
  })
}

function toSourceRow(employee: EmployeeRow) {
  return {
    id: employee.id,
    code: employee.code,
    name: employee.name,
    birthDate: employee.birthDate ? employee.birthDate.toISOString().slice(0, 10) : null,
    departmentId: employee.departmentId,
    departmentName: employee.department?.name ?? null,
    status: employee.status,
    grade: employee.grade ?? null,
    retiredHistory: employee.statusHistory.map((row) => ({
      changedAt: row.changedAt.toISOString(),
      changedBy: row.changedBy,
      reason: row.reason
    }))
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** المناصب القيادية التي يُحسب بدل-nature لها من القسم قبل الترقية. */
const EXECUTIVE_GRADES = new Set(['مدير عام', 'درجة عالية', 'درجة فوق الممتازة'])
const EXECUTIVE_DEPARTMENT_NAMES = new Set([
  'المدير التنفيذي',
  'الرئيس التنفيذي',
  'رئيس قطاع',
  'رؤساء قطاع',
  'رؤساء قطاعات',
  'مديرين عموم'
])

function isExecutiveGrade(grade: string | null, departmentName: string | null): boolean {
  return (
    (grade !== null && EXECUTIVE_GRADES.has(grade.trim())) ||
    (departmentName !== null && EXECUTIVE_DEPARTMENT_NAMES.has(departmentName.trim()))
  )
}

export function registerRetirementsIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('retirements:list', async (_event, query: RetirementsQuery = {}) => {
    requirePermission('reviews.view')
    return loadRetirementsReport(prisma, query)
  })

  /** مراجعة مستحقات شهر المعاش لكل صف مطابق للفلاتر الحالية. */
  ipc.handle(
    'retirements:review',
    async (_event, query: RetirementReviewQuery = {}): Promise<RetirementReviewReport> => {
      requirePermission('reviews.view')
      const report = await loadRetirementsReport(prisma, query)
      const datedRows = report.rows.filter(
        (row): row is RetirementRow & { retirementDate: string } => Boolean(row.retirementDate)
      )

      if (datedRows.length === 0) {
        return {
          view: report.view,
          rows: [],
          totals: {
            employees: 0,
            distributedBasic: 0,
            natureAllowance: 0,
            variance: 0
          }
        }
      }

      const employeeIds = datedRows.map((row) => row.employeeId)
      const periods = [...new Set(datedRows.map((row) => row.retirementDate.slice(0, 7)))]
      const previousPeriods = periods.map((period) => addMonths(period, -1))
      const departmentIds = [
        ...new Set(datedRows.map((row) => row.departmentId).filter((id): id is string => Boolean(id)))
      ]

      const [entries, grades, departments, transfers, notes] = await Promise.all([
        prisma.payrollEntry.findMany({
          where: {
            employeeId: { in: employeeIds },
            type: 'salary',
            period: { in: [...periods, ...previousPeriods] }
          },
          include: {
            items: true,
            batch: { select: { originalName: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.basicSalaryGrade.findMany({
          where: { employeeId: { in: employeeIds } },
          orderBy: { date: 'desc' }
        }),
        departmentIds.length === 0
          ? Promise.resolve([])
          : prisma.department.findMany({
              where: { id: { in: departmentIds } },
              select: { id: true, natureAllowancePct: true }
            }),
        prisma.departmentTransfer.findMany({
          where: { employeeId: { in: employeeIds }, fromDepartmentId: { not: null } },
          orderBy: [{ employeeId: 'asc' }, { fromDate: 'desc' }],
          select: {
            employeeId: true,
            fromDepartmentId: true,
            toDepartmentId: true,
            fromDate: true,
            fromDepartment: { select: { natureAllowancePct: true } }
          }
        }),
        prisma.$queryRawUnsafe<
          { employeeId: string; period: string; itemKey: string; note: string }[]
        >(
          'SELECT "employeeId", "period", "itemKey", "note" FROM "RetirementReviewNote"'
        )
      ])

      const employeeIdSet = new Set(employeeIds)
      const noteByKey = new Map(
        notes
          .filter((note) => employeeIdSet.has(note.employeeId))
          .map((note) => [
            `${note.employeeId}:${note.period}:${note.itemKey}`,
            note.note
          ])
      )
      const departmentPct = new Map(
        departments.map((department) => [department.id, department.natureAllowancePct])
      )

      // النسبة القيادية تؤخذ من القسم السابق في نقلة الموظف إلى قسمه القيادي،
      // لا من نسبة ثابتة قديمة أو فارغة على القسم القيادي نفسه.
      const transfersByEmployee = new Map<string, typeof transfers>()
      for (const t of transfers) {
        const employeeTransfers = transfersByEmployee.get(t.employeeId) ?? []
        employeeTransfers.push(t)
        transfersByEmployee.set(t.employeeId, employeeTransfers)
      }

      const entryByKey = new Map<string, RetirementReviewEntry>()
      for (const entry of entries) {
        const key = `${entry.employeeId}:${entry.period}`
        if (entryByKey.has(key)) continue
        entryByKey.set(key, {
          period: entry.period,
          basicSalary: entry.basicSalary,
          totalEarned: entry.totalEarned,
          totalDeductions: entry.totalDeductions,
          netSalary: entry.netSalary,
          fileName: entry.batch?.originalName ?? null,
          items: entry.items.map((item) => ({
            kind: item.kind,
            label: item.label,
            value: item.value,
            sortOrder: item.sortOrder
          }))
        })
      }

      const rows: RetirementReviewRow[] = datedRows.map((row) => {
        const retirementPeriod = row.retirementDate.slice(0, 7)
        const previousPeriod = addMonths(retirementPeriod, -1)
        const salaryEntry = entryByKey.get(`${row.employeeId}:${retirementPeriod}`) ?? null
        const previousEntry = entryByKey.get(`${row.employeeId}:${previousPeriod}`) ?? null
        const grade = grades.find(
          (item) =>
            item.employeeId === row.employeeId &&
            item.date < periodEndDate(retirementPeriod)
        )
        const birthDateMissing = !row.birthDate
        const meta = retirementReviewMeta({
          retirementDate: row.retirementDate,
          birthDateMissing,
          basicSalary: null,
          natureAllowancePct: departmentPct.get(row.departmentId ?? '') ?? null
        })
        const ratio = meta.ratio
        const derivedBasic =
          salaryEntry && salaryEntry.basicSalary !== null && ratio > 0
            ? salaryEntry.basicSalary / ratio
            : null
        const basicSalary =
          grade?.amount ??
          previousEntry?.basicSalary ??
          (derivedBasic === null ? null : round2(derivedBasic))
        const executive = isExecutiveGrade(row.grade, row.departmentName)
        const previousDepartmentTransfer = executive
          ? transfersByEmployee
              .get(row.employeeId)
              ?.find(
                (transfer) =>
                  transfer.toDepartmentId === row.departmentId &&
                  transfer.fromDepartmentId !== null &&
                  transfer.fromDate.toISOString().slice(0, 10) <= row.retirementDate
              )
          : undefined
        const natureAllowancePct = executive
          ? previousDepartmentTransfer?.fromDepartment?.natureAllowancePct ?? null
          : departmentPct.get(row.departmentId ?? '') ?? null
        const salary = reviewRetirementSalary({
          period: retirementPeriod,
          retirementDate: row.retirementDate,
          birthDateMissing,
          basicSalary,
          natureAllowancePct,
          entry: salaryEntry,
          previousEntry
        })

        for (const item of salary.items) {
          item.note = noteByKey.get(`${row.employeeId}:${retirementPeriod}:${item.key}`) ?? null
        }

        const finalMeta = retirementReviewMeta({
          retirementDate: row.retirementDate,
          birthDateMissing,
          basicSalary,
          natureAllowancePct
        })

        return {
          employeeId: row.employeeId,
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          departmentId: row.departmentId,
          departmentName: row.departmentName,
          birthDate: row.birthDate,
          retirementDate: row.retirementDate,
          retirementPeriod,
          actualDays: finalMeta.actualDays,
          monthDays: finalMeta.monthDays,
          ratio: finalMeta.ratio,
          natureAllowancePct,
          basicSalary,
          distributedBasic: finalMeta.distributedBasic,
          expectedNatureAllowance: finalMeta.expectedNatureAllowance,
          salary
        }
      })

      const totals = rows.reduce(
        (acc, row) => ({
          employees: acc.employees + 1,
          distributedBasic: acc.distributedBasic + (row.distributedBasic ?? 0),
          natureAllowance: acc.natureAllowance + (row.expectedNatureAllowance ?? 0),
          variance: acc.variance + (row.salary.totals.difference ?? 0)
        }),
        { employees: 0, distributedBasic: 0, natureAllowance: 0, variance: 0 }
      )

      return {
        view: report.view,
        rows,
        totals: {
          employees: totals.employees,
          distributedBasic: round2(totals.distributedBasic),
          natureAllowance: round2(totals.natureAllowance),
          variance: round2(totals.variance)
        }
      }
    }
  )

  /** حفظ/حذف ملاحظة على بند في مراجعة المعاشات. */
  ipc.handle(
    'retirements:review.saveNote',
    async (_event, input: RetirementReviewNoteInput): Promise<RetirementReviewNoteRecord | null> => {
      requirePermission('reviews.edit')
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) {
        throw new ApiError('VALIDATION', 'Invalid period')
      }

      const employeeId = input.employeeId?.trim()
      const itemKey = input.itemKey?.trim()
      if (!employeeId || !itemKey) {
        throw new ApiError('VALIDATION', 'Missing note target')
      }

      const note = input.note.trim()
      if (note.length > 2000) {
        throw new ApiError('VALIDATION', 'Note is too long')
      }

      if (!note) {
        await prisma.$executeRawUnsafe(
          'DELETE FROM "RetirementReviewNote" WHERE "employeeId" = ? AND "period" = ? AND "itemKey" = ?',
          employeeId,
          input.period,
          itemKey
        )
        return null
      }

      const label = input.label?.trim() || null
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "RetirementReviewNote"
           ("id", "employeeId", "period", "itemKey", "label", "note", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT("employeeId", "period", "itemKey")
         DO UPDATE SET "label" = excluded."label", "note" = excluded."note", "updatedAt" = CURRENT_TIMESTAMP
         RETURNING "id"`,
        randomUUID(),
        employeeId,
        input.period,
        itemKey,
        label,
        note
      )

      return {
        id: rows[0]?.id ?? randomUUID(),
        employeeId,
        period: input.period,
        itemKey,
        label,
        note,
        updatedAt: new Date().toISOString()
      }
    }
  )
}
