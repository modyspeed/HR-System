/**
 * مفردات الأظرف (مرتب/حافز): مصفوفة تقاطع بين الموظفين والبنود.
 *
 * كل ظرف يُخزَّن مرة واحدة عند الاستيراد (PayrollItem)؛ وعند العرض تُبنى
 * الأعمدة من مجموعة بنود الشهر (بند واحد ⇒ عمود واحد) والصفوف من أظرف
 * الموظفين، فتظهر المصفوفة بترتيب ثابت لكل شهر.
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type {
  AbsenceReviewNoteInput,
  AbsenceReviewNoteRecord,
  AbsenceReviewQuery,
  AbsenceReviewReport,
  AbsenceReviewRow,
  AbsencesQuery,
  PayrollItemsPeriod,
  PayrollItemsQuery
} from '../../../shared/types'
import { nextPeriod, periodEndDate } from '../../../shared/absenceRules'
import { requirePermission } from '../auth'
import {
  buildAbsencesReport,
  buildItemsMatrix,
  extractPayrollItems
} from '../payroll-items'
import { applyAbsenceDays, scanBatchAbsences } from '../payroll-absences'
import {
  reviewIncentive,
  reviewSalary,
  type ReviewEntry
} from '../payroll-review'
import { resolvePayrollStoredPath } from '../payroll-files'
import { randomUUID } from 'crypto'
import fs from 'fs'
import type { IpcRegistry } from './registry'

const ENTRY_INCLUDE = {
  employee: { select: { code: true, name: true, department: { select: { name: true } } } },
  department: { select: { name: true } },
  items: true
} as const

type EntryRow = Prisma.PayrollEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>

const ABSENCE_INCLUDE = {
  ...ENTRY_INCLUDE,
  items: false
} as const

type AbsenceEntryRow = Prisma.PayrollEntryGetPayload<{ include: typeof ABSENCE_INCLUDE }>

function assertType(type: string): void {
  if (type !== 'salary' && type !== 'incentive' && type !== 'other') {
    throw new ApiError('VALIDATION', 'Invalid payroll type')
  }
}

function assertPeriod(period: string): void {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new ApiError('VALIDATION', 'Period must use the yyyy-mm format')
  }
}

async function listPeriods(prisma: PrismaClient, type?: string): Promise<PayrollItemsPeriod[]> {
  const where: Prisma.PayrollBatchWhereInput = {}
  if (type) where.type = type

  const batches = await prisma.payrollBatch.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {
      entries: {
        select: { id: true, _count: { select: { items: true } } }
      }
    }
  })

  return batches.map((batch) => ({
    period: batch.period,
    month: batch.month,
    year: batch.year,
    type: batch.type,
    fileName: batch.originalName,
    entries: batch.entries.length,
    extracted: batch.entries.filter((entry) => entry._count.items > 0).length
  }))
}

/**
 * يستخرج المفردات من ملف الكشف المخزَّن ويعيد بناءها لكل ظرف.
 * يُستدعى بعد استيراد كشف جديد، أو لإعادة بناء المفردات لفاترة قديمة.
 */
export async function syncBatchItems(
  prisma: PrismaClient,
  batchId: string
): Promise<{ entries: number; items: number; absences: number }> {
  const batch = await prisma.payrollBatch.findUnique({
    where: { id: batchId },
    include: { entries: { select: { id: true, page: true } } }
  })
  if (!batch) throw new ApiError('NOT_FOUND', 'Payroll batch not found')

  const filePath = resolvePayrollStoredPath(batch.storedName)
  if (!fs.existsSync(filePath)) {
    throw new ApiError('NOT_FOUND', 'The payroll file is missing from the archive')
  }

  const { byPage, absencesByPage } = await extractPayrollItems(fs.readFileSync(filePath))
  const byPageNumber = new Map(batch.entries.map((entry) => [entry.page, entry.id]))

  const rows: {
    entryId: string
    kind: string
    label: string
    labelKey: string
    value: number
    balance: number | null
    sortOrder: number
  }[] = []
  let total = 0
  for (const [page, items] of byPage) {
    const entryId = byPageNumber.get(page)
    if (!entryId || items.length === 0) continue
    for (const item of items) {
      rows.push({
        entryId,
        kind: item.kind,
        label: item.label,
        labelKey: item.labelKey,
        value: item.value,
        balance: item.balance,
        sortOrder: item.sortOrder
      })
    }
    total += items.length
  }

  const entryIds = batch.entries.map((entry) => entry.id)
  if (entryIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.payrollItem.deleteMany({ where: { entryId: { in: entryIds } } })
      if (rows.length > 0) await tx.payrollItem.createMany({ data: rows })
    })
  }

  const absences = await applyAbsenceDays(prisma, batch.entries, absencesByPage)
  await prisma.payrollBatch.update({ where: { id: batch.id }, data: { absencesScanned: true } })

  return { entries: byPage.size, items: total, absences }
}

