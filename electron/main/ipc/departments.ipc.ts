import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type {
  DepartmentImportRow,
  DepartmentImportSummary,
  DepartmentParseResult,
  DepartmentRecord,
  DepartmentUpsertInput,
  ListDepartmentsQuery
} from '../../../shared/types'
import { requirePermission } from '../auth'
import {
  parseDepartmentsFile,
  validateImportRow
} from '../import/departmentsImport'
import type { IpcRegistry } from './registry'

type DepartmentRow = Prisma.DepartmentGetPayload<Record<string, never>>

function toDepartmentRecord(department: DepartmentRow): DepartmentRecord {
  return {
    id: department.id,
    code: department.code,
    name: department.name,
    natureAllowancePct: department.natureAllowancePct,
    isActive: department.isActive,
    createdAt: department.createdAt.toISOString(),
    updatedAt: department.updatedAt.toISOString()
  }
}

function normaliseInput(input: DepartmentUpsertInput): {
  code: string
  name: string
  natureAllowancePct: number | null
  isActive: boolean
} {
  const code = input.code.trim()
  const name = input.name.trim()
  if (!code) throw new ApiError('VALIDATION', 'Department code is required')
  if (!name) throw new ApiError('VALIDATION', 'Department name is required')

  const pct = input.natureAllowancePct ?? null
  if (pct !== null && (pct < 0 || pct > 100)) {
    throw new ApiError('VALIDATION', 'Nature of work allowance must be between 0 and 100')
  }

  return { code, name, natureAllowancePct: pct, isActive: input.isActive ?? true }
}

export function registerDepartmentsIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('departments:list', async (_event, query: ListDepartmentsQuery = {}) => {
    requirePermission('departments.view')

    const where: Prisma.DepartmentWhereInput = {}
    const search = query.search?.trim()
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } }
      ]
    }
    if (query.isActive !== null && query.isActive !== undefined) {
      where.isActive = query.isActive
    }

    const order = query.order ?? 'asc'
    const orderBy: Prisma.DepartmentOrderByWithRelationInput = {
      [query.sort ?? 'code']: order
    }

    const departments = await prisma.department.findMany({ where, orderBy })
    return departments.map(toDepartmentRecord)
  })

  ipc.handle('departments:getById', async (_event, id: string) => {
    requirePermission('departments.view')
    const department = await prisma.department.findUnique({ where: { id } })
    return department ? toDepartmentRecord(department) : null
  })

  ipc.handle('departments:create', async (_event, input: DepartmentUpsertInput) => {
    requirePermission('departments.create')
    return createDepartment(prisma, input)
  })

  ipc.handle('departments:update', async (_event, id: string, input: DepartmentUpsertInput) => {
    requirePermission('departments.edit')
    return updateDepartment(prisma, id, input)
  })

  ipc.handle('departments:remove', async (_event, id: string) => {
    requirePermission('departments.delete')
    await prisma.department.delete({ where: { id } })
  })

  ipc.handle(
    'departments:parseImportFile',
    async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
      requirePermission('departments.import')
      const result = await parseDepartmentsFile(Buffer.from(payload.data), payload.fileName)
      return result satisfies DepartmentParseResult
    }
  )

  ipc.handle('departments:importRows', async (_event, rows: DepartmentImportRow[]) => {
    requirePermission('departments.import')
    return importDepartments(prisma, rows)
  })
}

async function createDepartment(
  prisma: PrismaClient,
  input: DepartmentUpsertInput
): Promise<DepartmentRecord> {
  const data = normaliseInput(input)

  const existing = await prisma.department.findUnique({ where: { code: data.code } })
  if (existing) throw new ApiError('CONFLICT', 'A department with this code already exists')

  const department = await prisma.department.create({ data })
  return toDepartmentRecord(department)
}

async function updateDepartment(
  prisma: PrismaClient,
  id: string,
  input: DepartmentUpsertInput
): Promise<DepartmentRecord> {
  const data = normaliseInput(input)

  const target = await prisma.department.findUnique({ where: { id } })
  if (!target) throw new ApiError('NOT_FOUND', 'Department not found')

  if (data.code !== target.code) {
    const clash = await prisma.department.findUnique({ where: { code: data.code } })
    if (clash) throw new ApiError('CONFLICT', 'A department with this code already exists')
  }

  const department = await prisma.department.update({ where: { id }, data })
  return toDepartmentRecord(department)
}

async function importDepartments(
  prisma: PrismaClient,
  rows: DepartmentImportRow[]
): Promise<DepartmentImportSummary> {
  let created = 0
  let updated = 0
  let skipped = 0

  await prisma.$transaction(
    async (tx) => {
      const validRows = rows.filter((row) => {
        if (validateImportRow(row)) {
          skipped += 1
          return false
        }
        return true
      })

      const codes = [...new Set(validRows.map((row) => row.code.trim()))]
      const existing = await tx.department.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true }
      })
      const existingByCode = new Map(existing.map((row) => [row.code, row.id]))

      for (const row of validRows) {
        const code = row.code.trim()
        const data = {
          code,
          name: row.name.trim(),
          natureAllowancePct: row.natureAllowancePct
        }

        const existingId = existingByCode.get(code)
        if (existingId) {
          // Re-importing refreshes the data but keeps the current active status.
          await tx.department.update({ where: { id: existingId }, data })
          updated += 1
        } else {
          const record = await tx.department.create({ data: { ...data, isActive: true } })
          existingByCode.set(code, record.id)
          created += 1
        }
      }
    },
    { timeout: 30_000 }
  )

  return { created, updated, skipped }
}
