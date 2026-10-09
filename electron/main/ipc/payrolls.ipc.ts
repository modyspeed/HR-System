import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type { ListPayrollsQuery, PayrollRecord } from '../../../shared/types'
import { requirePermission } from '../auth'
import { parsePayrollPdf } from '../payroll-parser'
import type { PayrollEmployeeRef } from '../payroll-parser'
import {
  deleteStoredPayrollFile,
  slicePayrollPage,
  storePayrollBatch
} from '../payroll-files'
import type { IpcRegistry } from './registry'

const ENTRY_INCLUDE = {
  batch: { select: { originalName: true, uploadedAt: true } },
  employee: { select: { code: true, name: true, department: { select: { name: true } } } }
} as const

type EntryRow = Prisma.PayrollEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>

function toPayrollRecord(entry: EntryRow): PayrollRecord {
  return {
    id: entry.id,
    batchId: entry.batchId,
    employeeId: entry.employeeId,
    employeeCode: entry.employee.code,
    employeeName: entry.employee.name,
    departmentName: entry.employee.department?.name ?? null,
    type: entry.type,
    month: entry.month,
    year: entry.year,
    period: entry.period,
    page: entry.page,
    basicSalary: entry.basicSalary,
    totalEarned: entry.totalEarned,
    totalDeductions: entry.totalDeductions,
    netSalary: entry.netSalary,
    fileName: entry.batch.originalName,
    uploadedAt: entry.batch.uploadedAt.toISOString()
  }
}

async function employeeRefs(prisma: PrismaClient): Promise<PayrollEmployeeRef[]> {
  return prisma.employee.findMany({
    select: { id: true, code: true, name: true }
  })
}

export function registerPayrollsIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('payrolls:list', async (_event, query: ListPayrollsQuery = {}) => {
    requirePermission('payrolls.view')

    const where: Prisma.PayrollEntryWhereInput = {}
    const search = query.search?.trim()
    if (search) {
      where.OR = [
        { employee: { code: { contains: search } } },
        { employee: { name: { contains: search } } }
      ]
    }
    if (query.type) where.type = query.type
    if (query.month) where.month = query.month
    if (query.year) where.year = query.year

    const entries = await prisma.payrollEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { code: 'asc' } }]
    })
    return entries.map(toPayrollRecord)
  })

  ipc.handle('payrolls:listByEmployee', async (_event, employeeId: string) => {
    requirePermission('payrolls.view')
    const entries = await prisma.payrollEntry.findMany({
      where: { employeeId },
      include: ENTRY_INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { type: 'asc' }]
    })
    return entries.map(toPayrollRecord)
  })

  ipc.handle(
    'payrolls:parsePdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')
      return parsePayrollPdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        employees: await employeeRefs(prisma)
      })
    }
  )

  ipc.handle(
    'payrolls:importPdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')

      const parsed = await parsePayrollPdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        employees: await employeeRefs(prisma)
      })
      if (parsed.rows.length === 0) {
        throw new ApiError('VALIDATION', 'No employee slips found in the PDF')
      }

      const { storedName, pageCount } = await storePayrollBatch(
        Buffer.from(payload.data),
        payload.fileName
      )

      const matchedRows = parsed.rows.filter((row) => row.employeeId !== null)
      let created = 0

      await prisma.$transaction(async (tx) => {
        // استبدال دفعة نفس الشهر/النوع — يبقى لكل شهر نسخة واحدة فقط.
        const oldBatches = await tx.payrollBatch.findMany({
          where: { type: parsed.type, period: parsed.period },
          select: { id: true, storedName: true }
        })
        if (oldBatches.length > 0) {
          await tx.payrollEntry.deleteMany({
            where: { batchId: { in: oldBatches.map((batch) => batch.id) } }
          })
          await tx.payrollBatch.deleteMany({
            where: { id: { in: oldBatches.map((batch) => batch.id) } }
          })
          oldBatches.forEach((batch) => deleteStoredPayrollFile(batch.storedName))
        }

        const batch = await tx.payrollBatch.create({
          data: {
            type: parsed.type,
            month: parsed.month,
            year: parsed.year,
            period: parsed.period,
            originalName: payload.fileName,
            storedName,
            size: Buffer.byteLength(payload.data),
            pageCount
          }
        })

        await tx.payrollEntry.createMany({
          data: matchedRows.map((row) => ({
            batchId: batch.id,
            employeeId: row.employeeId!,
            type: parsed.type,
            month: parsed.month,
            year: parsed.year,
            period: parsed.period,
            page: row.page,
            basicSalary: row.basicSalary,
            totalEarned: row.totalEarned,
            totalDeductions: row.totalDeductions,
            netSalary: row.netSalary
          }))
        })
        created = matchedRows.length
      })

      return { created, unmatched: parsed.unmatched, period: parsed.period }
    }
  )

  ipc.handle('payrolls:previewEntry', async (_event, id: string) => {
    requirePermission('payrolls.view')
    const entry = await prisma.payrollEntry.findUnique({
      where: { id },
      include: { batch: { select: { storedName: true, originalName: true } } }
    })
    if (!entry) throw new ApiError('NOT_FOUND', 'Payroll entry not found')
    const data = await slicePayrollPage(entry.batch.storedName, entry.page - 1)
    return {
      originalName: entry.batch.originalName,
      page: entry.page,
      data: new Uint8Array(data)
    }
  })

  ipc.handle('payrolls:remove', async (_event, id: string) => {
    requirePermission('payrolls.delete')
    const entry = await prisma.payrollEntry.findUnique({
      where: { id },
      select: { id: true, batchId: true }
    })
    if (!entry) throw new ApiError('NOT_FOUND', 'Payroll entry not found')

    await prisma.$transaction(async (tx) => {
      await tx.payrollEntry.delete({ where: { id: entry.id } })
      const remaining = await tx.payrollEntry.count({ where: { batchId: entry.batchId } })
      if (remaining === 0) {
        const batch = await tx.payrollBatch.findUnique({
          where: { id: entry.batchId },
          select: { storedName: true }
        })
        if (batch) {
          await tx.payrollBatch.delete({ where: { id: entry.batchId } })
          deleteStoredPayrollFile(batch.storedName)
        }
      }
    })
  })
}

/**
 * تنظيف: حقائب كشوف أصبحت بلا أي دفعات (مثلًا بعد حذف موظف كان وحده فيها)
 * تُحذف مع ملفها الفعلي من القرص.
 */
export async function sweepOrphanPayrollBatches(prisma: PrismaClient): Promise<void> {
  const orphans = await prisma.payrollBatch.findMany({
    where: { entries: { none: {} } },
    select: { id: true, storedName: true }
  })
  if (orphans.length === 0) return
  await prisma.payrollBatch.deleteMany({
    where: { id: { in: orphans.map((batch) => batch.id) } }
  })
  orphans.forEach((batch) => deleteStoredPayrollFile(batch.storedName))
}
