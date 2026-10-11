import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type {
  EmployeeIncentiveRateUpsertInput,
  EmployeeIncentiveRateRecord,
  IncentiveRateRecord,
  IncentiveRateUpsertInput,
  ListPayrollsQuery,
  PayrollRecord,
  PenaltyRateRecord,
  PenaltyRateUpsertInput,
  SalaryGradeRecord,
  SalaryGradeUpsertInput
} from '../../../shared/types'
import { requirePermission } from '../auth'
import { parsePayrollPdf } from '../payroll-parser'
import type { PayrollDepartmentRef, PayrollEmployeeRef } from '../payroll-parser'
import {
  deleteStoredPayrollFile,
  slicePayrollPage,
  storePayrollBatch
} from '../payroll-files'
import { syncPayrollDepartments } from '../payroll-transfers'
import { parseIncentiveRatePdf } from '../incentive-rate-parser'
import { deleteStoredRateFile, sliceRatePage, storeRateBatch } from '../incentive-rate-files'
import {
  deleteStoredRateFile as deleteEmployeeRateFile,
  sliceRatePage as sliceEmployeeRatePage,
  storeRateBatch as storeEmployeeRateBatch
} from '../employee-incentive-files'
import { parseEmployeeIncentiveRatePdf } from '../employee-incentive-parser'
import { parsePenaltyRatePdf } from '../penalty-incentive-parser'
import {
  deleteStoredFile as deletePenaltyFile,
  slicePage as slicePenaltyPage,
  storeBatch as storePenaltyBatch
} from '../penalty-incentive-files'
import {
  attachSalaryGradeFile,
  deleteStoredSalaryGradeFile,
  previewSalaryGradeFile,
  removeSalaryGradeFile
} from '../salary-grade-files'
import type { IpcRegistry } from './registry'

const ENTRY_INCLUDE = {
  batch: { select: { originalName: true, uploadedAt: true } },
  employee: { select: { code: true, name: true, department: { select: { name: true } } } },
  department: { select: { name: true } }
} as const

type EntryRow = Prisma.PayrollEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>

