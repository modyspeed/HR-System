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
  /** نوع التعاقد — اسم محفوظ (لقطة) حتى لو حُذف النوع من الكتالوج. */
  contractType: string | null
  /** نوع التعاقد المُدار (كتالوج) — null لو لم يُربط. */
  contractTypeId: string | null
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
  contractTypeId?: string
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
  contractTypeId?: string | null
  departmentId?: string | null
  isActive?: boolean
}

export interface ContractTypeRecord {
  id: string
  name: string
  /** عدد الموظفين المرتبطين به حاليًا. */
  employeesCount: number
  createdAt: string
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
  type: string
  month: number
  year: number
  period: string
  page: number
  /** القسم المستدل عليه من نص الظرف (تبويب الأقسام). */
  departmentId: string | null
  departmentName: string | null
  /** جهة العمل الخام في الظرف (مثل «البلوف»). */
  workshop: string | null
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
  departmentId: string | null
  departmentName: string | null
  workshop: string | null
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

/* ------------------------------ payroll items ----------------------------- */

/** نوع البند داخل ظرف المرتب/الحافز. */
export type PayrollItemKind = 'earning' | 'deduction' | 'balance'

/** بند مفردات كما يُستخرج من جدول الظرف (قبل التخزين). */
export interface PayrollItemRow {
  kind: PayrollItemKind
  label: string
  labelKey: string
  value: number
  /** الرصيد المستحق على السلف المرتبط بهذا البند (عمود «الرصيد» في الظرف). */
  balance: number | null
  sortOrder: number
}

/** بند مفردات مخزَّن في قاعدة البيانات. */
export interface PayrollItemRecord extends PayrollItemRow {
  id: string
  entryId: string
  employeeId: string
  period: string
  type: string
}

/** عمود في مصفوفة المفردات — بند واحد لكل الموظفين. */
export interface PayrollItemColumn {
  key: string
  label: string
  kind: PayrollItemKind
  /** عدد الموظفين الذين تحمّلوا هذا البند. */
  count: number
  total: number
}

/** صف في مصفوفة المفردات — موظف واحد وكل بنوده. */
export interface PayrollItemMatrixRow {
  entryId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  /** القيم محاذية مع أعمدة المصفوفة (null = لا يوجد بند للموظف). */
  values: (number | null)[]
  /** إجمالي الأرصدة المستحقة على السلف للموظف. */
  balance: number
  /** مجموع بنود الاستحقاقات المستخرجة من ظرف الموظف. */
  earningsTotal: number
  /** مجموع بنود الاستقطاعات. */
  deductionsTotal: number
  totalEarned: number | null
  totalDeductions: number | null
  netSalary: number | null
}

/** مصفوفة مفردات شهر ونوع معيّن (مرتب أو حافز). */
export interface PayrollItemsMatrix {
  type: string
  period: string
  month: number
  year: number
  fileName: string | null
  columns: PayrollItemColumn[]
  rows: PayrollItemMatrixRow[]
  /** مجموع كل عمود (على مستوى كل الموظفين). */
  totals: (number | null)[]
  /** عدد الأظرف التي استُخرجت منها مفردات. */
  extracted: number
  /** عدد الأظرف التي لم يُستخرج منها مفردات بعد. */
  pending: number
}

/** شهر متاح للمرتب أو الحافز مع حالة استخراج المفردات. */
export interface PayrollItemsPeriod {
  period: string
  month: number
  year: number
  type: string
  fileName: string
  entries: number
  extracted: number
}

export interface PayrollItemsQuery {
  /** salary | incentive */
  type: string
  /** yyyy-mm */
  period: string
  search?: string
  departmentId?: string
}

/* -------------------------------- absences -------------------------------- */

/** صف في تقرير الغيابات — موظف واحد ومقادير غيابه عن الشهر. */
export interface AbsenceRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  /** أيام الغياب بإذن. */
  withPermission: number
  /** أيام الغياب بدون إذن. */
  withoutPermission: number
  /** مجموع أيام الغياب. */
  total: number
}

/** تقرير غيابات شهر — الموظفون الذين لديهم أيام غياب فقط. */
export interface AbsencesReport {
  period: string
  month: number
  year: number
  /** ملفات الكشوف الموجودة في الشهر. */
  fileNames: string[]
  /** أنواع الأظرف الموجودة في الشهر (salary / incentive). */
  slipTypes: string[]
  rows: AbsenceRow[]
  totals: {
    withPermission: number
    withoutPermission: number
    total: number
  }
  /** عدد الموظفين الذين لديهم أيام غياب. */
  employees: number
  /** هل فُحصت كشوف الشهر كلها لأيام الغياب؟ false = بقي كشف لم يُفحص. */
  scanned: boolean
  /** عدد كشوف الشهر التي فُحصت. */
  scannedBatches: number
  /** إجمالي كشوف الشهر. */
  totalBatches: number
  /** كشوف ملفها غير موجود في الأرشيف — تعذّر استخراج أيام غيابها. */
  missingFiles: string[]
}

