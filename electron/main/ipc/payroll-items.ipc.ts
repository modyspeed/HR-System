/**
 * مفردات الأظرف (مرتب/حافز): مصفوفة تقاطع بين الموظفين والبنود.
 *
 * كل ظرف يُخزَّن مرة واحدة عند الاستيراد (PayrollItem)؛ وعند العرض تُبنى
 * الأعمدة من مجموعة بنود الشهر (بند واحد ⇒ عمود واحد) والصفوف من أظرف
 * الموظفين، فتظهر المصفوفة بترتيب ثابت لكل شهر.
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type { PayrollItemsPeriod, PayrollItemsQuery } from '../../../shared/types'
import { requirePermission } from '../auth'
import { buildItemsMatrix, extractPayrollItems } from '../payroll-items'
import { resolvePayrollStoredPath } from '../payroll-files'
import fs from 'fs'
import type { IpcRegistry } from './registry'

const ENTRY_INCLUDE = {
  employee: { select: { code: true, name: true, department: { select: { name: true } } } },
  department: { select: { name: true } },
  items: true
} as const

type EntryRow = Prisma.PayrollEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>

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
): Promise<{ entries: number; items: number }> {
  const batch = await prisma.payrollBatch.findUnique({
    where: { id: batchId },
    include: { entries: { select: { id: true, page: true } } }
  })
  if (!batch) throw new ApiError('NOT_FOUND', 'Payroll batch not found')

  const filePath = resolvePayrollStoredPath(batch.storedName)
  if (!fs.existsSync(filePath)) {
    throw new ApiError('NOT_FOUND', 'The payroll file is missing from the archive')
  }

  const { byPage } = await extractPayrollItems(fs.readFileSync(filePath))
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

  return { entries: byPage.size, items: total }
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
}
