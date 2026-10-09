import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type {
  EmployeeImportRow,
  EmployeeParseResult,
  EmployeeRecord,
  EmployeeUpsertInput,
  ListEmployeesQuery
} from '../../../shared/types'
import { getSession, requirePermission } from '../auth'
import { ACTIVE_EMPLOYEE_STATUS } from '../../../shared/employeeStatuses'
import {
  attachEmployeeFile,
  deleteStoredEmployeeFile,
  previewEmployeeFile,
  removeEmployeeFile,
  revealEmployeeFilesDir
} from '../employee-files'
import { deleteStoredLeaveFile } from '../leave-files'
import { sweepOrphanPayrollBatches } from './payrolls.ipc'
import { parseEmployeesFile } from '../import/employeesImport'
import { importEmployees } from '../import/employeesPersist'
import {
  applyAutomaticRetirement,
  changeEmployeeStatus,
  getStatusHistory,
  rehireEmployee
} from '../employee-status'
import type { IpcRegistry } from './registry'

const DEPARTMENT_INCLUDE = {
  department: { select: { name: true } },
  rehiredFrom: { select: { id: true, code: true, name: true } }
} as const

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof DEPARTMENT_INCLUDE }>

function isoOrNull(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function toEmployeeRecord(
  employee: EmployeeRow,
  rehiredTo: { id: string; code: string; name: string } | null = null
): EmployeeRecord {
  return {
    id: employee.id,
    code: employee.code,
    name: employee.name,
    insuranceNo: employee.insuranceNo,
    nationalId: employee.nationalId,
    grade: employee.grade,
    gradeDate: isoOrNull(employee.gradeDate),
    birthDate: isoOrNull(employee.birthDate),
    permanentDate: isoOrNull(employee.permanentDate),
    hireDate: isoOrNull(employee.hireDate),
    qualification: employee.qualification,
    qualificationYear: employee.qualificationYear,
    contractType: employee.contractType,
    departmentId: employee.departmentId,
    departmentName: employee.department?.name ?? null,
    fileOriginalName: employee.fileOriginalName,
    fileSize: employee.fileSize,
    fileLinkedAt: employee.fileLinkedAt ? employee.fileLinkedAt.toISOString() : null,
    status: employee.status,
    isActive: employee.isActive,
    rehiredFrom: employee.rehiredFrom,
    rehiredTo,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString()
  }
}

/** `yyyy-mm-dd` → Date at UTC midnight, or null. */
function dateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ApiError('VALIDATION', 'Dates must use the yyyy-mm-dd format')
  }
  return new Date(`${trimmed}T00:00:00.000Z`)
}

interface NormalisedEmployee {
  code: string
  name: string
  insuranceNo: string | null
  nationalId: string | null
  grade: string | null
  gradeDate: Date | null
  birthDate: Date | null
  permanentDate: Date | null
  hireDate: Date | null
  qualification: string | null
  qualificationYear: number | null
  contractType: string | null
  departmentId: string | null
  isActive: boolean
}

function normaliseInput(input: EmployeeUpsertInput): NormalisedEmployee {
  const code = input.code.trim()
  const name = input.name.trim()
  if (!code) throw new ApiError('VALIDATION', 'Employee code is required')
  if (!name) throw new ApiError('VALIDATION', 'Employee name is required')

  const year = input.qualificationYear ?? null
  if (year !== null && (year < 1900 || year > 2200)) {
    throw new ApiError('VALIDATION', 'Qualification year looks invalid')
  }

  return {
    code,
    name,
    insuranceNo: input.insuranceNo?.trim() || null,
    nationalId: input.nationalId?.trim() || null,
    grade: input.grade?.trim() || null,
    gradeDate: dateOrNull(input.gradeDate),
    birthDate: dateOrNull(input.birthDate),
    permanentDate: dateOrNull(input.permanentDate),
    hireDate: dateOrNull(input.hireDate),
    qualification: input.qualification?.trim() || null,
    qualificationYear: year,
    contractType: input.contractType?.trim() || null,
    departmentId: input.departmentId?.trim() || null,
    isActive: input.isActive ?? true
  }
}

/** Fails when the employee references a department that does not exist. */
async function assertDepartmentExists(
  prisma: PrismaClient,
  departmentId: string | null
): Promise<void> {
  if (!departmentId) return
  const department = await prisma.department.findUnique({ where: { id: departmentId } })
  if (!department) throw new ApiError('VALIDATION', 'Selected department does not exist')
}