export interface AbsencesQuery {
  /** yyyy-mm */
  period: string
  search?: string
  departmentId?: string
}

/* -------------------------------- retirements ------------------------------ */

/** صف في تقرير المعاشات — موظف أُحيل للمعاش وتاريخ إحالته. */
export interface RetirementRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  /** تاريخ الميلاد (yyyy-mm-dd) — أساس حساب سن المعاش. */
  birthDate: string | null
  /** تاريخ المعاش (yyyy-mm-dd) — بلوغ السن القانونية أو تاريخ الإحالة اليدوية. */
  retirementDate: string | null
  /** auto = بلوغ السن القانونية تلقائيًا، manual = إحالة يدوية، expected = لم يُحل بعد. */
  source: 'auto' | 'manual' | 'expected'
  /** الحالة الوظيفية الحالية (نشط/إجازة بدون مرتب/موقوف/محال للمعاش…). */
  employeeStatus: string
  /** من سجّل الإحالة (اسم المستخدم أو النظام). */
  changedBy: string | null
  /** سبب الإحالة كما سُجِّل في السجل. */
  reason: string | null
}

/** سنة أو شهر فيه إحالات معاش — لبناء قوائم الفلترة وأعدادها. */
export interface RetirementPeriodCount {
  /** yyyy-mm */
  period: string
  year: number
  month: number
  count: number
}

export interface RetirementsReport {
  /** العرض الحالي: المحالون بالفعل أم المؤهلون للمعاش. */
  view: RetirementView
  rows: RetirementRow[]
  /** السنوات التي فيها إحالات، الأحدث أولًا، مع عدد المحالين في كل سنة. */
  years: { year: number; count: number }[]
  /** الشهور التي فيها إحالات (كل السنوات) — تُشتق منها قائمة الشهور للسنة المختارة. */
  periods: RetirementPeriodCount[]
  totals: {
    /** إجمالي المحالين للمعاش في القاعدة. */
    total: number
    /** العدد بعد تطبيق الفلتر الحالي. */
    filtered: number
    /** عدد السنوات التي فيها إحالات (بعد الفلتر). */
    years: number
    /** أحدث تاريخ معاش بعد الفلتر (yyyy-mm-dd)، أو null. */
    latest: string | null
    /** أقرب تاريخ معاش بعد الفلتر (yyyy-mm-dd)، أو null. */
    earliest: string | null
  }
}

/** retired = محالون بالفعل، eligible = مؤهلون (سيبلغون السن). */
export type RetirementView = 'retired' | 'eligible'

export interface RetirementsQuery {
  /** العرض المطلوب — افتراضيًا المحالون بالفعل. */
  view?: RetirementView
  /** سنة الإحالة — غيابها يعني كل السنوات. */
  year?: number
  /** شهر الإحالة (1-12) — تُطبَّق مع السنة. */
  month?: number
  search?: string
  departmentId?: string
}

export interface SalaryGradeRecord {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  /** تاريخ بدء سريان الأساسي. */
  date: string
  amount: number
  note: string | null
  fileOriginalName: string | null
  fileSize: number | null
  fileLinkedAt: string | null
  createdAt: string
}

export interface SalaryGradeUpsertInput {
  employeeId: string
  date: string
  amount: number
  note?: string | null
}

export interface DepartmentTransferRecord {
  id: string
  employeeId: string
  fromDepartmentId: string | null
  fromDepartmentName: string | null
  toDepartmentId: string | null
  toDepartmentName: string | null
  fromDate: string
  toDate: string | null
  note: string | null
  decisionOriginalName: string | null
  decisionSize: number | null
  decisionLinkedAt: string | null
  createdAt: string
}

export interface DepartmentTransferUpsertInput {
  employeeId?: string
  fromDepartmentId?: string | null
  toDepartmentId?: string | null
  fromDate: string
  toDate?: string | null
  note?: string | null
  /** عند الحفظ يضبط موظف على قسم الهدف مباشرة. */
  applyAsCurrent?: boolean
}

export interface IncentiveRateRecord {
  id: string
  batchId: string | null
  departmentId: string
  departmentName: string
  month: number
  year: number
  period: string
  page: number
  rate: number
  note: string | null
  fileName: string | null
  uploadedAt: string | null
}

