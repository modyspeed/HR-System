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

/* -------------------------------- Employees -------------------------------- */

/** ISO date (`yyyy-mm-dd`) or null — dates are stored date-only. */
export type EmployeeDate = string | null

export interface EmployeeRecord {
  id: string
  code: string
  name: string
  insuranceNo: string | null
  nationalId: string | null
  grade: string | null
  gradeDate: EmployeeDate
  birthDate: EmployeeDate
  permanentDate: EmployeeDate
  hireDate: EmployeeDate
  qualification: string | null
  qualificationYear: number | null
  /** نوع التعاقد — free text. */
  contractType: string | null
  /** القسم — linked Department (resolved name included for display). */
  departmentId: string | null
  departmentName: string | null
  /** Attached work file (PDF/Excel), when linked. */
  fileOriginalName: string | null
  fileSize: number | null
  fileLinkedAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ListEmployeesQuery {
  search?: string
  isActive?: boolean | null
  sort?: 'code' | 'name' | 'grade' | 'hireDate' | 'createdAt'
  order?: 'asc' | 'desc'
}

export interface EmployeeUpsertInput {
  code: string
  name: string
  insuranceNo?: string | null
  nationalId?: string | null
  grade?: string | null
  gradeDate?: EmployeeDate
  birthDate?: EmployeeDate
  permanentDate?: EmployeeDate
  hireDate?: EmployeeDate
  qualification?: string | null
  qualificationYear?: number | null
  contractType?: string | null
  departmentId?: string | null
  isActive?: boolean
}

/** One normalized row coming out of the Excel/PDF importer. */
export interface EmployeeImportRow {
  code: string
  name: string
  insuranceNo: string | null
  nationalId: string | null
  grade: string | null
  gradeDate: EmployeeDate
  birthDate: EmployeeDate
  permanentDate: EmployeeDate
  hireDate: EmployeeDate
  qualification: string | null
  qualificationYear: number | null
  // Optional columns — `null` when the source file has no such column (or the
  // cell is empty). The importer then leaves the stored value untouched.
  departmentCode: string | null
  departmentName: string | null
  contractType: string | null
}

export interface EmployeeImportIssue {
  line: number
  raw: string
  reason: string
}

export interface EmployeeParseResult {
  rows: EmployeeImportRow[]
  issues: EmployeeImportIssue[]
  source: 'excel' | 'pdf' | 'csv'
}

export interface EmployeeImportSummary {
  created: number
  updated: number
  skipped: number
}

/** Result of `employees:previewFile` — either PDF bytes or a parsed grid. */
export interface EmployeeFilePreview {
  kind: 'pdf' | 'table'
  originalName: string | null
  ext: string
  size: number
  /** PDF payload (Uint8Array crosses the IPC boundary intact). */
  data?: Uint8Array
  /** Spreadsheet payload. */
  sheetName?: string | null
  rows?: string[][]
  totalRows?: number
  truncated?: boolean
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
  employees: {
    list(query: ListEmployeesQuery): Promise<EmployeeRecord[]>
    getById(id: string): Promise<EmployeeRecord | null>
    create(input: EmployeeUpsertInput): Promise<EmployeeRecord>
    update(id: string, input: EmployeeUpsertInput): Promise<EmployeeRecord>
    remove(id: string): Promise<void>
    parseImportFile(payload: {
      data: ArrayBuffer
      fileName: string
    }): Promise<EmployeeParseResult>
    importRows(rows: EmployeeImportRow[]): Promise<EmployeeImportSummary>
    attachFile(payload: {
      id: string
      data: ArrayBuffer
      fileName: string
    }): Promise<EmployeeRecord>
    removeFile(id: string): Promise<EmployeeRecord>
    previewFile(id: string): Promise<EmployeeFilePreview>
    revealFilesDir(): Promise<void>
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