function toPayrollRecord(entry: EntryRow): PayrollRecord {
  return {
    id: entry.id,
    batchId: entry.batchId,
    employeeId: entry.employeeId,
    employeeCode: entry.employee.code,
    employeeName: entry.employee.name,
    type: entry.type,
    month: entry.month,
    year: entry.year,
    period: entry.period,
    page: entry.page,
    departmentId: entry.departmentId,
    departmentName: entry.department?.name ?? null,
    workshop: entry.workshop,
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

const RATE_INCLUDE = {
  department: { select: { name: true } },
  batch: { select: { originalName: true, uploadedAt: true } }
} as const

type RateRow = Prisma.DepartmentIncentiveRateGetPayload<{ include: typeof RATE_INCLUDE }>

function toRateRecord(rate: RateRow): IncentiveRateRecord {
  return {
    id: rate.id,
    batchId: rate.batchId,
    departmentId: rate.departmentId,
    departmentName: rate.department.name,
    month: rate.month,
    year: rate.year,
    period: rate.period,
    page: rate.page,
    rate: rate.rate,
    note: rate.note,
    fileName: rate.batch?.originalName ?? null,
    uploadedAt: rate.batch?.uploadedAt.toISOString() ?? null
  }
}

const EMPLOYEE_RATE_INCLUDE = {
  employee: { select: { code: true, name: true } },
  batch: { select: { originalName: true, uploadedAt: true } }
} as const

type EmployeeRateRow = Prisma.EmployeeIncentiveRateGetPayload<{
  include: typeof EMPLOYEE_RATE_INCLUDE
}>

function toEmployeeRateRecord(rate: EmployeeRateRow): EmployeeIncentiveRateRecord {
  return {
    id: rate.id,
    batchId: rate.batchId,
    employeeId: rate.employeeId,
    employeeCode: rate.employee.code,
    employeeName: rate.employee.name,
    month: rate.month,
    year: rate.year,
    period: rate.period,
    page: rate.page,
    rate: rate.rate,
    note: rate.note,
    fileName: rate.batch?.originalName ?? null,
    uploadedAt: rate.batch?.uploadedAt.toISOString() ?? null
  }
}

const PENALTY_INCLUDE = {
  employee: { select: { code: true, name: true } },
  batch: { select: { originalName: true, uploadedAt: true } }
} as const

type PenaltyRow = Prisma.EmployeeIncentivePenaltyGetPayload<{ include: typeof PENALTY_INCLUDE }>

function toPenaltyRecord(penalty: PenaltyRow): PenaltyRateRecord {
  return {
    id: penalty.id,
    batchId: penalty.batchId,
    employeeId: penalty.employeeId,
    employeeCode: penalty.employee.code,
    employeeName: penalty.employee.name,
    month: penalty.month,
    year: penalty.year,
    period: penalty.period,
    page: penalty.page,
    rate: penalty.rate,
    amount: penalty.amount,
    note: penalty.note,
    fileName: penalty.batch?.originalName ?? null,
    uploadedAt: penalty.batch?.uploadedAt.toISOString() ?? null
  }
}

function normalisePenaltyInput(input: PenaltyRateUpsertInput): {
  employeeId: string
  month: number
  year: number
  period: string
  rate: number
  amount: number
  note: string | null
} {
  const employeeId = input.employeeId?.trim()
  if (!employeeId) throw new ApiError('VALIDATION', 'Employee is required')
  const period = input.period?.trim()
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new ApiError('VALIDATION', 'Period must use the yyyy-mm format')
  }
  const rate = Number(input.rate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new ApiError('VALIDATION', 'Rate must be a number between 0 and 100')
  }
  const amount = input.amount === undefined ? 0 : Number(input.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError('VALIDATION', 'Amount must be a positive number')
  }
  const [year, month] = period.split('-').map(Number)
  if (month < 1 || month > 12) throw new ApiError('VALIDATION', 'Invalid month')
  return {
    employeeId,
    month,
    year,
    period,
    rate: Math.round(rate * 10000) / 10000,
    amount: Math.round(amount * 100) / 100,
    note: input.note?.trim() || null
  }
}

async function assertEmployeeForRate(
  prisma: PrismaClient,
  employeeId: string
): Promise<void> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
}

function normaliseRateInput(input: IncentiveRateUpsertInput): {
  departmentId: string
  month: number
  year: number
  period: string
  rate: number
  note: string | null
} {
  const departmentId = input.departmentId?.trim()
  if (!departmentId) throw new ApiError('VALIDATION', 'Department is required')
  const period = input.period?.trim()
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new ApiError('VALIDATION', 'Period must use the yyyy-mm format')
  }
  const rate = Number(input.rate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new ApiError('VALIDATION', 'Rate must be a number between 0 and 100')
  }
  const [year, month] = period.split('-').map(Number)
  if (month < 1 || month > 12) throw new ApiError('VALIDATION', 'Invalid month')
  return {
    departmentId,
    month,
    year,
    period,
    rate: Math.round(rate * 10000) / 10000,
    note: input.note?.trim() || null
  }
}

