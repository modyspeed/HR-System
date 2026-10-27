import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { hasPermission } from '@shared/permissions'
import { AppShell } from '@/components/layout/AppShell'
import { Aurora } from '@/components/layout/Aurora'
import { BootScreen } from '@/components/feedback/BootScreen'
import { NoAccess } from '@/components/feedback/NoAccess'
import { preloadWhenIdle } from '@/lib/performance'
import { Login } from '@/modules/auth/Login'
import { Dashboard } from '@/modules/dashboard/Dashboard'

// Heavy screens are split into their own chunks so startup only parses the
// login + dashboard code; the rest is warmed in the background once idle.
const loadUsersList = () => import('@/modules/users/UsersList')
const loadRolesList = () => import('@/modules/roles/RolesList')
const loadRoleEditor = () => import('@/modules/roles/RoleEditor')
const loadDepartmentsList = () => import('@/modules/departments/DepartmentsList')
const loadEmployeesList = () => import('@/modules/employees/EmployeesList')
const loadEmployeeProfile = () => import('@/modules/employees/EmployeeProfile')
const loadLeavesList = () => import('@/modules/leaves/LeavesList')
const loadPayrollsList = () => import('@/modules/payrolls/PayrollsList')
const loadReviewsList = () => import('@/modules/reviews/ReviewsList')
const loadProfile = () => import('@/modules/profile/Profile')
const loadSettings = () => import('@/modules/settings/Settings')

const UsersList = lazy(() => loadUsersList().then((m) => ({ default: m.UsersList })))
const RolesList = lazy(() => loadRolesList().then((m) => ({ default: m.RolesList })))
const RoleEditor = lazy(() => loadRoleEditor().then((m) => ({ default: m.RoleEditor })))
const DepartmentsList = lazy(() =>
  loadDepartmentsList().then((m) => ({ default: m.DepartmentsList }))
)
const EmployeesList = lazy(() => loadEmployeesList().then((m) => ({ default: m.EmployeesList })))
const EmployeeProfile = lazy(() =>
  loadEmployeeProfile().then((m) => ({ default: m.EmployeeProfile }))
)
const LeavesList = lazy(() => loadLeavesList().then((m) => ({ default: m.LeavesList })))
const PayrollsList = lazy(() => loadPayrollsList().then((m) => ({ default: m.PayrollsList })))
const ReviewsList = lazy(() => loadReviewsList().then((m) => ({ default: m.ReviewsList })))
const Profile = lazy(() => loadProfile().then((m) => ({ default: m.Profile })))
const Settings = lazy(() => loadSettings().then((m) => ({ default: m.Settings })))

const ROUTE_LOADERS = [
  loadEmployeesList,
  loadEmployeeProfile,
  loadDepartmentsList,
  loadLeavesList,
  loadPayrollsList,
  loadReviewsList,
  loadUsersList,
  loadRolesList,
  loadRoleEditor,
  loadProfile,
  loadSettings
]

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

  const signedIn = status === 'authenticated'
  useEffect(() => {
    if (signedIn) preloadWhenIdle(ROUTE_LOADERS)
  }, [signedIn])

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
        <Route
          path="employees"
          element={<Protected permission="employees.view" element={<EmployeesList />} />}
        />
        <Route
          path="employees/:id"
          element={<Protected permission="employees.view" element={<EmployeeProfile />} />}
        />
        <Route
          path="leaves"
          element={<Protected permission="leaves.view" element={<LeavesList />} />}
        />
        <Route
          path="payrolls"
          element={<Protected permission="payrolls.view" element={<PayrollsList />} />}
        />
        <Route
          path="reviews"
          element={<Protected permission="reviews.view" element={<ReviewsList />} />}
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
