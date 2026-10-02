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
  setTheme(preference: ThemePreference): Promise<ThemePreference>;
  initialTheme: ThemePreference;
  initialSystemDark: boolean;
  onSystemThemeChanged(listener: (isDark: boolean) => void): () => void;
}