export function registerEmployeesIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('employees:list', async (_event, query: ListEmployeesQuery = {}) => {
    requirePermission('employees.view')
    await applyAutomaticRetirement(prisma)

    const where: Prisma.EmployeeWhereInput = {}
    const search = query.search?.trim()
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { insuranceNo: { contains: search } },
        { nationalId: { contains: search } }
      ]
    }
    if (query.isActive !== null && query.isActive !== undefined) {
      where.isActive = query.isActive
    }
    const statusFilter = query.status?.trim()
    if (statusFilter) where.status = statusFilter

    const SORT_FIELDS = new Set(['code', 'name', 'grade', 'hireDate', 'createdAt'])
    const sort = SORT_FIELDS.has(query.sort ?? 'code') ? (query.sort ?? 'code') : 'code'
    const order = query.order === 'desc' ? 'desc' : 'asc'
    const orderBy: Prisma.EmployeeOrderByWithRelationInput = {
      [sort]: order
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy,
      include: DEPARTMENT_INCLUDE
    })
    return employees.map((employee) => toEmployeeRecord(employee))
  })

  ipc.handle('employees:getById', async (_event, id: string) => {
    requirePermission('employees.view')
    await applyAutomaticRetirement(prisma)
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: DEPARTMENT_INCLUDE
    })
    if (!employee) return null
    const rehiredTo = await prisma.employee.findFirst({
      where: { rehiredFromId: employee.id },
      select: { id: true, code: true, name: true }
    })
    return toEmployeeRecord(employee, rehiredTo)
  })

  ipc.handle('employees:create', async (_event, input: EmployeeUpsertInput) => {
    requirePermission('employees.create')
    return createEmployee(prisma, input)
  })

  ipc.handle('employees:update', async (_event, id: string, input: EmployeeUpsertInput) => {
    requirePermission('employees.edit')
    return updateEmployee(prisma, id, input)
  })

  ipc.handle('employees:remove', async (_event, id: string) => {
    requirePermission('employees.delete')
    // حذف الملفات الفعلية أولًا (ملف الموظف + مستندات إجازاته) قبل حذف الصفوف.
    const target = await prisma.employee.findUnique({
      where: { id },
      select: { fileStoredName: true, leaves: { select: { fileStoredName: true } } }
    })
    if (!target) throw new ApiError('NOT_FOUND', 'Employee not found')
    deleteStoredEmployeeFile(target.fileStoredName)
    for (const leave of target.leaves) deleteStoredLeaveFile(leave.fileStoredName)
    await prisma.employee.delete({ where: { id } })
    await sweepOrphanPayrollBatches(prisma)
  })

  ipc.handle(
    'employees:rehire',
    async (_event, id: string, input: { code: string; contractType?: string | null; hireDate?: string | null }) => {
      requirePermission('employees.create')
      const created = await rehireEmployee(prisma, id, input)
      const employee = await prisma.employee.findUnique({
        where: { id: created.id },
        include: DEPARTMENT_INCLUDE
      })
      if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
      return toEmployeeRecord(employee)
    }
  )

  ipc.handle(
    'employees:setStatus',
    async (_event, id: string, input: { status: string; reason?: string }) => {
      requirePermission('employees.manage_status')
      await changeEmployeeStatus(prisma, id, input, getSession()?.fullName ?? null)
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: DEPARTMENT_INCLUDE
      })
      if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
      return toEmployeeRecord(employee)
    }
  )

  ipc.handle('employees:statusHistory', async (_event, id: string) => {
    requirePermission('employees.view')
    return getStatusHistory(prisma, id)
  })

  ipc.handle(
    'employees:parseImportFile',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('employees.import')
      const result = await parseEmployeesFile(Buffer.from(payload.data), payload.fileName)
      return result satisfies EmployeeParseResult
    }
  )

  ipc.handle('employees:importRows', async (_event, rows: EmployeeImportRow[]) => {
    requirePermission('employees.import')
    return importEmployees(prisma, rows)
  })

  ipc.handle(
    'employees:attachFile',
    async (_event, payload: { id: string; data: ArrayBuffer; fileName: string }) => {
      requirePermission('employees.edit')
      await attachEmployeeFile(
        prisma,
        payload.id,
        Buffer.from(payload.data),
        payload.fileName
      )
      const employee = await prisma.employee.findUnique({
        where: { id: payload.id },
        include: DEPARTMENT_INCLUDE
      })
      if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
      return toEmployeeRecord(employee)
    }
  )

  ipc.handle('employees:removeFile', async (_event, id: string) => {
    requirePermission('employees.edit')
    await removeEmployeeFile(prisma, id)
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: DEPARTMENT_INCLUDE
    })
    if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
    return toEmployeeRecord(employee)
  })

  ipc.handle('employees:previewFile', async (_event, id: string) => {
    requirePermission('employees.view')
    return previewEmployeeFile(prisma, id)
  })

  ipc.handle('employees:revealFilesDir', async () => {
    requirePermission('employees.view')
    await revealEmployeeFilesDir()
  })
}

async function createEmployee(
  prisma: PrismaClient,
  input: EmployeeUpsertInput
): Promise<EmployeeRecord> {
  const data = normaliseInput(input)

  const existing = await prisma.employee.findUnique({ where: { code: data.code } })
  if (existing) throw new ApiError('CONFLICT', 'An employee with this code already exists')
  await assertDepartmentExists(prisma, data.departmentId)

  const employee = await prisma.employee.create({
    data: { ...data, status: ACTIVE_EMPLOYEE_STATUS, isActive: true },
    include: DEPARTMENT_INCLUDE
  })
  return toEmployeeRecord(employee)
}

async function updateEmployee(
  prisma: PrismaClient,
  id: string,
  input: EmployeeUpsertInput
): Promise<EmployeeRecord> {
  const data = normaliseInput(input)

  const target = await prisma.employee.findUnique({ where: { id } })
  if (!target) throw new ApiError('NOT_FOUND', 'Employee not found')

  if (data.code !== target.code) {
    const clash = await prisma.employee.findUnique({ where: { code: data.code } })
    if (clash) throw new ApiError('CONFLICT', 'An employee with this code already exists')
  }
  await assertDepartmentExists(prisma, data.departmentId)

  const employee = await prisma.employee.update({
    where: { id },
    // الحالة تُدار حصريًا عبر changeEmployeeStatus — التعديل العادي لا يمسّها.
    data: { ...data, status: target.status, isActive: target.isActive },
    include: DEPARTMENT_INCLUDE
  })
  return toEmployeeRecord(employee)
}
