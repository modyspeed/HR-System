import { LayoutDashboard, Settings, ShieldCheck, UserCircle, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  /** Permission required to see & reach this destination. */
  permission?: string
  section: 'management' | 'account'
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, section: 'management' },
  { to: '/users', labelKey: 'nav.users', icon: Users, permission: 'users.view', section: 'management' },
  { to: '/roles', labelKey: 'nav.roles', icon: ShieldCheck, permission: 'roles.view', section: 'management' },
  { to: '/profile', labelKey: 'nav.profile', icon: UserCircle, section: 'account' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings.view', section: 'account' }
]
