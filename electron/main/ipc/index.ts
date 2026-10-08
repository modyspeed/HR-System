import { PrismaClient } from '@prisma/client'
import { registerAuthIpc, registerSystemIpc } from './auth.ipc'
import { registerDepartmentsIpc } from './departments.ipc'
import { registerEmployeesIpc } from './employees.ipc'
import { registerExportIpc } from './export.ipc'
import { registerLeavesIpc } from './leaves.ipc'
import { registerRolesIpc } from './roles.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { createIpcRegistry } from './registry'
import { registerUsersIpc } from './users.ipc'

export function registerAllIpc(prisma: PrismaClient): void {
  const ipc = createIpcRegistry()

  registerAuthIpc(prisma, ipc)
  registerUsersIpc(prisma, ipc)
  registerRolesIpc(prisma, ipc)
  registerDepartmentsIpc(prisma, ipc)
  registerEmployeesIpc(prisma, ipc)
  registerExportIpc(ipc)
  registerLeavesIpc(prisma, ipc)
  registerSettingsIpc(prisma, ipc)
  registerSystemIpc(prisma, ipc)
}
