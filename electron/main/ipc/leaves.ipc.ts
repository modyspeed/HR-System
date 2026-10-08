import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type { LeaveRecord, LeaveUpsertInput, ListLeavesQuery } from '../../../shared/types'
import { LEAVE_STATUS_KEYS, LEAVE_TYPE_KEYS } from '../../../shared/leaves'
import { requirePermission } from '../auth'
import {
  attachLeaveFile,
  previewLeaveFile,
  removeLeaveFile,
  revealLeaveFilesDir
} from '../leave-files'
import type { IpcRegistry } from './registry'

const LEAVE_INCLUDE = { employee: { select: { code: true, name: true } } } as const

type LeaveRow = Prisma.LeaveGetPayload<{ include: typeof LEAVE_INCLUDE }>

function toLeaveRecord(leave: LeaveRow): LeaveRecord {
  return {
    id: leave.id,
    employeeId: leave.employeeId,
    employeeCode: leave.employee.code,
    employeeName: leave.employee.name,
    type: leave.type,
    startDate: leave.startDate.toISOString().slice(0, 10),
    endDate: leave.endDate.toISOString().slice(0, 10),
    daysCount: leave.daysCount,
    year: leave.year,
    reason: leave.reason,
    status: leave.status,
    fileOriginalName: leave.fileOriginalName,
    fileSize: leave.fileSize,
    fileLinkedAt: leave.fileLinkedAt ? leave.fileLinkedAt.toISOString() : null,
    createdAt: leave.createdAt.toISOString(),
    updatedAt: leave.updatedAt.toISOString()
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function inclusiveDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function normaliseInput(input: LeaveUpsertInput): {
  employeeId: string
  type: string
  startDate: Date
  endDate: Date
  daysCount: number
  year: number
  reason: string | null
  status: string
} {
  const employeeId = input.employeeId?.trim()
  const type = input.type?.trim()
  const status = input.status?.trim() || 'pending'
  if (!employeeId) throw new ApiError('VALIDATION', 'Employee is required')
  if ((LEAVE_TYPE_KEYS as readonly string[]).indexOf(type) === -1) {
    throw new ApiError('VALIDATION', 'Unknown leave type')
  }
  if ((LEAVE_STATUS_KEYS as readonly string[]).indexOf(status) === -1) {
    throw new ApiError('VALIDATION', 'Unknown leave status')
  }

  const startDate = input.startDate?.trim()
  const endDate = input.endDate?.trim()
  if (!startDate || !ISO_DATE.test(startDate) || !endDate || !ISO_DATE.test(endDate)) {
    throw new ApiError('VALIDATION', 'Leave dates must use the yyyy-mm-dd format')
  }

  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  if (end < start) {
    throw new ApiError('VALIDATION', 'End date cannot be before the start date')
  }

  const days = input.daysCount && input.daysCount > 0 ? Math.round(input.daysCount) : inclusiveDays(start, end)
  if (days > 366) throw new ApiError('VALIDATION', 'Leave duration cannot exceed 366 days')

  return {
    employeeId,
    type,
    startDate: start,
    endDate: end,
    daysCount: days,
    year: input.year ?? start.getUTCFullYear(),
    reason: input.reason?.trim() || null,
    status
  }
}

async function assertEmployeeExists(
  prisma: PrismaClient,
  employeeId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma
  const employee = await client.employee.findUnique({ where: { id: employeeId } })
  if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
}

export function registerLeavesIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('leaves:list', async (_event, query: ListLeavesQuery = {}) => {
    requirePermission('leaves.view')

    const where: Prisma.LeaveWhereInput = {}
    const search = query.search?.trim()
    if (search) {
      where.OR = [
        { employee: { code: { contains: search } } },
        { employee: { name: { contains: search } } }
      ]
    }
    if (query.type) where.type = query.type
    if (query.status) where.status = query.status
    if (query.year !== null && query.year !== undefined) where.year = query.year

    const leaves = await prisma.leave.findMany({
      where,
      include: LEAVE_INCLUDE,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }]
    })
    return leaves.map(toLeaveRecord)
  })

  ipc.handle('leaves:getById', async (_event, id: string) => {
    requirePermission('leaves.view')
    const leave = await prisma.leave.findUnique({ where: { id }, include: LEAVE_INCLUDE })
    return leave ? toLeaveRecord(leave) : null
  })

  ipc.handle('leaves:create', async (_event, input: LeaveUpsertInput) => {
    requirePermission('leaves.create')
    const data = normaliseInput(input)
    await assertEmployeeExists(prisma, data.employeeId)
    const leave = await prisma.leave.create({ data, include: LEAVE_INCLUDE })
    return toLeaveRecord(leave)
  })

  ipc.handle('leaves:update', async (_event, id: string, input: LeaveUpsertInput) => {
    requirePermission('leaves.edit')
    const data = normaliseInput(input)
    const target = await prisma.leave.findUnique({ where: { id } })
    if (!target) throw new ApiError('NOT_FOUND', 'Leave not found')
    await assertEmployeeExists(prisma, data.employeeId)
    const leave = await prisma.leave.update({ where: { id }, data, include: LEAVE_INCLUDE })
    return toLeaveRecord(leave)
  })

  ipc.handle('leaves:remove', async (_event, id: string) => {
    requirePermission('leaves.delete')
    await prisma.leave.delete({ where: { id } })
  })

  ipc.handle(
    'leaves:attachFile',
    async (_event, payload: { id: string; data: ArrayBuffer; fileName: string }) => {
      requirePermission('leaves.edit')
      await attachLeaveFile(prisma, payload.id, Buffer.from(payload.data), payload.fileName)
      const leave = await prisma.leave.findUnique({ where: { id: payload.id }, include: LEAVE_INCLUDE })
      if (!leave) throw new ApiError('NOT_FOUND', 'Leave not found')
      return toLeaveRecord(leave)
    }
  )

  ipc.handle('leaves:removeFile', async (_event, id: string) => {
    requirePermission('leaves.edit')
    await removeLeaveFile(prisma, id)
    const leave = await prisma.leave.findUnique({ where: { id }, include: LEAVE_INCLUDE })
    if (!leave) throw new ApiError('NOT_FOUND', 'Leave not found')
    return toLeaveRecord(leave)
  })

  ipc.handle('leaves:previewFile', async (_event, id: string) => {
    requirePermission('leaves.view')
    return previewLeaveFile(prisma, id)
  })

  ipc.handle('leaves:revealFilesDir', async () => {
    requirePermission('leaves.view')
    await revealLeaveFilesDir()
  })
}
