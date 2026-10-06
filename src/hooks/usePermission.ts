import { useAuthStore } from '@/store/authStore'
import { hasPermission, hasAnyPermission } from '@shared/permissions'

export function usePermission(permissionKey: string): boolean {
  const user = useAuthStore((state) => state.user)
  return hasPermission(user, permissionKey)
}

export function useAnyPermission(permissionKeys: string[]): boolean {
  const user = useAuthStore((state) => state.user)
  return hasAnyPermission(user, permissionKeys)
}

export function useIsSuperAdmin(): boolean {
  const user = useAuthStore((state) => state.user)
  return user?.roleKey === 'super_admin'
}