export interface IncentiveRateParseRow {
  page: number
  code: string
  name: string
  departmentId: string | null
  match: 'code' | 'name' | 'none'
  rate: number
}

export interface IncentiveRateParseResult {
  month: number
  year: number
  period: string
  pageCount: number
  rows: IncentiveRateParseRow[]
  matched: number
  unmatched: number
}

export interface IncentiveRateUpsertInput {
  departmentId: string
  period: string
  rate: number
  note?: string | null
}

export interface EmployeeIncentiveRateRecord {
  id: string
  batchId: string | null
  employeeId: string
  employeeCode: string
  employeeName: string
  month: number
  year: number
  period: string
  page: number
  rate: number
  note: string | null
  fileName: string | null
  uploadedAt: string | null
}

export interface EmployeeIncentiveRateParseRow {
  page: number
  code: string
  name: string
  employeeId: string | null
  match: 'code' | 'name' | 'none'
  rate: number
}

export interface EmployeeIncentiveRateParseResult {
  month: number
  year: number
  period: string
  pageCount: number
  rows: EmployeeIncentiveRateParseRow[]
  matched: number
  unmatched: number
}

export interface EmployeeIncentiveRateUpsertInput {
  employeeId: string
  period: string
  rate: number
  note?: string | null
}

export interface PenaltyRateRecord {
  id: string
  batchId: string | null
  employeeId: string
  employeeCode: string
  employeeName: string
  month: number
  year: number
  period: string
  page: number
  rate: number
  amount: number
  note: string | null
  fileName: string | null
  uploadedAt: string | null
}

export interface PenaltyRateParseRow {
  page: number
  code: string
  name: string
  employeeId: string | null
  match: 'code' | 'name' | 'none'
  rate: number
  amount: number
}

export interface PenaltyRateParseResult {
  month: number
  year: number
  period: string
  pageCount: number
  rows: PenaltyRateParseRow[]
  matched: number
  unmatched: number
}

