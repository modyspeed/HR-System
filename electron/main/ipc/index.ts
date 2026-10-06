import { PrismaClient } from '@prisma/client'
import { registerAuthIpc, registerSystemIpc } from './auth.ipc'
import { registerRolesIpc } from './roles.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { createIpcRegistry } from './registry'
import { registerUsersIpc } from './users.ipc'

export function registerAllIpc(prisma: PrismaClient): void {
  const ipc = createIpcRegistry()

  registerAuthIpc(prisma, ipc)
  registerUsersIpc(prisma, ipc)
  registerRolesIpc(prisma, ipc)
  registerSettingsIpc(prisma, ipc)
  registerSystemIpc(prisma, ipc)
}
