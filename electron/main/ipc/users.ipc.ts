import { Prisma, PrismaClient } from '@prisma/client'
import { SUPER_ADMIN_ROLE_KEY } from '../../../shared/permissions'
import { ApiError } from '../../../shared/types'
import type {
  ChangePasswordInput,
  ListUsersQuery,
  UniquenessCheck,
  UserCreateInput,
  UserRecord,
  UserUpdateInput
} from '../../../shared/types'
import {
  hashPassword,
  requireAuth,
  requirePermission,
  toUserRecord,
  userInclude,
  type UserWithRole
} from '../auth'
import type { IpcRegistry } from './registry'

export function registerUsersIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('users:list', async (_event, query: ListUsersQuery) => {
    requirePermission('users.view')
    return listUsers(prisma, query)
  })

  ipc.handle('users:getById', async (_event, id: string) => {
    requirePermission('users.view')
    const user = await prisma.user.findUnique({ where: { id }, include: userInclude })
    return user ? toUserRecord(user) : null
  })

  ipc.handle('users:create', async (_event, input: UserCreateInput) => {
    const session = requirePermission('users.create')
    return createUser(prisma, input, session.roleKey)
  })

  ipc.handle('users:update', async (_event, id: string, input: UserUpdateInput) => {
    const session = requirePermission('users.edit')
    return updateUser(prisma, id, input, session.roleKey)
  })

  ipc.handle('users:setStatus', async (_event, id: string, isActive: boolean) => {
    requirePermission('users.manage_status')
    return setUserStatus(prisma, id, isActive)
  })

  ipc.handle('users:remove', async (_event, id: string) => {
    requirePermission('users.delete')
    return removeUser(prisma, id)
  })

  ipc.handle('users:checkUnique', async (_event, check: UniquenessCheck) => {
    requirePermission('users.view')
    return checkUnique(prisma, check)
  })

  ipc.handle('users:changePassword', async (_event, payload: ChangePasswordInput) => {
    const session = requireAuth()
    return changeOwnPassword(prisma, session.id, payload)
  })
}

/* ------------------------------- implementations ---------------------------- */

export async function listUsers(prisma: PrismaClient, query: ListUsersQuery): Promise<UserRecord[]> {
  const where: Prisma.UserWhereInput = {}

  if (query.search) {
    where.OR = [
      { username: { contains: query.search } },
      { fullName: { contains: query.search } },
      { email: { contains: query.search } }
    ]
  }
  if (query.roleId) where.roleId = query.roleId
  if (typeof query.isActive === 'boolean') where.isActive = query.isActive

  const rows = await prisma.user.findMany({
    where,
    include: userInclude,
    orderBy: { [query.sort ?? 'createdAt']: query.order ?? 'desc' }
  })

  return rows.map((row) => toUserRecord(row as UserWithRole))
}

/**
 * Only an existing super admin may grant super admin to another account,
 * even if the acting role holds users.create/users.edit.
 */
function guardSuperAdminPromotion(targetRoleKey: string, actingRoleKey: string): void {
  if (targetRoleKey === SUPER_ADMIN_ROLE_KEY && actingRoleKey !== SUPER_ADMIN_ROLE_KEY) {
    throw new ApiError('FORBIDDEN', 'Only a super admin can assign the super admin role')
  }
}

async function assertFree(
  prisma: PrismaClient,
  username: string | undefined,
  email: string | null | undefined,
  excludeId?: string | null
): Promise<void> {
  if (username) {
    const clash = await prisma.user.findUnique({ where: { username } })
    if (clash && clash.id !== excludeId) {
      throw new ApiError('CONFLICT', 'Username is already taken')
    }
  }
  if (email) {
    const clash = await prisma.user.findUnique({ where: { email } })
    if (clash && clash.id !== excludeId) {
      throw new ApiError('CONFLICT', 'Email is already in use')
    }
  }
}

export async function checkUnique(
  prisma: PrismaClient,
  check: UniquenessCheck
): Promise<{ username: boolean; email: boolean }> {
  const [usernameTaken, emailTaken] = await Promise.all([
    check.username
      ? prisma.user.findUnique({ where: { username: check.username } })
      : Promise.resolve(null),
    check.email ? prisma.user.findUnique({ where: { email: check.email } }) : Promise.resolve(null)
  ])
  return {
    username: Boolean(usernameTaken && usernameTaken.id !== check.excludeId),
    email: Boolean(emailTaken && emailTaken.id !== check.excludeId)
  }
}

