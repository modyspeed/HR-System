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
  /** عدد الموظفين المرتبطين — يحسم الحالة الفعلية للقسم ديناميكيًا. */
  employeeCount: number
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
  /** حالة الموظف الوظيفية — مفتاح من `EMPLOYEE_STATUS_KEYS`. */
  status: string
  isActive: boolean
  /** ملف إعادة التعيين الأصلي (عقد جديد لموظف سابق)، عند وجوده. */
  rehiredFrom: { id: string; code: string; name: string } | null
  /** الملف الجديد المُنشأ من هذا الملف عبر «عقد جديد»، عند وجوده. */
  rehiredTo: { id: string; code: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface ListEmployeesQuery {
  search?: string
  isActive?: boolean | null
  sort?: 'code' | 'name' | 'grade' | 'hireDate' | 'createdAt'
  order?: 'asc' | 'desc'
  status?: string
}

export interface EmployeeStatusHistoryRecord {
  id: string
  employeeId: string
  fromStatus: string
  toStatus: string
  reason: string | null
  changedBy: string | null
  changedAt: string
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

/** Result of `*:previewFile` — PDF bytes, a parsed spreadsheet grid, or an image. */
export interface EmployeeFilePreview {
  kind: 'pdf' | 'table' | 'image'
  originalName: string | null
  ext: string
  size: number
  /** PDF / image payload (Uint8Array crosses the IPC boundary intact). */
  data?: Uint8Array
  /** Image MIME type (e.g. image/png) when `kind === 'image'`. */
  mime?: string
  /** Spreadsheet payload. */
  sheetName?: string | null
  rows?: string[][]
  totalRows?: number
  truncated?: boolean
}

/** Result of `leaves:previewFile` — same shapes as the employee file preview. */
export type LeaveFilePreview = EmployeeFilePreview

export interface LeaveRecord {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  /** مفتاح من كتالوج `LEAVE_TYPE_KEYS` — أنواع الإجازات وفق القانون المصري. */
  type: string
  startDate: string // yyyy-mm-dd
  endDate: string // yyyy-mm-dd (شاملان)
  daysCount: number
  year: number
  reason: string | null
  status: string // pending | approved | rejected
  fileOriginalName: string | null
  fileSize: number | null
  fileLinkedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PayrollRecord {
  id: string
  batchId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  type: string
  month: number
  year: number
  period: string
  page: number
  basicSalary: number | null
  totalEarned: number | null
  totalDeductions: number | null
  netSalary: number | null
  fileName: string
  uploadedAt: string
}

export interface PayrollParseRow {
  page: number
  code: string
  name: string
  /** الموظف المطابق في قاعدة البيانات — null لو لم يُعثر عليه. */
  employeeId: string | null
  match: 'code' | 'name' | 'none'
  basicSalary: number | null
  totalEarned: number | null
  totalDeductions: number | null
  netSalary: number | null
}

export interface PayrollParseResult {
  type: string
  month: number
  year: number
  period: string
  fileName: string
  pageCount: number
  rows: PayrollParseRow[]
  matched: number
  unmatched: number
}

export interface ListPayrollsQuery {
  search?: string
  type?: string
  month?: number | null
  year?: number | null
}

export interface LeaveUpsertInput {
  employeeId: string
  type: string
  startDate: string
  endDate: string
  /** يُحتسب تلقائيًا من الفترة إذا لم يُمرَّر. */
  daysCount?: number | null
  year?: number | null
  reason?: string | null
  status?: string
}

export interface ListLeavesQuery {
  search?: string
  type?: string
  status?: string
  year?: number | null
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

/* --------------------------------- export --------------------------------- */

/** Which module's data is being exported — drives the permission check. */
export type ExportScope = 'employees' | 'departments' | 'leaves' | 'payrolls'

export interface ExportColumn {
  key: string
  label: string
  /** Excel column width hint (character units). */
  width?: number
  align?: 'start' | 'center' | 'end'
  /** Excel number format applied when the cell value is numeric. */
  format?: string
}

/**
 * A table rendered outside the app (PDF report or styled Excel sheet).
 * `rows` are aligned positionally with `columns`; `null` renders as `—`.
 */
export interface ExportPayload {
  scope: ExportScope
  /** Base file name without extension — the save dialog appends the real one. */
  fileName: string
  title: string
  /** Secondary line under the title (row count, active filters, …). */
  subtitle?: string
  direction: 'rtl' | 'ltr'
  columns: ExportColumn[]
  rows: (string | number | null)[][]
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
    /** عقد جديد بنفس بيانات الملف السابق — يُنشئ سجل موظف جديد برقم مختلف. */
    rehire(
      id: string,
      input: { code: string; contractType?: string | null; hireDate?: string | null }
    ): Promise<EmployeeRecord>
    /** يُسجِّل تغيير الحالة في سجل الموظف ويُحدِّث `isActive` تلقائيًا. */
    setStatus(
      id: string,
      input: { status: string; reason?: string }
    ): Promise<EmployeeRecord>
    statusHistory(id: string): Promise<EmployeeStatusHistoryRecord[]>
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
  leaves: {
    list(query: ListLeavesQuery): Promise<LeaveRecord[]>
    getById(id: string): Promise<LeaveRecord | null>
    create(input: LeaveUpsertInput): Promise<LeaveRecord>
    update(id: string, input: LeaveUpsertInput): Promise<LeaveRecord>
    remove(id: string): Promise<void>
    attachFile(payload: {
      id: string
      data: ArrayBuffer
      fileName: string
    }): Promise<LeaveRecord>
    removeFile(id: string): Promise<LeaveRecord>
    previewFile(id: string): Promise<LeaveFilePreview>
    revealFilesDir(): Promise<void>
  }
  payrolls: {
    list(query: ListPayrollsQuery): Promise<PayrollRecord[]>
    listByEmployee(employeeId: string): Promise<PayrollRecord[]>
    /** Kفكشف PDF إلى أظرف — معاينة فقط (لا يُكتب شيء). */
    parsePdf(payload: { data: ArrayBuffer; fileName: string }): Promise<PayrollParseResult>
    /** يستبدل دفعة الشهر/النوع بالملف الجديد ويوزّع الأظرف على الموظفين. */
    importPdf(payload: { data: ArrayBuffer; fileName: string }): Promise<{
      created: number
      unmatched: number
      period: string
    }>
    /** صفحة الظرف الواحدة كـ PDF مع البيانات المستخرجة. */
    previewEntry(id: string): Promise<{
      originalName: string
      page: number
      data: Uint8Array
    }>
    remove(id: string): Promise<void>
  }
  export: {
    /** Returns the saved path, or `null` when the user cancels the dialog. */
    toPdf(payload: ExportPayload): Promise<string | null>
    toExcel(payload: ExportPayload): Promise<string | null>
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
  | 'TOO_MANY_ATTEMPTS'
  | 'INTERNAL'

export class ApiError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiError'
  }
}
