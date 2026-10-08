/**
 * Employee status transitions (تغيير الحالة الوظيفية) with a full audit trail.
 *
 * `status` is the authoritative field; `isActive` on the row is kept derived
 * from it (`active` is the only live status). Every change appends a row to
 * `EmployeeStatusHistory` recording the acting user and the reason, so the
 * dossier always shows the complete timeline of statuses.
 */
import { PrismaClient } from '@prisma/client'
import { ApiError } from '../../shared/types'
import type { EmployeeStatusHistoryRecord } from '../../shared/types'
import {
  EMPLOYEE_STATUS_KEYS,
  isActiveStatus
} from '../../shared/employeeStatuses'

type HistoryRow = {
  id: string
  employeeId: string
  fromStatus: string
  toStatus: string
  reason: string | null
  changedBy: string | null
  changedAt: Date
}

export function toStatusHistoryRecord(row: HistoryRow): EmployeeStatusHistoryRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    changedBy: row.changedBy,
    changedAt: row.changedAt.toISOString()
  }
}

/**
 * Changes the employee's status and logs the transition.
 * Transitioning to the current status is an idempotent no-op (no history row).
 */
export async function changeEmployeeStatus(
  prisma: PrismaClient,
  employeeId: string,
  input: { status: string; reason?: string },
  changedBy: string | null = null
): Promise<void> {
  const status = input.status?.trim()
  if ((EMPLOYEE_STATUS_KEYS as readonly string[]).indexOf(status) === -1) {
    throw new ApiError('VALIDATION', 'Unknown employee status')
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
  if (employee.status === status) return

  const reason = input.reason?.trim() || null
  await prisma.$transaction([
    prisma.employee.update({
      where: { id: employeeId },
      data: { status, isActive: isActiveStatus(status) }
    }),
    prisma.employeeStatusHistory.create({
      data: {
        employeeId,
        fromStatus: employee.status,
        toStatus: status,
        reason,
        changedBy: changedBy || null
      }
    })
  ])
}

/** Full status timeline, newest first. */
export async function getStatusHistory(
  prisma: PrismaClient,
  employeeId: string
): Promise<EmployeeStatusHistoryRecord[]> {
  const rows = await prisma.employeeStatusHistory.findMany({
    where: { employeeId },
    orderBy: { changedAt: 'desc' }
  })
  return rows.map(toStatusHistoryRecord)
}
