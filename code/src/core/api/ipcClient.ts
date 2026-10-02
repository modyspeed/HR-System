import type {
  AppSummary,
  DepartmentRecord,
  EmployeeInput,
  EmployeeListFilter,
  EmployeeRecord,
  EmployeeStatus,
  LeaveDeskApi,
} from "./contracts";

export const DESKTOP_ONLY_MESSAGE = "هذه الوظيفة تعمل داخل التطبيق فقط";

function requireDesktopApi(): LeaveDeskApi {
  if (!window.leaveDesk) throw new Error(DESKTOP_ONLY_MESSAGE);
  return window.leaveDesk;
}

export function getAppSummary(): Promise<AppSummary> {
  return requireDesktopApi().getSummary();
}

export function listEmployees(filter: EmployeeListFilter): Promise<EmployeeRecord[]> {
  return requireDesktopApi().listEmployees(filter);
}

export function getEmployee(id: number): Promise<EmployeeRecord> {
  return requireDesktopApi().getEmployee(id);
}

export function createEmployee(input: EmployeeInput): Promise<EmployeeRecord> {
  return requireDesktopApi().createEmployee(input);
}

export function updateEmployee(id: number, input: EmployeeInput): Promise<EmployeeRecord> {
  return requireDesktopApi().updateEmployee(id, input);
}

export function setEmployeeStatus(id: number, status: EmployeeStatus): Promise<EmployeeRecord> {
  return requireDesktopApi().setEmployeeStatus(id, status);
}

export function listDepartments(): Promise<DepartmentRecord[]> {
  return requireDesktopApi().listDepartments();
}

export function createDepartment(name: string): Promise<DepartmentRecord> {
  return requireDesktopApi().createDepartment(name);
}