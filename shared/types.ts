/** Domain + IPC contract shared between main, preload and renderer. */

export interface SessionUser {
  id: string
  username: string
  email: string | null
  fullName: string
  avatarPath: string | null
  roleId: string
  roleKey: string
  roleNameAr: string
  roleNameEn: string
  isActive: boolean
  permissions: string[]
  lastLoginAt: string | null
}

export interface UserRecord {
  id: string
  username: string
  email: string | null
  fullName: string
  avatarPath: string | null
  roleId: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  role: {
    id: string
    key: string
    nameAr: string
    nameEn: string
    isSystem: boolean
  }
}

export interface RoleRecord {
  id: string
  key: string
  nameAr: string
  nameEn: string
  isSystem: boolean
  permissions: string[]
  _count?: { users: number }
}

export interface ListUsersQuery {
  search?: string
  roleId?: string | null
  isActive?: boolean | null
  sort?: 'username' | 'fullName' | 'createdAt' | 'lastLoginAt'
  order?: 'asc' | 'desc'
}

export interface UserCreateInput {
  username: string
  email?: string | null
  fullName: string
  password: string
  roleId: string
  isActive?: boolean
}

export interface UserUpdateInput {
  username?: string
  email?: string | null
  fullName?: string
  roleId?: string
  isActive?: boolean
  password?: string
}

export interface RoleUpsertInput {
  key: string
  nameAr: string
  nameEn: string
  permissions: string[]
}

/* ------------------------------- Departments ------------------------------- */

export interface DepartmentRecord {
  id: string
  code: string
  name: string
  natureAllowancePct: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ListDepartmentsQuery {
  search?: string
  isActive?: boolean | null
  sort?: 'code' | 'name' | 'natureAllowancePct' | 'createdAt'
  order?: 'asc' | 'desc'
}

export interface DepartmentUpsertInput {
  code: string
  name: string
  natureAllowancePct?: number | null
  isActive?: boolean
}

/** One normalized row coming out of the Excel/PDF importer. */
export interface DepartmentImportRow {
  code: string
  name: string
  natureAllowancePct: number | null
}

export interface DepartmentParseResult {
  rows: DepartmentImportRow[]
  /** Rows that could not be understood, with a human readable reason. */
  issues: DepartmentImportIssue[]
  source: 'excel' | 'pdf' | 'csv'
}

export interface DepartmentImportIssue {
  line: number
  raw: string
  reason: string
}

export interface DepartmentImportSummary {
  created: number
  updated: number
  skipped: number
}

export interface UniquenessCheck {
  username?: string
  email?: string
  excludeId?: string | null
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export type Theme = 'dark' | 'light'

export interface AppSettings {
  language: 'ar' | 'en'
  theme: Theme
}

/* ----------------------------- IPC channel map ---------------------------- */

export interface ApiShape {
  auth: {
    login(payload: { username: string; password: string }): Promise<SessionUser>
    logout(): Promise<void>
    me(): Promise<SessionUser | null>
    bootstrap(): Promise<AppSettings>
  }
  users: {
    list(query: ListUsersQuery): Promise<UserRecord[]>
    getById(id: string): Promise<UserRecord | null>
    create(input: UserCreateInput): Promise<UserRecord>
    update(id: string, input: UserUpdateInput): Promise<UserRecord>
    setStatus(id: string, isActive: boolean): Promise<UserRecord>
    remove(id: string): Promise<void>
    checkUnique(check: UniquenessCheck): Promise<{ username: boolean; email: boolean }>
    changePassword(input: ChangePasswordInput): Promise<void>
  }
  roles: {
    list(): Promise<RoleRecord[]>
    getById(id: string): Promise<RoleRecord | null>
    create(input: RoleUpsertInput): Promise<RoleRecord>
    update(id: string, input: RoleUpsertInput): Promise<RoleRecord>
    remove(id: string): Promise<void>
    setPermissions(id: string, keys: string[]): Promise<RoleRecord>
  }
  departments: {
    list(query: ListDepartmentsQuery): Promise<DepartmentRecord[]>
    getById(id: string): Promise<DepartmentRecord | null>
    create(input: DepartmentUpsertInput): Promise<DepartmentRecord>
    update(id: string, input: DepartmentUpsertInput): Promise<DepartmentRecord>
    remove(id: string): Promise<void>
    parseImportFile(payload: {
      data: ArrayBuffer
      fileName: string
    }): Promise<DepartmentParseResult>
    importRows(rows: DepartmentImportRow[]): Promise<DepartmentImportSummary>
  }
  settings: {
    getAll(): Promise<AppSettings>
    setLanguage(language: 'ar' | 'en'): Promise<void>
    setTheme(theme: Theme): Promise<void>
  }
  system: {
    versions(): Promise<{ electron: string; node: string; chrome: string; app: string }>
    revealDatabase(): Promise<void>
  }
}

/** Error codes thrown by the main process and surfaced in the renderer. */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'SYSTEM_ROLE'
  | 'SUPER_ADMIN_PROTECTED'
  | 'LAST_SUPER_ADMIN'
  | 'INVALID_CREDENTIALS'
  | 'INTERNAL'

export class ApiError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiError'
  }
}
