import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type {
  ListPayrollsQuery,
  PayrollRecord,
  SalaryGradeRecord,
  SalaryGradeUpsertInput
} from '../../../shared/types'
import { requirePermission } from '../auth'
import { parsePayrollPdf } from '../payroll-parser'
import type { PayrollEmployeeRef } from '../payroll-parser'
import {
  deleteStoredPayrollFile,
  slicePayrollPage,
  storePayrollBatch
} from '../payroll-files'
import {
  attachSalaryGradeFile,
  deleteStoredSalaryGradeFile,
  previewSalaryGradeFile,
  removeSalaryGradeFile
} from '../salary-grade-files'
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

const GRADE_INCLUDE = {
  employee: { select: { code: true, name: true } }
} as const

type GradeRow = Prisma.BasicSalaryGradeGetPayload<{ include: typeof GRADE_INCLUDE }>

function toSalaryGradeRecord(grade: GradeRow): SalaryGradeRecord {
  return {
    id: grade.id,
    employeeId: grade.employeeId,
    employeeCode: grade.employee.code,
    employeeName: grade.employee.name,
    date: grade.date.toISOString().slice(0, 10),
    amount: grade.amount,
    note: grade.note,
    fileOriginalName: grade.fileOriginalName,
    fileSize: grade.fileSize,
    fileLinkedAt: grade.fileLinkedAt ? grade.fileLinkedAt.toISOString() : null,
    createdAt: grade.createdAt.toISOString()
  }
}

function normaliseGradeInput(input: SalaryGradeUpsertInput): {
  employeeId: string
  date: Date
  amount: number
  note: string | null
} {
  const employeeId = input.employeeId?.trim()
  if (!employeeId) throw new ApiError('VALIDATION', 'Employee is required')
  const date = input.date?.trim()
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError('VALIDATION', 'Grade date must use the yyyy-mm-dd format')
  }
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    throw new ApiError('VALIDATION', 'Invalid basic-salary amount')
  }
  return {
    employeeId,
    date: new Date(`${date}T00:00:00.000Z`),
    amount: Math.round(amount * 100) / 100,
    note: input.note?.trim() || null
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

  // ---------------- تدرج الأساسي حسب التاريخ ----------------
  ipc.handle('payrolls:salaryGrades.listByEmployee', async (_event, employeeId: string) => {
    requirePermission('payrolls.view')
    const grades = await prisma.basicSalaryGrade.findMany({
      where: { employeeId },
      include: GRADE_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    })
    return grades.map(toSalaryGradeRecord)
  })

  ipc.handle('payrolls:salaryGrades.create', async (_event, input: SalaryGradeUpsertInput) => {
    requirePermission('payrolls.create')
    const data = normaliseGradeInput(input)
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } })
    if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
    const grade = await prisma.basicSalaryGrade.create({ data, include: GRADE_INCLUDE })
    return toSalaryGradeRecord(grade)
  })

  ipc.handle(
    'payrolls:salaryGrades.update',
    async (_event, id: string, input: SalaryGradeUpsertInput) => {
      requirePermission('payrolls.edit')
      const data = normaliseGradeInput(input)
      const target = await prisma.basicSalaryGrade.findUnique({ where: { id } })
      if (!target) throw new ApiError('NOT_FOUND', 'Salary grade not found')
      const grade = await prisma.basicSalaryGrade.update({
        where: { id },
        data: { ...data, employeeId: target.employeeId },
        include: GRADE_INCLUDE
      })
      return toSalaryGradeRecord(grade)
    }
  )

  ipc.handle('payrolls:salaryGrades.remove', async (_event, id: string) => {
    requirePermission('payrolls.delete')
    const grade = await prisma.basicSalaryGrade.findUnique({ where: { id } })
    if (!grade) throw new ApiError('NOT_FOUND', 'Salary grade not found')
    deleteStoredSalaryGradeFile(grade.fileStoredName)
    await prisma.basicSalaryGrade.delete({ where: { id } })
  })

  ipc.handle(
    'payrolls:salaryGrades.attachFile',
    async (_event, payload: { id: string; data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.edit')
      await attachSalaryGradeFile(prisma, payload.id, Buffer.from(payload.data), payload.fileName)
      const grade = await prisma.basicSalaryGrade.findUnique({
        where: { id: payload.id },
        include: GRADE_INCLUDE
      })
      if (!grade) throw new ApiError('NOT_FOUND', 'Salary grade not found')
      return toSalaryGradeRecord(grade)
    }
  )

  ipc.handle('payrolls:salaryGrades.removeFile', async (_event, id: string) => {
    requirePermission('payrolls.edit')
    await removeSalaryGradeFile(prisma, id)
    const grade = await prisma.basicSalaryGrade.findUnique({ where: { id }, include: GRADE_INCLUDE })
    if (!grade) throw new ApiError('NOT_FOUND', 'Salary grade not found')
    return toSalaryGradeRecord(grade)
  })

  ipc.handle('payrolls:salaryGrades.previewFile', async (_event, id: string) => {
    requirePermission('payrolls.view')
    return previewSalaryGradeFile(prisma, id)
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
