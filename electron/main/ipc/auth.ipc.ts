import { app, shell } from 'electron'
import { PrismaClient } from '@prisma/client'
import { login, logout, currentSessionUser, requireAuth } from '../auth'
import { getDbPath } from '../prisma'
import { ApiError } from '../../../shared/types'
import { readSettings } from './settings.ipc'
import type { IpcRegistry } from './registry'

const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCK_MS = 30_000
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()

function assertLoginAllowed(username: string): string {
  const key = (username ?? '').trim().toLowerCase()
  const entry = loginAttempts.get(key)
  if (entry && entry.lockedUntil > Date.now()) {
    throw new ApiError('TOO_MANY_ATTEMPTS', 'Too many failed attempts — try again shortly')
  }
  return key
}

export function registerAuthIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('auth:login', async (_event, payload: { username: string; password: string }) => {
    const key = assertLoginAllowed(payload?.username ?? '')
    try {
      const session = await login(prisma, payload.username, payload.password)
      loginAttempts.delete(key)
      return session
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        const entry = loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 }
        entry.count += 1
        if (entry.count >= MAX_LOGIN_ATTEMPTS) {
          entry.lockedUntil = Date.now() + LOGIN_LOCK_MS
          entry.count = 0
        }
        loginAttempts.set(key, entry)
      }
      throw error
    }
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
    requireAuth()
    shell.showItemInFolder(getDbPath())
  })
}
