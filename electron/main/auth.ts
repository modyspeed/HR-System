import bcrypt from 'bcryptjs'
import { Prisma, PrismaClient } from '@prisma/client'
import { SUPER_ADMIN_ROLE_KEY } from '../../shared/permissions'
import { ApiError } from '../../shared/types'
import type { SessionUser, UserRecord } from '../../shared/types'

export const BCRYPT_COST = 10

export const userInclude = {
  role: { include: { permissions: { select: { permissionKey: true } } } }
} as const

export type UserWithRole = Prisma.UserGetPayload<{ include: typeof userInclude }>

/* ------------------------------- session store ------------------------------ */

let currentSession: SessionUser | null = null

export function getSession(): SessionUser | null {
  return currentSession
}

export function setSession(session: SessionUser | null): void {
  currentSession = session
}

export function requireAuth(): SessionUser {
  if (!currentSession) {
    throw new ApiError('UNAUTHENTICATED', 'Session expired — please sign in again')
  }
  return currentSession
}

export function requirePermission(permissionKey: string): SessionUser {
  const session = requireAuth()
  if (session.roleKey === SUPER_ADMIN_ROLE_KEY) return session
  if (!session.permissions.includes(permissionKey)) {
    throw new ApiError('FORBIDDEN', `Missing permission: ${permissionKey}`)
  }
  return session
}

/* --------------------------------- mappers ---------------------------------- */

export function toUserRecord(user: UserWithRole): UserRecord {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatarPath: user.avatarPath,
    roleId: user.roleId,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    role: {
      id: user.role.id,
      key: user.role.key,
      nameAr: user.role.nameAr,
      nameEn: user.role.nameEn,
      isSystem: user.role.isSystem
    }
  }
}

function toSessionUser(user: UserWithRole): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatarPath: user.avatarPath,
    roleId: user.roleId,
    roleKey: user.role.key,
    roleNameAr: user.role.nameAr,
    roleNameEn: user.role.nameEn,
    isActive: user.isActive,
    permissions: user.role.permissions.map((p) => p.permissionKey),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
  }
}

/* ---------------------------------- actions --------------------------------- */

export async function login(
  prisma: PrismaClient,
  username: string,
  password: string
): Promise<SessionUser> {
  if (!username || !password) {
    throw new ApiError('INVALID_CREDENTIALS', 'Username and password are required')
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: userInclude
  })

  // Identical error for both cases so usernames cannot be enumerated.
  if (!user || !user.isActive) {
    throw new ApiError('INVALID_CREDENTIALS', 'Invalid username or password')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new ApiError('INVALID_CREDENTIALS', 'Invalid username or password')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  })

  const session = toSessionUser(user)
  session.lastLoginAt = new Date().toISOString()
  currentSession = session
  return session
}

export function logout(): void {
  currentSession = null
}

export async function currentSessionUser(prisma: PrismaClient): Promise<SessionUser | null> {
  if (!currentSession) return null
  const user = await prisma.user.findUnique({
    where: { id: currentSession.id },
    include: userInclude
  })
  if (!user || !user.isActive) {
    currentSession = null
    return null
  }
  currentSession = toSessionUser(user)
  return currentSession
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}
