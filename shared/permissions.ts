/**
 * Permission catalogue. Phase 1 covers users / roles / settings.
 * Future modules extend this map — every consumer derives from here.
 */
export const MODULE_PERMISSIONS = {
  users: ['users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_status'],
  roles: ['roles.view', 'roles.create', 'roles.edit', 'roles.delete'],
  departments: [
    'departments.view',
    'departments.create',
    'departments.edit',
    'departments.delete',
    'departments.import'
  ],
  employees: ['employees.view', 'employees.create', 'employees.edit', 'employees.delete', 'employees.import'],
  settings: ['settings.view', 'settings.edit']
} as const

export type PermissionModule = keyof typeof MODULE_PERMISSIONS

export const ALL_PERMISSION_KEYS: readonly string[] = Object.values(MODULE_PERMISSIONS).flat()

export const PERMISSION_MODULES: PermissionModule[] = Object.keys(
  MODULE_PERMISSIONS
) as PermissionModule[]

export const SUPER_ADMIN_ROLE_KEY = 'super_admin'

/**
 * Unified permission logic — shared between the main process (trusted layer)
 * and the renderer (UX layer). `super_admin` implicitly bypasses everything.
 */
export interface PermissionHolder {
  roleKey: string
  permissions: string[]
}

export function hasPermission(holder: PermissionHolder | null, key: string): boolean {
  if (!holder) return false
  if (holder.roleKey === SUPER_ADMIN_ROLE_KEY) return true
  return holder.permissions.includes(key)
}

export function hasAnyPermission(holder: PermissionHolder | null, keys: string[]): boolean {
  if (!holder) return false
  if (holder.roleKey === SUPER_ADMIN_ROLE_KEY) return true
  return keys.some((k) => holder.permissions.includes(k))
}
