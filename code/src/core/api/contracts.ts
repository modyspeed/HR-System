export interface EnabledModule {
  id: string;
  nameAr: string;
}

export interface AppSummary {
  employeeCount: number;
  enabledModules: EnabledModule[];
}

export type EmployeeStatus = "active" | "resigned" | "terminated" | "suspended";

export interface EmployeeInput {
  code: string;
  fullName: string;
  departmentId: number;
  hireDate: string;
  jobTitle?: string;
}

export interface EmployeeListFilter {
  search: string;
  departmentId: number | null;
}

export interface EmployeeRecord extends Omit<EmployeeInput, "jobTitle"> {
  id: number;
  departmentName: string;
  jobTitle: string | null;
  status: EmployeeStatus;
  annualEntitlement: number | null;
  casualEntitlement: number | null;
}

export interface DepartmentRecord {
  id: number;
  name: string;
}

export interface ApiFailure {
  code: string;
  message: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

export interface EmployeeWireInput {
  code: string;
  full_name: string;
  department_id: number;
  hire_date: string;
  job_title?: string;
  birth_date?: string;
  national_id?: string;
  phone?: string;
  notes?: string;
}

export interface EmployeeWireRecord extends Omit<
  EmployeeWireInput,
  "job_title" | "birth_date" | "national_id" | "phone" | "notes"
> {
  id: number;
  department_name: string | null;
  job_title: string | null;
  birth_date: string | null;
  national_id: string | null;
  phone: string | null;
  notes: string | null;
  status: EmployeeStatus;
  annual_entitlement: number | null;
  casual_entitlement: number | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeQuery {
  search?: string;
  departmentId?: number | null;
  status?: EmployeeStatus | "all";
}

export interface LeaveRequestFilter {
  search?: string;
  leaveTypeId?: number | null;
  leaveTypeKey?: string | null;
  status?: LeaveRequestStatus | "all";
  year?: number;
}

export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveDecision = "approved" | "rejected";

export interface LeaveTypeRecord {
  id: number;
  key: string;
  nameAr: string;
  yearlyEntitlement: number | null;
  deductsBalance: boolean;
  countsWeekends: boolean;
  requiresAttachment: boolean;
  active: boolean;
}

export interface LeaveRequestRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeFullName: string;
  leaveTypeId: number;
  leaveTypeKey: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  decidedAt: string | null;
  decidedNote: string | null;
  createdAt: string;
}

export interface LeaveRequestInput {
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason?: string;
  overrideReason?: string;
}

export interface LeaveDecisionInput {
  requestId: number;
  decision: LeaveDecision;
  note?: string;
}

export interface LeaveBalanceSummary {
  leaveTypeId: number;
  leaveTypeKey: string;
  leaveTypeName: string;
  entitlement: number;
  carriedOver: number;
  adjustment: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface EmployeeLeaveSummary {
  employeeId: number;
  year: number;
  balances: LeaveBalanceSummary[];
}

export type ThemePreference = "system" | "light" | "dark";

export interface LeaveDeskApi {
  getSummary(): Promise<AppSummary>;
  listEmployees(filter: EmployeeQuery): Promise<ApiResult<EmployeeWireRecord[]>>;
  getEmployee(id: number): Promise<ApiResult<EmployeeWireRecord>>;
  createEmployee(input: EmployeeWireInput): Promise<ApiResult<EmployeeWireRecord>>;
  updateEmployee(id: number, input: EmployeeWireInput): Promise<ApiResult<EmployeeWireRecord>>;
  setEmployeeStatus(id: number, status: EmployeeStatus): Promise<ApiResult<EmployeeWireRecord>>;
  listDepartments(): Promise<ApiResult<DepartmentRecord[]>>;
  createDepartment(name: string): Promise<ApiResult<DepartmentRecord>>;
  createLeaveRequest(input: LeaveRequestInput): Promise<ApiResult<LeaveRequestRecord>>;
  decideLeaveRequest(input: LeaveDecisionInput): Promise<ApiResult<LeaveRequestRecord>>;
  cancelLeaveRequest(requestId: number): Promise<ApiResult<LeaveRequestRecord>>;
  listLeaveRequests(filter?: LeaveRequestFilter): Promise<ApiResult<LeaveRequestRecord[]>>;
  getEmployeeLeaveSummary(employeeId: number, year?: number): Promise<ApiResult<EmployeeLeaveSummary>>;
  setTheme(preference: ThemePreference): Promise<ThemePreference>;
  initialTheme: ThemePreference;
  initialSystemDark: boolean;
  onSystemThemeChanged(listener: (isDark: boolean) => void): () => void;
}