export async function createUser(
  prisma: PrismaClient,
  input: UserCreateInput,
  actingRoleKey: string
): Promise<UserRecord> {
  await assertFree(prisma, input.username, input.email)

  const role = await prisma.role.findUnique({ where: { id: input.roleId } })
  if (!role) throw new ApiError('VALIDATION', 'Selected role does not exist')
  guardSuperAdminPromotion(role.key, actingRoleKey)

  const user = await prisma.user.create({
    data: {
      username: input.username.trim(),
      email: input.email?.trim() || null,
      fullName: input.fullName.trim(),
      passwordHash: await hashPassword(input.password),
      roleId: input.roleId,
      isActive: input.isActive ?? true
    },
    include: userInclude
  })

  return toUserRecord(user as UserWithRole)
}

export async function updateUser(
  prisma: PrismaClient,
  id: string,
  input: UserUpdateInput,
  actingRoleKey: string
): Promise<UserRecord> {
  const target = await prisma.user.findUnique({ where: { id }, include: userInclude })
  if (!target) throw new ApiError('NOT_FOUND', 'User not found')

  if (target.role.key === SUPER_ADMIN_ROLE_KEY && input.isActive === false) {
    throw new ApiError('SUPER_ADMIN_PROTECTED', 'The super admin account cannot be deactivated')
  }
  if (target.role.key === SUPER_ADMIN_ROLE_KEY && input.roleId && input.roleId !== target.roleId) {
    throw new ApiError('SUPER_ADMIN_PROTECTED', 'The super admin account cannot change roles')
  }

  await assertFree(prisma, input.username, input.email, id)

  if (input.roleId && input.roleId !== target.roleId) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } })
    if (!role) throw new ApiError('VALIDATION', 'Selected role does not exist')
    guardSuperAdminPromotion(role.key, actingRoleKey)
  }

  const data: Prisma.UserUpdateInput = {}
  if (input.username !== undefined) data.username = input.username.trim()
  if (input.email !== undefined) data.email = input.email?.trim() || null
  if (input.fullName !== undefined) data.fullName = input.fullName.trim()
  if (input.roleId !== undefined) data.role = { connect: { id: input.roleId } }
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.password) data.passwordHash = await hashPassword(input.password)

  const updated = await prisma.user.update({ where: { id }, data, include: userInclude })
  return toUserRecord(updated as UserWithRole)
}

export async function setUserStatus(
  prisma: PrismaClient,
  id: string,
  isActive: boolean
): Promise<UserRecord> {
  const target = await prisma.user.findUnique({ where: { id }, include: userInclude })
  if (!target) throw new ApiError('NOT_FOUND', 'User not found')

  if (target.role.key === SUPER_ADMIN_ROLE_KEY && !isActive) {
    throw new ApiError('SUPER_ADMIN_PROTECTED', 'The super admin account cannot be deactivated')
  }

  if (!isActive) {
    const activeSuperAdmins = await prisma.user.count({
      where: { isActive: true, role: { key: SUPER_ADMIN_ROLE_KEY } }
    })
    if (activeSuperAdmins <= 1) {
      throw new ApiError('LAST_SUPER_ADMIN', 'At least one active super admin must remain')
    }
  }

  const updated = await prisma.user.update({ where: { id }, data: { isActive }, include: userInclude })
  return toUserRecord(updated as UserWithRole)
}

export async function removeUser(prisma: PrismaClient, id: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id }, include: userInclude })
  if (!target) return

  if (target.role.key === SUPER_ADMIN_ROLE_KEY) {
    throw new ApiError('SUPER_ADMIN_PROTECTED', 'The super admin account cannot be deleted')
  }

  await prisma.user.delete({ where: { id } })
}

async function changeOwnPassword(
  prisma: PrismaClient,
  userId: string,
  payload: { currentPassword: string; newPassword: string }
): Promise<void> {
  if (!payload.newPassword || payload.newPassword.length < 6) {
    throw new ApiError('VALIDATION', 'Password must be at least 6 characters')
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const { compare } = await import('bcryptjs')
  const valid = await compare(payload.currentPassword, user.passwordHash)
  if (!valid) throw new ApiError('INVALID_CREDENTIALS', 'Current password is incorrect')

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(payload.newPassword) }
  })
}
