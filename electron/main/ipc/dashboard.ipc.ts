import { PrismaClient } from '@prisma/client'
import { getSession } from '../auth'
import type { IpcRegistry } from './registry'

/** لوحة التحكم: ملخص HR واحد يدير كل عدادات الصفحة. */
export function registerDashboardIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('dashboard:summary', async () => {
    const permissions = new Set(getSession()?.permissions ?? [])
    const allowed = {
      employees: permissions.has('employees.view'),
      leaves: permissions.has('leaves.view'),
      payrolls: permissions.has('payrolls.view'),
      departments: permissions.has('departments.view')
    }

    let employees = null
    if (allowed.employees) {
      const groups = await prisma.employee.groupBy({
        by: ['status'],
        _count: { _all: true }
      })
      const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
      const active = byStatus['active'] ?? 0
      const inactive = groups
        .filter((g) => g.status !== 'active')
        .reduce((sum, g) => sum + g._count._all, 0)

      const deptGroups = await prisma.employee.groupBy({
        by: ['departmentId'],
        where: { status: 'active', departmentId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { departmentId: 'desc' } },
        take: 8
      })
      const departments = await prisma.department.findMany({
        where: { id: { in: deptGroups.flatMap((g) => (g.departmentId ? [g.departmentId] : [])) } },
        select: { id: true, name: true }
      })
      const nameById = new Map(departments.map((d) => [d.id, d.name]))
      employees = {
        total: groups.reduce((sum, g) => sum + g._count._all, 0),
        active,
        inactive,
        byStatus,
        byDepartment: deptGroups
          .flatMap((g) => (g.departmentId ? [{ id: g.departmentId, count: g._count._all }] : []))
          .map((row) => ({ id: row.id, name: nameById.get(row.id) ?? '—', count: row.count }))
      }
    }

    let departments = null
    if (allowed.departments) {
      const [total, activeDep] = await Promise.all([
        prisma.department.count(),
        prisma.department.count({ where: { isActive: true } })
      ])
      departments = { total, active: activeDep }
    }

    let leaves = null
    if (allowed.leaves) {
      const groups = await prisma.leave.groupBy({
        by: ['status'],
        _count: { _all: true }
      })
      leaves = {
        total: groups.reduce((sum, g) => sum + g._count._all, 0),
        byStatus: Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
      }
    }

    let payrolls = null
    if (allowed.payrolls) {
      const [months, entries] = await Promise.all([
        prisma.payrollBatch.groupBy({ by: ['period'], _count: { _all: true } }),
        prisma.payrollEntry.count()
      ])
      const latest = await prisma.payrollBatch.findFirst({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        select: { period: true, type: true, originalName: true, uploadedAt: true }
      })
      payrolls = {
        months: months.length,
        entries,
        latest: latest
          ? {
              period: latest.period,
              type: latest.type,
              originalName: latest.originalName,
              uploadedAt: latest.uploadedAt.toISOString()
            }
          : null
      }
    }

    let transfers = null
    if (allowed.employees) {
      const [total, open] = await Promise.all([
        prisma.departmentTransfer.count(),
        prisma.departmentTransfer.count({ where: { toDate: null } })
      ])
      transfers = { total, open }
    }

    return { employees, departments, leaves, payrolls, transfers }
  })
}
