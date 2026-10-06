import { Prisma, PrismaClient } from '@prisma/client'
import { ApiError } from '../../../shared/types'
import type { RoleRecord, RoleUpsertInput } from '../../../shared/types'
import { requirePermission } from '../auth'
import type { IpcRegistry } from './registry'

const roleInclude = {
  permissions: { select: { permissionKey: true } },
  _count: { select: { users: true } }
} as const

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>

function toRoleRecord(role: RoleRow): RoleRecord {
  return {
    id: role.id,
    key: role.key,
    nameAr: role.nameAr,
    nameEn: role.nameEn,
    isSystem: role.isSystem,
    permissions: role.permissions.map((p) => p.permissionKey),
    _count: { users: role._count.users }
  }
}

export function registerRolesIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('roles:list', async () => {
    requirePermission('roles.view')
    const roles = await prisma.role.findMany({ include: roleInclude, orderBy: { key: 'asc' } })
    return roles.map(toRoleRecord)
  })

  ipc.handle('roles:getById', async (_event, id: string) => {
    requirePermission('roles.view')
    const role = await prisma.role.findUnique({ where: { id }, include: roleInclude })
    return role ? toRoleRecord(role) : null
  })

  ipc.handle('roles:create', async (_event, input: RoleUpsertInput) => {
    requirePermission('roles.create')
    return createRole(prisma, input)
  })

  ipc.handle('roles:update', async (_event, id: string, input: RoleUpsertInput) => {
    requirePermission('roles.edit')
    return updateRole(prisma, id, input)
  })

  ipc.handle('roles:remove', async (_event, id: string) => {
    requirePermission('roles.delete')
    return removeRole(prisma, id)
  })

  ipc.handle('roles:setPermissions', async (_event, id: string, keys: string[]) => {
    requirePermission('roles.edit')
    return replacePermissions(prisma, id, keys)
  })
}

function normaliseKey(key: string): string {
  return key.trim().replace(/\s+/g, '_').toUpperCase()
}

async function createRole(prisma: PrismaClient, input: RoleUpsertInput): Promise<RoleRecord> {
  if (!input.nameAr.trim() || !input.nameEn.trim()) {
    throw new ApiError('VALIDATION', 'Both role names are required')
  }
  const key = normaliseKey(input.key)
  if (!key) throw new ApiError('VALIDATION', 'Role key is required')

  const existing = await prisma.role.findUnique({ where: { key } })
  if (existing) throw new ApiError('CONFLICT', 'A role with this key already exists')

  const role = await prisma.role.create({
    data: {
      key,
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn.trim(),
      isSystem: false,
      permissions: { create: input.permissions.map((permissionKey) => ({ permissionKey })) }
    },
    include: roleInclude
  })
  return toRoleRecord(role)
}

async function updateRole(
  prisma: PrismaClient,
  id: string,
  input: RoleUpsertInput
): Promise<RoleRecord> {
  const role = await prisma.role.findUnique({ where: { id }, include: roleInclude })
  if (!role) throw new ApiError('NOT_FOUND', 'Role not found')
  if (role.isSystem && normaliseKey(input.key) !== role.key) {
    throw new ApiError('SYSTEM_ROLE', 'System role keys are immutable')
  }
  if (!input.nameAr.trim() || !input.nameEn.trim()) {
    throw new ApiError('VALIDATION', 'Both role names are required')
  }

  const key = normaliseKey(input.key)
  const clash = await prisma.role.findUnique({ where: { key } })
  if (clash && clash.id !== id) throw new ApiError('CONFLICT', 'A role with this key already exists')

  const updated = await prisma.role.update({
    where: { id },
    data: {
      key,
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn.trim(),
      permissions: {
        deleteMany: {},
        create: input.permissions.map((permissionKey) => ({ permissionKey }))
      }
    },
    include: roleInclude
  })
  return toRoleRecord(updated)
}

async function removeRole(prisma: PrismaClient, id: string): Promise<void> {
  const role = await prisma.role.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } })
  if (role.isSystem) throw new ApiError('SYSTEM_ROLE', 'System roles cannot be deleted')
  if (role._count.users > 0) {
    throw new ApiError('CONFLICT', 'Reassign or remove all users before deleting this role')
  }
  await prisma.role.delete({ where: { id } })
}

async function replacePermissions(
  prisma: PrismaClient,
  id: string,
  keys: string[]
): Promise<RoleRecord> {
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) throw new ApiError('NOT_FOUND', 'Role not found')

  const updated = await prisma.role.update({
    where: { id },
    data: {
      permissions: {
        deleteMany: {},
        create: keys.map((permissionKey) => ({ permissionKey }))
      }
    },
    include: roleInclude
  })
  return toRoleRecord(updated)
}
