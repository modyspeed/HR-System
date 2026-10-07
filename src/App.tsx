import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { hasPermission } from '@shared/permissions'
import { AppShell } from '@/components/layout/AppShell'
import { Aurora } from '@/components/layout/Aurora'
import { BootScreen } from '@/components/feedback/BootScreen'
import { NoAccess } from '@/components/feedback/NoAccess'
import { Login } from '@/modules/auth/Login'
import { Dashboard } from '@/modules/dashboard/Dashboard'
import { UsersList } from '@/modules/users/UsersList'
import { RolesList } from '@/modules/roles/RolesList'
import { RoleEditor } from '@/modules/roles/RoleEditor'
import { DepartmentsList } from '@/modules/departments/DepartmentsList'
import { Profile } from '@/modules/profile/Profile'
import { Settings } from '@/modules/settings/Settings'

function Protected({
  permission,
  element
}: {
  permission?: string
  element: React.ReactElement
}) {
  const user = useAuthStore((state) => state.user)

  if (!user) return <Navigate to="/login" replace />
  if (permission && !hasPermission(user, permission)) return <NoAccess />
  return element
}

export function App() {
  const status = useAuthStore((state) => state.status)
  const hydrate = useAuthStore((state) => state.hydrate)
  const uiInitialized = useUiStore((state) => state.initialized)
  const hydrateUi = useUiStore((state) => state.hydrateUi)

  useEffect(() => {
    void hydrateUi()
    void hydrate()
  }, [hydrate, hydrateUi])

  if (!uiInitialized || status === 'idle' || status === 'loading') {
    return (
      <>
        <Aurora />
        <BootScreen />
      </>
    )
  }

  return (
    <>
      <Aurora />
      <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <Protected
            element={<AppShell />}
          />
        }
      >
        <Route index element={<Protected element={<Dashboard />} />} />
        <Route
          path="users"
          element={<Protected permission="users.view" element={<UsersList />} />}
        />
        <Route
          path="roles"
          element={<Protected permission="roles.view" element={<RolesList />} />}
        />
        <Route
          path="roles/new"
          element={<Protected permission="roles.create" element={<RoleEditor />} />}
        />
        <Route
          path="roles/:id"
          element={<Protected permission="roles.edit" element={<RoleEditor />} />}
        />
        <Route
          path="departments"
          element={
            <Protected permission="departments.view" element={<DepartmentsList />} />
          }
        />
        <Route path="profile" element={<Protected element={<Profile />} />} />
        <Route
          path="settings"
          element={<Protected permission="settings.view" element={<Settings />} />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
