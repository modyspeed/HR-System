/**
 * تقرير المعاشات (IPC): المحالون للمعاش والمؤهلون له، مع تاريخ كل منهم،
 * بفلتر سنة/شهر. المؤهلون هم من ما زال على قوة العمل وسيبلغ السن القانونية
 * (`RETIREABLE_EMPLOYEE_STATUSES`) — فيُعرف «من سيخرج في سنة كذا» مسبقًا.
 *
 * الحالة تُحدَّث قبل بناء التقرير حتى يظهر من بلغ السن القانونية اليوم بدل أن
 * ينتظر فتح شاشة الموظفين — `applyAutomaticRetirement` هي نفسها المستخدمة هناك.
 */
import type { PrismaClient } from '@prisma/client'
import type { RetirementsQuery } from '../../../shared/types'
import {
  RETIREABLE_EMPLOYEE_STATUSES,
  RETIRED_EMPLOYEE_STATUS
} from '../../../shared/employeeStatuses'
import { requirePermission } from '../auth'
import { applyAutomaticRetirement } from '../employee-status'
import { buildRetirementsReport } from '../retirements'
import type { IpcRegistry } from './registry'

export function registerRetirementsIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('retirements:list', async (_event, query: RetirementsQuery = {}) => {
    requirePermission('reviews.view')

    // من بلغ السن القانونية يُحال تلقائيًا قبل بناء التقرير.
    await applyAutomaticRetirement(prisma)

    const select = {
      id: true,
      code: true,
      name: true,
      birthDate: true,
      departmentId: true,
      status: true,
      department: { select: { name: true } },
      statusHistory: {
        where: { toStatus: RETIRED_EMPLOYEE_STATUS },
        orderBy: { changedAt: 'asc' },
        select: { changedAt: true, changedBy: true, reason: true }
      }
    } as const

    const [retired, eligible] = await Promise.all([
      prisma.employee.findMany({
        where: { status: RETIRED_EMPLOYEE_STATUS },
        orderBy: { code: 'asc' },
        select
      }),
      prisma.employee.findMany({
        where: { status: { in: [...RETIREABLE_EMPLOYEE_STATUSES] } },
        orderBy: { code: 'asc' },
        select
      })
    ])

    return buildRetirementsReport({
      query,
      employees: retired.map(toSourceRow),
      eligible: eligible.map(toSourceRow)
    })
  })
}

type EmployeeRow = {
  id: string
  code: string
  name: string
  birthDate: Date | null
  departmentId: string | null
  status: string
  department: { name: string } | null
  statusHistory: { changedAt: Date; changedBy: string | null; reason: string | null }[]
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
    retiredHistory: employee.statusHistory.map((row) => ({
      changedAt: row.changedAt.toISOString(),
      changedBy: row.changedBy,
      reason: row.reason
    }))
  }
}