export interface PenaltyRateUpsertInput {
  employeeId: string
  period: string
  rate: number
  amount?: number
  note?: string | null
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

export interface BackupInfo {
  fileName: string
  size: number
  createdAt: string
}

export interface DashboardSummary {
  employees: {
    total: number
    active: number
    inactive: number
    byStatus: Record<string, number>
    byDepartment: { id: string; name: string; count: number }[]
  } | null
  departments: { total: number; active: number } | null
  leaves: { total: number; byStatus: Record<string, number> } | null
  payrolls: {
    months: number
    entries: number
    latest: { period: string; type: string; originalName: string; uploadedAt: string } | null
  } | null
  transfers: { total: number; open: number } | null
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
  retirements: {
    /** تقرير المعاشات: المحالون للمعاش مع تاريخ إحالتهم، بفلتر سنة/شهر. */
    list(query?: RetirementsQuery): Promise<RetirementsReport>
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
      input: {
        code: string
        contractType?: string | null
        contractTypeId?: string | null
        hireDate?: string | null
      }
    ): Promise<EmployeeRecord>
    /** يربط موظفًا موجودًا بملفه الأصلي السابق ويكمل بياناته الناقصة. */
    linkRehire(id: string, sourceId: string): Promise<EmployeeRecord>
    departmentTransfers: {
      listByEmployee(employeeId: string): Promise<DepartmentTransferRecord[]>
      create(input: DepartmentTransferUpsertInput): Promise<DepartmentTransferRecord>
      update(id: string, input: DepartmentTransferUpsertInput): Promise<DepartmentTransferRecord>
      remove(id: string): Promise<void>
      attachDecision(payload: { id: string; data: ArrayBuffer; fileName: string }): Promise<DepartmentTransferRecord>
      removeDecision(id: string): Promise<DepartmentTransferRecord>
      previewDecision(id: string): Promise<EmployeeFilePreview>
    }
    /** يُسجِّل تغيير الحالة في سجل الموظف ويُحدِّث `isActive` تلقائيًا. */
    setStatus(
      id: string,
      input: { status: string; reason?: string }
    ): Promise<EmployeeRecord>
    statusHistory(id: string): Promise<EmployeeStatusHistoryRecord[]>
    contractTypeList(): Promise<ContractTypeRecord[]>
    contractTypeCreate(input: { name: string }): Promise<ContractTypeRecord>
    contractTypeUpdate(id: string, input: { name: string }): Promise<ContractTypeRecord>
    contractTypeRemove(id: string): Promise<void>
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
    /** مفردات الأظرف — مصفوفة: صف لكل موظف وعمود لكل بند. */
    items: {
      list(query: PayrollItemsQuery): Promise<PayrollItemsMatrix>
      /** الشهور المتاحة للمرتب/الحافز مع حالة استخراج مفرداتها. */
      periods(query?: { type?: string }): Promise<PayrollItemsPeriod[]>
      /** تقرير الغيابات (بأذن/بدون إذن) عن شهر معيّن — يجمع من المرتب والحافز. */
      absences(query: AbsencesQuery): Promise<AbsencesReport>
      syncAbsences(query: { period: string }): Promise<{
        batches: number
        absences: number
        missing: number
      }>
      /** يعيد استخراج المفردات من ملف الكشف المخزَّن ويحدّثها. */
      sync(query: { type: string; period: string }): Promise<{
        entries: number
        items: number
        periods: PayrollItemsPeriod[]
      }>
    }
    salaryGrades: {
      listByEmployee(employeeId: string): Promise<SalaryGradeRecord[]>
      create(input: SalaryGradeUpsertInput): Promise<SalaryGradeRecord>
      update(id: string, input: SalaryGradeUpsertInput): Promise<SalaryGradeRecord>
      remove(id: string): Promise<void>
      attachFile(payload: { id: string; data: ArrayBuffer; fileName: string }): Promise<SalaryGradeRecord>
      removeFile(id: string): Promise<SalaryGradeRecord>
      previewFile(id: string): Promise<EmployeeFilePreview>
    }
    incentiveRates: {
      list(query: { period?: string; departmentId?: string }): Promise<IncentiveRateRecord[]>
      listByDepartment(departmentId: string): Promise<IncentiveRateRecord[]>
      create(input: IncentiveRateUpsertInput): Promise<IncentiveRateRecord>
      update(id: string, input: IncentiveRateUpsertInput): Promise<IncentiveRateRecord>
      remove(id: string): Promise<void>
      parsePdf(payload: { data: ArrayBuffer; fileName: string }): Promise<IncentiveRateParseResult>
      importPdf(payload: { data: ArrayBuffer; fileName: string }): Promise<{
        created: number
        unmatched: number
        period: string
      }>
      preview(id: string): Promise<{ originalName: string; data: Uint8Array } | null>
    }
    employeeIncentiveRates: {
      list(query: { period?: string; employeeId?: string }): Promise<EmployeeIncentiveRateRecord[]>
      listByEmployee(employeeId: string): Promise<EmployeeIncentiveRateRecord[]>
      create(input: EmployeeIncentiveRateUpsertInput): Promise<EmployeeIncentiveRateRecord>
      update(id: string, input: EmployeeIncentiveRateUpsertInput): Promise<EmployeeIncentiveRateRecord>
      remove(id: string): Promise<void>
      parsePdf(payload: { data: ArrayBuffer; fileName: string }): Promise<EmployeeIncentiveRateParseResult>
      importPdf(payload: { data: ArrayBuffer; fileName: string }): Promise<{
        created: number
        unmatched: number
        period: string
      }>
      preview(id: string): Promise<{ originalName: string; data: Uint8Array } | null>
    }
    incentivePenalties: {
      list(query: { period?: string; employeeId?: string }): Promise<PenaltyRateRecord[]>
      listByEmployee(employeeId: string): Promise<PenaltyRateRecord[]>
      create(input: PenaltyRateUpsertInput): Promise<PenaltyRateRecord>
      update(id: string, input: PenaltyRateUpsertInput): Promise<PenaltyRateRecord>
      remove(id: string): Promise<void>
      parsePdf(payload: { data: ArrayBuffer; fileName: string }): Promise<PenaltyRateParseResult>
      importPdf(payload: { data: ArrayBuffer; fileName: string }): Promise<{
        created: number
        unmatched: number
        period: string
      }>
      preview(id: string): Promise<{ originalName: string; data: Uint8Array } | null>
    }
  }
  export: {
    /** Returns the saved path, or `null` when the user cancels the dialog. */
    toPdf(payload: ExportPayload): Promise<string | null>
    toExcel(payload: ExportPayload): Promise<string | null>
    /** مستند Word (يُكتب HTML متوافق يفتحه Word مباشرة). */
    toWord(payload: ExportPayload): Promise<string | null>
    /** صورة PNG لما يظهره التقرير (عبر النافذة الخفية). */
    toImage(payload: ExportPayload): Promise<string | null>
    /** يفتح نافذة طباعة النظام للتقرير. */
    toPrint(payload: ExportPayload): Promise<boolean>
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
  backups: {
    list(): Promise<BackupInfo[]>
    create(): Promise<BackupInfo>
    restore(fileName: string): Promise<{ preRestore: string | null }>
    remove(fileName: string): Promise<void>
    revealDir(): Promise<void>
  }
  dashboard: {
    summary(): Promise<DashboardSummary>
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
