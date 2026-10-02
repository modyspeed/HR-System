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

export type ThemePreference = "system" | "light" | "dark";

export interface LeaveDeskApi {
  getSummary(): Promise<AppSummary>;
  listEmployees(filter: EmployeeListFilter): Promise<EmployeeRecord[]>;
  getEmployee(id: number): Promise<EmployeeRecord>;
  createEmployee(input: EmployeeInput): Promise<EmployeeRecord>;
  updateEmployee(id: number, input: EmployeeInput): Promise<EmployeeRecord>;
  setEmployeeStatus(id: number, status: EmployeeStatus): Promise<EmployeeRecord>;
  listDepartments(): Promise<DepartmentRecord[]>;
  createDepartment(name: string): Promise<DepartmentRecord>;
  setTheme(preference: ThemePreference): Promise<ThemePreference>;
  initialTheme: ThemePreference;
  initialSystemDark: boolean;
  onSystemThemeChanged(listener: (isDark: boolean) => void): () => void;
}