export function registerPayrollItemsIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('payrolls:items.periods', async (_event, query: { type?: string } = {}) => {
    requirePermission('payrolls.view')
    return listPeriods(prisma, query.type)
  })

  ipc.handle('payrolls:items.list', async (_event, query: PayrollItemsQuery) => {
    requirePermission('payrolls.view')
    assertType(query.type)
    assertPeriod(query.period)

    const where: Prisma.PayrollEntryWhereInput = { type: query.type, period: query.period }
    const search = query.search?.trim()
    if (search) {
      where.OR = [
        { employee: { code: { contains: search } } },
        { employee: { name: { contains: search } } }
      ]
    }
    if (query.departmentId) where.departmentId = query.departmentId

    const filtered = await prisma.payrollEntry.findMany({
      where,
      include: { ...ENTRY_INCLUDE, items: true },
      orderBy: { employee: { code: 'asc' } }
    })

    const batch = await prisma.payrollBatch.findFirst({
      where: { type: query.type, period: query.period },
      orderBy: { uploadedAt: 'desc' }
    })

    return buildItemsMatrix({
      type: query.type,
      period: query.period,
      month: batch?.month ?? Number(query.period.split('-')[1]),
      year: batch?.year ?? Number(query.period.split('-')[0]),
      fileName: batch?.originalName ?? null,
      entries: filtered.map((entry: EntryRow) => ({
        id: entry.id,
        employeeId: entry.employeeId,
        employeeCode: entry.employee.code,
        employeeName: entry.employee.name,
        departmentName: entry.department?.name ?? entry.employee.department?.name ?? null,
        totalEarned: entry.totalEarned,
        totalDeductions: entry.totalDeductions,
        netSalary: entry.netSalary,
        items: entry.items
      }))
    })
  })

  ipc.handle(
    'payrolls:items.sync',
    async (_event, query: { type: string; period: string }) => {
      requirePermission('payrolls.create')
      assertType(query.type)
      assertPeriod(query.period)

      const batches = await prisma.payrollBatch.findMany({
        where: { type: query.type, period: query.period }
      })
      if (batches.length === 0) {
        throw new ApiError('NOT_FOUND', 'No payroll file for this month')
      }

      let entries = 0
      let items = 0
      for (const batch of batches) {
        const result = await syncBatchItems(prisma, batch.id)
        entries += result.entries
        items += result.items
      }

      return { entries, items, periods: await listPeriods(prisma, query.type) }
    }
  )

  ipc.handle('payrolls:items.absences', async (_event, query: AbsencesQuery) => {
    requirePermission('payrolls.view')
    assertPeriod(query.period)

    // الأيام تُقرأ من رأس ظرف الحافز؛ فهي مُخزَّنة على الظرف نفسه.
    const where: Prisma.PayrollEntryWhereInput = { period: query.period }
    const search = query.search?.trim()
    if (search) {
      where.OR = [
        { employee: { code: { contains: search } } },
        { employee: { name: { contains: search } } }
      ]
    }
    if (query.departmentId) where.departmentId = query.departmentId

    const entries = await prisma.payrollEntry.findMany({
      where,
      include: ABSENCE_INCLUDE,
      orderBy: { employee: { code: 'asc' } }
    })

    const batches = await prisma.payrollBatch.findMany({
      where: { period: query.period },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        storedName: true,
        month: true,
        year: true,
        type: true,
        absencesScanned: true
      }
    })

    // حالة الفحص: إمّا فُحص كل كشف في الشهر (فالتقرير حقيقي) أو بقي كشف
    // واحد لم يُفحص (فالتقرير ناقص لا فارغ). تُعرض للمستخدم كما هي.
    const scannedBatches = batches.filter((batch) => batch.absencesScanned).length
    const missingFiles = batches
      .filter((batch) => !fs.existsSync(resolvePayrollStoredPath(batch.storedName)))
      .map((batch) => batch.originalName)

    return buildAbsencesReport({
      period: query.period,
      month: batches[0]?.month ?? Number(query.period.split('-')[1]),
      year: batches[0]?.year ?? Number(query.period.split('-')[0]),
      fileNames: [...new Set(batches.map((batch) => batch.originalName))],
      slipTypes: [...new Set(batches.map((batch) => batch.type))],
      scannedBatches,
      totalBatches: batches.length,
      missingFiles,
      entries: entries.map((entry: AbsenceEntryRow) => ({
        employeeId: entry.employeeId,
        employeeCode: entry.employee.code,
        employeeName: entry.employee.name,
        departmentName: entry.department?.name ?? entry.employee.department?.name ?? null,
        withPermissionDays: entry.absenceWithPermissionDays,
        withoutPermissionDays: entry.absenceWithoutPermissionDays
      }))
    })
  })

  /**
   * مراجعة أثر الغياب: لكل موظف غائب في شهر الحافز، تُعاد مراجعة:
   *   - حافز الشهر نفسه (الفعلي من ظرف الحافز).
   *   - مرتب الشهر التالي (الفعلي من ظرف المرتب).
   * مع حساب المتوقع من الأساسي/الحافز على أساس 30 يومًا وقواعد الغياب.
   */
  ipc.handle(
    'payrolls:items.absenceReview',
    async (_event, query: AbsenceReviewQuery): Promise<AbsenceReviewReport> => {
      requirePermission('payrolls.view')
      assertPeriod(query.period)

      const period = query.period
      const salaryPeriod = nextPeriod(period)
      const [year, month] = period.split('-').map(Number)

      const where: Prisma.PayrollEntryWhereInput = { period }
      const search = query.search?.trim()
      if (search) {
        where.OR = [
          { employee: { code: { contains: search } } },
          { employee: { name: { contains: search } } }
        ]
      }
      if (query.departmentId) where.departmentId = query.departmentId

      const periodEntries = await prisma.payrollEntry.findMany({
        where,
        include: ABSENCE_INCLUDE,
        orderBy: { employee: { code: 'asc' } }
      })

      const report = buildAbsencesReport({
        period,
        month,
        year,
        fileNames: [],
        slipTypes: [],
        scannedBatches: 0,
        totalBatches: 0,
        missingFiles: [],
        entries: periodEntries.map((entry: AbsenceEntryRow) => ({
          employeeId: entry.employeeId,
          employeeCode: entry.employee.code,
          employeeName: entry.employee.name,
          departmentName: entry.department?.name ?? entry.employee.department?.name ?? null,
          withPermissionDays: entry.absenceWithPermissionDays,
          withoutPermissionDays: entry.absenceWithoutPermissionDays
        }))
      })

      if (report.rows.length === 0) {
        return {
          period,
          month,
          year,
          salaryPeriod,
          rows: [],
          totals: {
            employees: 0,
            salaryExpectedDeductions: 0,
            incentiveExpectedDeductions: 0,
            salaryVariance: 0,
            incentiveVariance: 0
          }
        }
      }

      const employeeIds = report.rows.map((row) => row.employeeId)
      const [entries, employees, grades, employeeRates, departmentRates] = await Promise.all([
        prisma.payrollEntry.findMany({
          where: {
            employeeId: { in: employeeIds },
            OR: [
              { type: 'incentive', period },
              { type: 'salary', period: salaryPeriod }
            ]
          },
          include: {
            items: true,
            batch: { select: { originalName: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, departmentId: true }
        }),
        prisma.basicSalaryGrade.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: { lt: periodEndDate(salaryPeriod) }
          },
          orderBy: { date: 'desc' }
        }),
        prisma.employeeIncentiveRate.findMany({
          where: { employeeId: { in: employeeIds }, period: { lte: period } },
          orderBy: { period: 'desc' }
        }),
        prisma.departmentIncentiveRate.findMany({
          where: { period: { lte: period } },
          orderBy: { period: 'desc' }
        })
      ])

      const penalties = await prisma.employeeIncentivePenalty.findMany({
        where: { employeeId: { in: employeeIds }, period }
      })
      const penaltyByEmployee = new Map<string, { rate: number | null; amount: number }>()
      for (const penalty of penalties) {
        const existing = penaltyByEmployee.get(penalty.employeeId)
        const amount = penalty.amount ?? 0
        if (!existing) {
          penaltyByEmployee.set(penalty.employeeId, { rate: penalty.rate ?? null, amount })
        } else {
          existing.amount = Math.round((existing.amount + amount) * 100) / 100
          if (existing.rate === null && penalty.rate !== null) existing.rate = penalty.rate
        }
      }

      const employeeDepartment = new Map(
        employees.map((employee) => [employee.id, employee.departmentId])
      )
      const latestGrade = new Map<string, number>()
      for (const grade of grades) {
        if (!latestGrade.has(grade.employeeId)) latestGrade.set(grade.employeeId, grade.amount)
      }

      const entryByKey = new Map<string, ReviewEntry>()
      for (const entry of entries) {
        const key = `${entry.employeeId}:${entry.type}`
        if (entryByKey.has(key)) continue
        entryByKey.set(key, {
          period: entry.period,
          type: entry.type,
          departmentId: entry.departmentId,
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

      const resolveRate = (
        employeeId: string,
        departmentId: string | null
      ): { rate: number | null; source: 'employee' | 'department' | null } => {
        const employeeExact = employeeRates.find(
          (rate) => rate.employeeId === employeeId && rate.period === period
        )
        if (employeeExact) return { rate: employeeExact.rate, source: 'employee' }

        const departmentExact =
          departmentId === null
            ? undefined
            : departmentRates.find(
                (rate) => rate.departmentId === departmentId && rate.period === period
              )
        if (departmentExact) return { rate: departmentExact.rate, source: 'department' }

        // الغياب لا يغيّر نسبة الحافز؛ عند غياب نسبة الشهر نستعمل آخر نسبة
        // قسم معتمدة، ثم آخر نسبة فردية كحل أخير.
        const departmentLatest =
          departmentId === null
            ? undefined
            : departmentRates.find((rate) => rate.departmentId === departmentId)
        if (departmentLatest) {
          return { rate: departmentLatest.rate, source: 'department' }
        }

        const employeeLatest = employeeRates.find((rate) => rate.employeeId === employeeId)
        if (employeeLatest) return { rate: employeeLatest.rate, source: 'employee' }

        return { rate: null, source: null }
      }

      const rows: AbsenceReviewRow[] = report.rows.map((row) => {
        const salaryEntry = entryByKey.get(`${row.employeeId}:salary`) ?? null
        const incentiveEntry = entryByKey.get(`${row.employeeId}:incentive`) ?? null
        const departmentId =
          salaryEntry?.departmentId ??
          incentiveEntry?.departmentId ??
          employeeDepartment.get(row.employeeId) ??
          null
        const basicSalary =
          salaryEntry?.basicSalary ??
          incentiveEntry?.basicSalary ??
          latestGrade.get(row.employeeId) ??
          null
        const { rate, source } = resolveRate(row.employeeId, departmentId)

        return {
          employeeId: row.employeeId,
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          departmentName: row.departmentName,
          basicSalary,
          totalEarned: salaryEntry?.totalEarned ?? null,
          withPermission: row.withPermission,
          withoutPermission: row.withoutPermission,
          total: row.total,
          salary: reviewSalary({
            period: salaryPeriod,
            basicSalary,
            withPermission: row.withPermission,
            withoutPermission: row.withoutPermission,
            entry: salaryEntry
          }),
          incentive: reviewIncentive({
            period,
            basicSalary,
            rate,
            rateSource: source,
            withPermission: row.withPermission,
            withoutPermission: row.withoutPermission,
            entry: incentiveEntry,
            penalty: penaltyByEmployee.get(row.employeeId) ?? null
          })
        }
      })

      const incentiveAbsenceExpected = rows.reduce((total, row) => {
        return (
          total +
          row.incentive.items
            .filter((item) => item.informational && item.kind === 'deduction')
            .reduce((sum, item) => sum + (item.expected ?? 0), 0)
        )
      }, 0)

      // ملاحظات المراجعة تُقرأ بـ SQL مباشر حتى تعمل حتى قبل إعادة توليد
      // عميل Prisma على جهاز التشغيل (العميل القديم لا يعرف الجدول الجديد).
      const employeeIdSet = new Set(employeeIds)
      const reviewNotes = await prisma.$queryRawUnsafe<
        { employeeId: string; slipType: string; itemKey: string; note: string }[]
      >(
        'SELECT "employeeId", "slipType", "itemKey", "note" FROM "AbsenceReviewNote" WHERE "period" = ?',
        period
      )
      const noteByKey = new Map(
        reviewNotes
          .filter((note) => employeeIdSet.has(note.employeeId))
          .map((note) => [
            `${note.employeeId}:${note.slipType}:${note.itemKey}`,
            note.note
          ])
      )
      for (const row of rows) {
        for (const item of row.salary.items) {
          item.note = noteByKey.get(`${row.employeeId}:salary:${item.key}`) ?? null
        }
        for (const item of row.incentive.items) {
          item.note = noteByKey.get(`${row.employeeId}:incentive:${item.key}`) ?? null
        }
      }

      return {
        period,
        month,
        year,
        salaryPeriod,
        rows,
        totals: {
          employees: rows.length,
          salaryExpectedDeductions:
            Math.round(
              rows.reduce(
                (total, row) => total + (row.salary.totals.expectedDeductions ?? 0),
                0
              ) * 100
            ) / 100,
          incentiveExpectedDeductions: Math.round(incentiveAbsenceExpected * 100) / 100,
          salaryVariance:
            Math.round(
              rows.reduce((total, row) => total + (row.salary.totals.difference ?? 0), 0) * 100
            ) / 100,
          incentiveVariance:
            Math.round(
              rows.reduce((total, row) => total + (row.incentive.totals.difference ?? 0), 0) * 100
            ) / 100
        }
      }
    }
  )

  /** حفظ/حذف ملاحظة على بند واحد — نص فارغ يعني حذف الملاحظة. */
  ipc.handle(
    'payrolls:items.absenceReview.saveNote',
    async (_event, input: AbsenceReviewNoteInput): Promise<AbsenceReviewNoteRecord | null> => {
      requirePermission('reviews.edit')
      assertPeriod(input.period)
      if (input.slipType !== 'salary' && input.slipType !== 'incentive') {
        throw new ApiError('VALIDATION', 'Invalid slip type')
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
          'DELETE FROM "AbsenceReviewNote" WHERE "employeeId" = ? AND "period" = ? AND "slipType" = ? AND "itemKey" = ?',
          employeeId,
          input.period,
          input.slipType,
          itemKey
        )
        return null
      }

      const label = input.label?.trim() || null
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "AbsenceReviewNote"
           ("id", "employeeId", "period", "slipType", "itemKey", "label", "note", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT("employeeId", "period", "slipType", "itemKey")
         DO UPDATE SET "label" = excluded."label", "note" = excluded."note", "updatedAt" = CURRENT_TIMESTAMP
         RETURNING "id"`,
        randomUUID(),
        employeeId,
        input.period,
        input.slipType,
        itemKey,
        label,
        note
      )

      return {
        id: rows[0]?.id ?? randomUUID(),
        employeeId,
        period: input.period,
        slipType: input.slipType,
        itemKey,
        label,
        note,
        updatedAt: new Date().toISOString()
      }
    }
  )

  /**
   * استخراج أيام الغياب لكشوف شهر معيّن من ملفاتها المخزَّنة.
   *
   * يعمل على كل كشوف الشهر (بمن فيها التي فُحصت قبلًا) لأن إعادة الفحص آمنة
   * وتُبقي الأرقام مطابقةً لملفاتها بعد أي تعديل على المحلّل.
   */
  ipc.handle('payrolls:items.absences.sync', async (_event, query: { period: string }) => {
    requirePermission('payrolls.create')
    assertPeriod(query.period)

    const batches = await prisma.payrollBatch.findMany({
      where: { period: query.period },
      select: { id: true }
    })
    if (batches.length === 0) {
      throw new ApiError('NOT_FOUND', 'No payroll file for this month')
    }

    let absences = 0
    let missing = 0
    for (const batch of batches) {
      const result = await scanBatchAbsences(prisma, batch.id)
      absences += result.absences
      if (result.fileMissing) missing += 1
    }

    return { batches: batches.length, absences, missing }
  })
}
