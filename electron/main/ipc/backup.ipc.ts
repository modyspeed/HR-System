import { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth'
import { createBackup, listBackups, removeBackup, restoreBackup, revealBackupsDir } from '../backup'
import type { IpcRegistry } from './registry'

export function registerBackupIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('backup:list', async () => {
    requirePermission('settings.view')
    return listBackups()
  })

  ipc.handle('backup:create', async () => {
    requirePermission('settings.edit')
    return createBackup(prisma)
  })

  ipc.handle('backup:restore', async (_event, fileName: string) => {
    requirePermission('settings.edit')
    return restoreBackup(prisma, fileName)
  })

  ipc.handle('backup:remove', async (_event, fileName: string) => {
    requirePermission('settings.edit')
    removeBackup(fileName)
  })

  ipc.handle('backup:revealDir', async () => {
    requirePermission('settings.view')
    await revealBackupsDir()
  })
}
