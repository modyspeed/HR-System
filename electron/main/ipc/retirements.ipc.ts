/**
 * تقرير المعاشات (IPC): المحالون للمعاش مع تاريخ إحالتهم، بفلتر سنة/شهر.
 *
 * الحالة تُحدَّث قبل بناء التقرير حتى يظهر من بلغ السن القانونية اليوم بدل أن
 * ينتظر فتح شاشة الموظفين — `applyAutomaticRetirement` هي نفسها المستخدمة هناك.
 */
import type { PrismaClient } from '@prisma/client'
import type { RetirementsQuery } from '../../../shared/types'
import { RETIRED_EMPLOYEE_STATUS } from '../../../shared/employeeStatuses'
import { requirePermission } from '../auth'
import { applyAutomaticRetirement } from '../employee-status'
import { buildRetirementsReport } from '../retirements'
import type { IpcRegistry } from './registry'

export function registerRetirementsIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('retirements:list', async (_event, query: RetirementsQuery = {}) => {
    requirePermission('reviews.view')

    // من بلغ السن القانونية يُحال تلقائيًا قبل بناء التقرير.
    await applyAutomaticRetirement(prisma)

    const employees = await prisma.employee.findMany({
      where: { status: RETIRED_EMPLOYEE_STATUS },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        birthDate: true,
        departmentId: true,
        department: { select: { name: true } },
        statusHistory: {
          where: { toStatus: RETIRED_EMPLOYEE_STATUS },
          orderBy: { changedAt: 'asc' },
          select: { changedAt: true, changedBy: true, reason: true }
        }
      }
    })

    return buildRetirementsReport({
      query,
      employees: employees.map((employee) => ({
        id: employee.id,
        code: employee.code,
        name: employee.name,
        birthDate: employee.birthDate ? employee.birthDate.toISOString().slice(0, 10) : null,
        departmentId: employee.departmentId,
        departmentName: employee.department?.name ?? null,
        retiredHistory: employee.statusHistory.map((row) => ({
          changedAt: row.changedAt.toISOString(),
          changedBy: row.changedBy,
          reason: row.reason
        }))
      }))
    })
  })
}
