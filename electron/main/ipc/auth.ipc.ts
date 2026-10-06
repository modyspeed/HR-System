import { app, shell } from 'electron'
import { PrismaClient } from '@prisma/client'
import { login, logout, currentSessionUser } from '../auth'
import { getDbPath } from '../prisma'
import { readSettings } from './settings.ipc'
import type { IpcRegistry } from './registry'
export function registerAuthIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('auth:login', async (_event, payload: { username: string; password: string }) => {
    return login(prisma, payload.username, payload.password)
  })

  ipc.handle('auth:logout', async () => {
    logout()
  })

  ipc.handle('auth:me', async () => {
    return currentSessionUser(prisma)
  })

  // Public bootstrap data for the login screen (language before sign-in).
  ipc.handle('auth:bootstrap', async () => {
    return readSettings(prisma)
  })
}

export function registerSystemIpc(_prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('system:versions', async () => {
    return {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      app: app.getVersion()
    }
  })

  ipc.handle('system:revealDatabase', async () => {
    shell.showItemInFolder(getDbPath())
  })
}