function normaliseEmployeeRateInput(input: EmployeeIncentiveRateUpsertInput): {
  employeeId: string
  month: number
  year: number
  period: string
  rate: number
  note: string | null
} {
  const employeeId = input.employeeId?.trim()
  if (!employeeId) throw new ApiError('VALIDATION', 'Employee is required')
  const period = input.period?.trim()
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new ApiError('VALIDATION', 'Period must use the yyyy-mm format')
  }
  const rate = Number(input.rate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new ApiError('VALIDATION', 'Rate must be a number between 0 and 100')
  }
  const [year, month] = period.split('-').map(Number)
  if (month < 1 || month > 12) throw new ApiError('VALIDATION', 'Invalid month')
  return {
    employeeId,
    month,
    year,
    period,
    rate: Math.round(rate * 10000) / 10000,
    note: input.note?.trim() || null
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

async function departmentRefs(prisma: PrismaClient): Promise<PayrollDepartmentRef[]> {
  return prisma.department.findMany({ select: { id: true, name: true } })
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
        employees: await employeeRefs(prisma),
        departments: await departmentRefs(prisma)
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
        employees: await employeeRefs(prisma),
        departments: await departmentRefs(prisma)
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
            departmentId: row.departmentId,
            workshop: row.workshop,
            basicSalary: row.basicSalary,
            totalEarned: row.totalEarned,
            totalDeductions: row.totalDeductions,
            netSalary: row.netSalary
          }))
        })
        created = matchedRows.length

        await syncPayrollDepartments(tx, matchedRows, payload.fileName, parsed.year, parsed.month)
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

  // ---------------- نسب الحوافز للأقسام (تاريخ شهري) ----------------
  ipc.handle(
    'payrolls:incentiveRates.list',
    async (_event, query: { period?: string; departmentId?: string } = {}) => {
      requirePermission('payrolls.view')
      const where: Prisma.DepartmentIncentiveRateWhereInput = {}
      if (query.period) where.period = query.period
      if (query.departmentId) where.departmentId = query.departmentId
      const rates = await prisma.departmentIncentiveRate.findMany({
        where,
        include: RATE_INCLUDE,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { department: { name: 'asc' } }]
      })
      return rates.map(toRateRecord)
    }
  )

  ipc.handle('payrolls:incentiveRates.listByDepartment', async (_event, departmentId: string) => {
    requirePermission('payrolls.view')
    const rates = await prisma.departmentIncentiveRate.findMany({
      where: { departmentId },
      include: RATE_INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })
    return rates.map(toRateRecord)
  })

  ipc.handle('payrolls:incentiveRates.create', async (_event, input: IncentiveRateUpsertInput) => {
    requirePermission('payrolls.create')
    const data = normaliseRateInput(input)
    const department = await prisma.department.findUnique({ where: { id: data.departmentId } })
    if (!department) throw new ApiError('NOT_FOUND', 'Department not found')
    const rate = await prisma.departmentIncentiveRate.upsert({
      where: { departmentId_period: { departmentId: data.departmentId, period: data.period } },
      create: { ...data, page: 1 },
      update: { rate: data.rate, note: data.note },
      include: RATE_INCLUDE
    })
    return toRateRecord(rate)
  })

  ipc.handle(
    'payrolls:incentiveRates.update',
    async (_event, id: string, input: IncentiveRateUpsertInput) => {
      requirePermission('payrolls.edit')
      const target = await prisma.departmentIncentiveRate.findUnique({ where: { id } })
      if (!target) throw new ApiError('NOT_FOUND', 'Rate record not found')
      const data = normaliseRateInput(input)
      const department = await prisma.department.findUnique({ where: { id: data.departmentId } })
      if (!department) throw new ApiError('NOT_FOUND', 'Department not found')
      const classed = await prisma.departmentIncentiveRate.findUnique({
        where: { departmentId_period: { departmentId: data.departmentId, period: data.period } }
      })
      if (classed && classed.id !== id) {
        throw new ApiError('CONFLICT', 'A rate for this department and period already exists')
      }
      const rate = await prisma.departmentIncentiveRate.update({
        where: { id },
        data: {
          departmentId: data.departmentId,
          month: data.month,
          year: data.year,
          period: data.period,
          rate: data.rate,
          note: data.note
        },
        include: RATE_INCLUDE
      })
      return toRateRecord(rate)
    }
  )

  ipc.handle('payrolls:incentiveRates.remove', async (_event, id: string) => {
    requirePermission('payrolls.delete')
    const rate = await prisma.departmentIncentiveRate.findUnique({
      where: { id },
      select: { id: true, batchId: true }
    })
    if (!rate) throw new ApiError('NOT_FOUND', 'Rate record not found')

    await prisma.$transaction(async (tx) => {
      await tx.departmentIncentiveRate.delete({ where: { id: rate.id } })
      if (rate.batchId) {
        const remaining = await tx.departmentIncentiveRate.count({
          where: { batchId: rate.batchId }
        })
        if (remaining === 0) {
          const batch = await tx.incentiveRateBatch.findUnique({
            where: { id: rate.batchId },
            select: { storedName: true }
          })
          if (batch) {
            await tx.incentiveRateBatch.delete({ where: { id: rate.batchId } })
            deleteStoredRateFile(batch.storedName)
          }
        }
      }
    })
  })

  ipc.handle(
    'payrolls:incentiveRates.parsePdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')
      const departments = await prisma.department.findMany({
        select: { id: true, code: true, name: true }
      })
      return parseIncentiveRatePdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        departments
      })
    }
  )

  ipc.handle(
    'payrolls:incentiveRates.importPdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')
      const departments = await prisma.department.findMany({
        select: { id: true, code: true, name: true }
      })
      const parsed = await parseIncentiveRatePdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        departments
      })
      if (parsed.rows.length === 0) {
        throw new ApiError('VALIDATION', 'No department rates found in the PDF')
      }

      const { storedName, pageCount } = await storeRateBatch(
        Buffer.from(payload.data),
        payload.fileName
      )
      const matchedRows = parsed.rows.filter((row) => row.departmentId)

      let created = 0
      await prisma.$transaction(async (tx) => {
        const oldBatches = await tx.incentiveRateBatch.findMany({
          where: { period: parsed.period },
          select: { id: true, storedName: true }
        })
        if (oldBatches.length > 0) {
          await tx.incentiveRateBatch.deleteMany({
            where: { id: { in: oldBatches.map((batch) => batch.id) } }
          })
          oldBatches.forEach((batch) => deleteStoredRateFile(batch.storedName))
        }

        const batch = await tx.incentiveRateBatch.create({
          data: {
            period: parsed.period,
            originalName: payload.fileName,
            storedName,
            size: Buffer.byteLength(payload.data),
            pageCount
          }
        })

        for (const row of matchedRows) {
          await tx.departmentIncentiveRate.upsert({
            where: {
              departmentId_period: { departmentId: row.departmentId!, period: parsed.period }
            },
            create: {
              batchId: batch.id,
              departmentId: row.departmentId!,
              month: parsed.month,
              year: parsed.year,
              period: parsed.period,
              page: row.page,
              rate: row.rate
            },
            update: { batchId: batch.id, rate: row.rate, page: row.page }
          })
          created += 1
        }
      })

      return { created, unmatched: parsed.unmatched, period: parsed.period }
    }
  )

  ipc.handle('payrolls:incentiveRates.preview', async (_event, id: string) => {
    requirePermission('payrolls.view')
    const rate = await prisma.departmentIncentiveRate.findUnique({
      where: { id },
      include: { batch: { select: { storedName: true, originalName: true } } }
    })
    if (!rate) throw new ApiError('NOT_FOUND', 'Rate record not found')
    if (!rate.batch) return null
    const data = await sliceRatePage(rate.batch.storedName, rate.page - 1)
    return { originalName: rate.batch.originalName, data: new Uint8Array(data) }
  })

  // ---------------- نسب الحوافز الفردية (لكل موظف، شهرية) ----------------
  ipc.handle(
    'payrolls:employeeIncentiveRates.list',
    async (_event, query: { period?: string; employeeId?: string } = {}) => {
      requirePermission('payrolls.view')
      const where: Prisma.EmployeeIncentiveRateWhereInput = {}
      if (query.period) where.period = query.period
      if (query.employeeId) where.employeeId = query.employeeId
      const rates = await prisma.employeeIncentiveRate.findMany({
        where,
        include: EMPLOYEE_RATE_INCLUDE,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { code: 'asc' } }]
      })
      return rates.map(toEmployeeRateRecord)
    }
  )

  ipc.handle(
    'payrolls:employeeIncentiveRates.listByEmployee',
    async (_event, employeeId: string) => {
      requirePermission('payrolls.view')
      const rates = await prisma.employeeIncentiveRate.findMany({
        where: { employeeId },
        include: EMPLOYEE_RATE_INCLUDE,
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      })
      return rates.map(toEmployeeRateRecord)
    }
  )

  ipc.handle('payrolls:employeeIncentiveRates.create', async (_event, input: EmployeeIncentiveRateUpsertInput) => {
    requirePermission('payrolls.create')
    const data = normaliseEmployeeRateInput(input)
    await assertEmployeeForRate(prisma, data.employeeId)
    const rate = await prisma.employeeIncentiveRate.upsert({
      where: { employeeId_period: { employeeId: data.employeeId, period: data.period } },
      create: { ...data, page: 1 },
      update: { rate: data.rate, note: data.note },
      include: EMPLOYEE_RATE_INCLUDE
    })
    return toEmployeeRateRecord(rate)
  })

  ipc.handle(
    'payrolls:employeeIncentiveRates.update',
    async (_event, id: string, input: EmployeeIncentiveRateUpsertInput) => {
      requirePermission('payrolls.edit')
      const target = await prisma.employeeIncentiveRate.findUnique({ where: { id } })
      if (!target) throw new ApiError('NOT_FOUND', 'Rate record not found')
      const data = normaliseEmployeeRateInput(input)
      await assertEmployeeForRate(prisma, data.employeeId)
      const clash = await prisma.employeeIncentiveRate.findUnique({
        where: { employeeId_period: { employeeId: data.employeeId, period: data.period } }
      })
      if (clash && clash.id !== id) {
        throw new ApiError('CONFLICT', 'A rate for this employee and period already exists')
      }
      const rate = await prisma.employeeIncentiveRate.update({
        where: { id },
        data: {
          employeeId: data.employeeId,
          month: data.month,
          year: data.year,
          period: data.period,
          rate: data.rate,
          note: data.note
        },
        include: EMPLOYEE_RATE_INCLUDE
      })
      return toEmployeeRateRecord(rate)
    }
  )

  ipc.handle('payrolls:employeeIncentiveRates.remove', async (_event, id: string) => {
    requirePermission('payrolls.delete')
    const rate = await prisma.employeeIncentiveRate.findUnique({
      where: { id },
      select: { id: true, batchId: true }
    })
    if (!rate) throw new ApiError('NOT_FOUND', 'Rate record not found')

    await prisma.$transaction(async (tx) => {
      await tx.employeeIncentiveRate.delete({ where: { id: rate.id } })
      if (rate.batchId) {
        const remaining = await tx.employeeIncentiveRate.count({
          where: { batchId: rate.batchId }
        })
        if (remaining === 0) {
          const batch = await tx.employeeIncentiveRateBatch.findUnique({
            where: { id: rate.batchId },
            select: { storedName: true }
          })
          if (batch) {
            await tx.employeeIncentiveRateBatch.delete({ where: { id: rate.batchId } })
            deleteEmployeeRateFile(batch.storedName)
          }
        }
      }
    })
  })

  ipc.handle(
    'payrolls:employeeIncentiveRates.parsePdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')
      const employees = await prisma.employee.findMany({
        select: { id: true, code: true, name: true }
      })
      return parseEmployeeIncentiveRatePdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        employees
      })
    }
  )

  ipc.handle(
    'payrolls:employeeIncentiveRates.importPdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')
      const employees = await prisma.employee.findMany({
        select: { id: true, code: true, name: true }
      })
      const parsed = await parseEmployeeIncentiveRatePdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        employees
      })
      if (parsed.rows.length === 0) {
        throw new ApiError('VALIDATION', 'No employee rates found in the PDF')
      }

      const { storedName, pageCount } = await storeEmployeeRateBatch(
        Buffer.from(payload.data),
        payload.fileName
      )
      const matchedRows = parsed.rows.filter((row) => row.employeeId)

      let created = 0
      await prisma.$transaction(async (tx) => {
        const oldBatches = await tx.employeeIncentiveRateBatch.findMany({
          where: { period: parsed.period },
          select: { id: true, storedName: true }
        })
        if (oldBatches.length > 0) {
          await tx.employeeIncentiveRateBatch.deleteMany({
            where: { id: { in: oldBatches.map((batch) => batch.id) } }
          })
          oldBatches.forEach((batch) => deleteEmployeeRateFile(batch.storedName))
        }

        const batch = await tx.employeeIncentiveRateBatch.create({
          data: {
            period: parsed.period,
            originalName: payload.fileName,
            storedName,
            size: Buffer.byteLength(payload.data),
            pageCount
          }
        })

        for (const row of matchedRows) {
          await tx.employeeIncentiveRate.upsert({
            where: {
              employeeId_period: { employeeId: row.employeeId!, period: parsed.period }
            },
            create: {
              batchId: batch.id,
              employeeId: row.employeeId!,
              month: parsed.month,
              year: parsed.year,
              period: parsed.period,
              page: row.page,
              rate: row.rate
            },
            update: { batchId: batch.id, rate: row.rate, page: row.page }
          })
          created += 1
        }
      })

      return { created, unmatched: parsed.unmatched, period: parsed.period }
    }
  )

  ipc.handle('payrolls:employeeIncentiveRates.preview', async (_event, id: string) => {
    requirePermission('payrolls.view')
    const rate = await prisma.employeeIncentiveRate.findUnique({
      where: { id },
      include: { batch: { select: { storedName: true, originalName: true } } }
    })
    if (!rate) throw new ApiError('NOT_FOUND', 'Rate record not found')
    if (!rate.batch) return null
    const data = await sliceEmployeeRatePage(rate.batch.storedName, rate.page - 1)
    return { originalName: rate.batch.originalName, data: new Uint8Array(data) }
  })

  // ---------------- الحرمان من الحافز (قيمة ونسبة الخصم لكل موظف) ----------------
  ipc.handle(
    'payrolls:incentivePenalties.list',
    async (_event, query: { period?: string; employeeId?: string } = {}) => {
      requirePermission('payrolls.view')
      const where: Prisma.EmployeeIncentivePenaltyWhereInput = {}
      if (query.period) where.period = query.period
      if (query.employeeId) where.employeeId = query.employeeId
      const penalties = await prisma.employeeIncentivePenalty.findMany({
        where,
        include: PENALTY_INCLUDE,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { code: 'asc' } }]
      })
      return penalties.map(toPenaltyRecord)
    }
  )

  ipc.handle('payrolls:incentivePenalties.listByEmployee', async (_event, employeeId: string) => {
    requirePermission('payrolls.view')
    const penalties = await prisma.employeeIncentivePenalty.findMany({
      where: { employeeId },
      include: PENALTY_INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })
    return penalties.map(toPenaltyRecord)
  })

  ipc.handle('payrolls:incentivePenalties.create', async (_event, input: PenaltyRateUpsertInput) => {
    requirePermission('payrolls.create')
    const data = normalisePenaltyInput(input)
    await assertEmployeeForRate(prisma, data.employeeId)
    const penalty = await prisma.employeeIncentivePenalty.upsert({
      where: { employeeId_period: { employeeId: data.employeeId, period: data.period } },
      create: { ...data, page: 1 },
      update: { rate: data.rate, amount: data.amount, note: data.note },
      include: PENALTY_INCLUDE
    })
    return toPenaltyRecord(penalty)
  })

  ipc.handle(
    'payrolls:incentivePenalties.update',
    async (_event, id: string, input: PenaltyRateUpsertInput) => {
      requirePermission('payrolls.edit')
      const target = await prisma.employeeIncentivePenalty.findUnique({ where: { id } })
      if (!target) throw new ApiError('NOT_FOUND', 'Penalty record not found')
      const data = normalisePenaltyInput(input)
      await assertEmployeeForRate(prisma, data.employeeId)
      const clash = await prisma.employeeIncentivePenalty.findUnique({
        where: { employeeId_period: { employeeId: data.employeeId, period: data.period } }
      })
      if (clash && clash.id !== id) {
        throw new ApiError('CONFLICT', 'A penalty for this employee and period already exists')
      }
      const penalty = await prisma.employeeIncentivePenalty.update({
        where: { id },
        data: {
          employeeId: data.employeeId,
          month: data.month,
          year: data.year,
          period: data.period,
          rate: data.rate,
          amount: data.amount,
          note: data.note
        },
        include: PENALTY_INCLUDE
      })
      return toPenaltyRecord(penalty)
    }
  )

  ipc.handle('payrolls:incentivePenalties.remove', async (_event, id: string) => {
    requirePermission('payrolls.delete')
    const penalty = await prisma.employeeIncentivePenalty.findUnique({
      where: { id },
      select: { id: true, batchId: true }
    })
    if (!penalty) throw new ApiError('NOT_FOUND', 'Penalty record not found')

    await prisma.$transaction(async (tx) => {
      await tx.employeeIncentivePenalty.delete({ where: { id: penalty.id } })
      if (penalty.batchId) {
        const remaining = await tx.employeeIncentivePenalty.count({
          where: { batchId: penalty.batchId }
        })
        if (remaining === 0) {
          const batch = await tx.employeeIncentivePenaltyBatch.findUnique({
            where: { id: penalty.batchId },
            select: { storedName: true }
          })
          if (batch) {
            await tx.employeeIncentivePenaltyBatch.delete({ where: { id: penalty.batchId } })
            deletePenaltyFile(batch.storedName)
          }
        }
      }
    })
  })

  ipc.handle(
    'payrolls:incentivePenalties.parsePdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')
      const employees = await prisma.employee.findMany({
        select: { id: true, code: true, name: true }
      })
      return parsePenaltyRatePdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        employees
      })
    }
  )

  ipc.handle(
    'payrolls:incentivePenalties.importPdf',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('payrolls.create')
      const employees = await prisma.employee.findMany({
        select: { id: true, code: true, name: true }
      })
      const parsed = await parsePenaltyRatePdf({
        buffer: Buffer.from(payload.data),
        fileName: payload.fileName,
        employees
      })
      if (parsed.rows.length === 0) {
        throw new ApiError('VALIDATION', 'No penalty rows found in the PDF')
      }

      const { storedName, pageCount } = await storePenaltyBatch(
        Buffer.from(payload.data),
        payload.fileName
      )
      const matchedRows = parsed.rows.filter((row) => row.employeeId)

      let created = 0
      await prisma.$transaction(async (tx) => {
        const oldBatches = await tx.employeeIncentivePenaltyBatch.findMany({
          where: { period: parsed.period },
          select: { id: true, storedName: true }
        })
        if (oldBatches.length > 0) {
          await tx.employeeIncentivePenaltyBatch.deleteMany({
            where: { id: { in: oldBatches.map((batch) => batch.id) } }
          })
          oldBatches.forEach((batch) => deletePenaltyFile(batch.storedName))
        }

        const batch = await tx.employeeIncentivePenaltyBatch.create({
          data: {
            period: parsed.period,
            originalName: payload.fileName,
            storedName,
            size: Buffer.byteLength(payload.data),
            pageCount
          }
        })

        for (const row of matchedRows) {
          await tx.employeeIncentivePenalty.upsert({
            where: { employeeId_period: { employeeId: row.employeeId!, period: parsed.period } },
            create: {
              batchId: batch.id,
              employeeId: row.employeeId!,
              month: parsed.month,
              year: parsed.year,
              period: parsed.period,
              page: row.page,
              rate: row.rate,
              amount: row.amount
            },
            update: { batchId: batch.id, rate: row.rate, amount: row.amount, page: row.page }
          })
          created += 1
        }
      })

      return { created, unmatched: parsed.unmatched, period: parsed.period }
    }
  )

  ipc.handle('payrolls:incentivePenalties.preview', async (_event, id: string) => {
    requirePermission('payrolls.view')
    const penalty = await prisma.employeeIncentivePenalty.findUnique({
      where: { id },
      include: { batch: { select: { storedName: true, originalName: true } } }
    })
    if (!penalty) throw new ApiError('NOT_FOUND', 'Penalty record not found')
    if (!penalty.batch) return null
    const data = await slicePenaltyPage(penalty.batch.storedName, penalty.page - 1)
    return { originalName: penalty.batch.originalName, data: new Uint8Array(data) }
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
