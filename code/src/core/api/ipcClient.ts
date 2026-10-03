import type {
  ApiResult,
  AppSummary,
  DepartmentRecord,
  DocumentReadResult,
  EmployeeFilesResult,
  EmployeeInput,
  EmployeeListFilter,
  EmployeeRecord,
  EmployeeStatus,
  EnsureFolderResult,
    EmployeeWireInput,
    EmployeeWireRecord,
    EmployeeLeaveSummary,
    LeaveDecisionInput,
    LeaveRequestFilter,
    LeaveRequestInput,
    LeaveRequestRecord,
    LeaveDeskApi,
    LowBalanceAlert,
    OpenFolderResult,
    PickAndAddInput,
    PickAndAddResult,
    ScanAllResult,
    ScanResult,
  } from "./contracts";

export const DESKTOP_ONLY_MESSAGE = "هذه الوظيفة تعمل داخل التطبيق فقط";

function failure<T>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

async function withDesktopApi<T>(
  operation: (api: LeaveDeskApi) => Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const api = window.leaveDesk;
  if (!api) return failure("NOT_IN_APP", DESKTOP_ONLY_MESSAGE);
  try {
    return await operation(api);
  } catch {
    return failure("IPC_UNAVAILABLE", "تعذر الاتصال بالتطبيق. حاول مرة أخرى.");
  }
}

function mapResult<Input, Output>(result: ApiResult<Input>, mapper: (value: Input) => Output): ApiResult<Output> {
  return result.ok ? { ok: true, data: mapper(result.data) } : result;
}

export function unwrapApiResult<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

function fromWireEmployee(employee: EmployeeWireRecord): EmployeeRecord {
  return {
    id: employee.id,
    code: employee.code,
    fullName: employee.full_name,
    departmentId: employee.department_id,
    departmentName: employee.department_name ?? "",
    hireDate: employee.hire_date,
    jobTitle: employee.job_title ?? null,
    status: employee.status,
    annualEntitlement: employee.annual_entitlement,
    casualEntitlement: employee.casual_entitlement,
  };
}

function toWireEmployee(input: EmployeeInput): EmployeeWireInput {
  return {
    code: input.code,
    full_name: input.fullName,
    department_id: input.departmentId,
    hire_date: input.hireDate,
    job_title: input.jobTitle,
  };
}

export function getAppSummary(): Promise<ApiResult<AppSummary>> {
  return withDesktopApi(async (api) => ({ ok: true, data: await api.getSummary() }));
}

export function listEmployees(filter: EmployeeListFilter): Promise<ApiResult<EmployeeRecord[]>> {
  return withDesktopApi(async (api) => mapResult(
    await api.listEmployees({ search: filter.search, departmentId: filter.departmentId, status: "active" }),
    (employees) => employees.map(fromWireEmployee),
  ));
}

export function getEmployee(id: number): Promise<ApiResult<EmployeeRecord>> {
  return withDesktopApi(async (api) => mapResult(await api.getEmployee(id), fromWireEmployee));
}

export function createEmployee(input: EmployeeInput): Promise<ApiResult<EmployeeRecord>> {
  return withDesktopApi(async (api) => mapResult(await api.createEmployee(toWireEmployee(input)), fromWireEmployee));
}

export function updateEmployee(id: number, input: EmployeeInput): Promise<ApiResult<EmployeeRecord>> {
  return withDesktopApi(async (api) => mapResult(await api.updateEmployee(id, toWireEmployee(input)), fromWireEmployee));
}

export function setEmployeeStatus(id: number, status: EmployeeStatus): Promise<ApiResult<EmployeeRecord>> {
  return withDesktopApi(async (api) => mapResult(await api.setEmployeeStatus(id, status), fromWireEmployee));
}

export function listDepartments(): Promise<ApiResult<DepartmentRecord[]>> {
  return withDesktopApi((api) => api.listDepartments());
}

export function createDepartment(name: string): Promise<ApiResult<DepartmentRecord>> {
  return withDesktopApi((api) => api.createDepartment(name));
}

export function createLeaveRequest(input: LeaveRequestInput): Promise<ApiResult<LeaveRequestRecord>> {
  return withDesktopApi((api) => api.createLeaveRequest(input));
}

export function decideLeaveRequest(input: LeaveDecisionInput): Promise<ApiResult<LeaveRequestRecord>> {
  return withDesktopApi((api) => api.decideLeaveRequest(input));
}

export function cancelLeaveRequest(requestId: number): Promise<ApiResult<LeaveRequestRecord>> {
  return withDesktopApi((api) => api.cancelLeaveRequest(requestId));
}

export function listLeaveRequests(filter?: LeaveRequestFilter): Promise<ApiResult<LeaveRequestRecord[]>> {
  return withDesktopApi((api) => api.listLeaveRequests(filter));
}

export function getEmployeeLeaveSummary(employeeId: number, year?: number): Promise<ApiResult<EmployeeLeaveSummary>> {
  return withDesktopApi((api) => api.getEmployeeLeaveSummary(employeeId, year));
}

export function getLowBalances(year?: number): Promise<ApiResult<LowBalanceAlert[]>> {
  return withDesktopApi((api) => api.getLowBalances(year));
}

export function listEmployeeFiles(employeeId: number): Promise<ApiResult<EmployeeFilesResult>> {
  return withDesktopApi((api) => api.listEmployeeFiles(employeeId));
}

export function scanEmployeeFiles(employeeId: number): Promise<ApiResult<ScanResult>> {
  return withDesktopApi((api) => api.scanEmployeeFiles(employeeId));
}

export function scanAllEmployeeFiles(): Promise<ApiResult<ScanAllResult>> {
  return withDesktopApi((api) => api.scanAllEmployeeFiles());
}

export function ensureEmployeeFolder(employeeId: number): Promise<ApiResult<EnsureFolderResult>> {
  return withDesktopApi((api) => api.ensureEmployeeFolder(employeeId));
}

export function openEmployeeFolder(employeeId: number): Promise<ApiResult<OpenFolderResult>> {
  return withDesktopApi((api) => api.openEmployeeFolder(employeeId));
}

export function pickAndAddDocument(input: PickAndAddInput): Promise<ApiResult<PickAndAddResult>> {
  return withDesktopApi((api) => api.pickAndAddDocument(input));
}

export function readDocument(documentId: number): Promise<ApiResult<DocumentReadResult>> {
  return withDesktopApi((api) => api.readDocument(documentId));
}