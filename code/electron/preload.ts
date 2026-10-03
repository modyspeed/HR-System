import { contextBridge, ipcRenderer } from "electron";
  import type {
    ApiResult,
    AppSummary,
    DepartmentRecord,
    DocumentReadResult,
    EmployeeFilesResult,
    EmployeeStatus,
    EmployeeQuery,
    EmployeeWireInput,
    EmployeeWireRecord,
    EnsureFolderResult,
    EmployeeLeaveSummary,
    LeaveDecisionInput,
    LeaveRequestFilter,
    LeaveRequestInput,
    LeaveRequestRecord,
    LowBalanceAlert,
    OpenFolderResult,
    PickAndAddInput,
    PickAndAddResult,
    ScanAllResult,
    ScanResult,
    ThemePreference,
  } from "../src/core/api/contracts";

function readInitialTheme(): ThemePreference {
  const argument = process.argv.find((value) => value.startsWith("--leavedesk-theme="));
  const preference = argument?.slice("--leavedesk-theme=".length);
  return preference === "light" || preference === "dark" ? preference : "system";
}

const initialTheme = readInitialTheme();
const initialSystemDark = process.argv.includes("--leavedesk-system-dark=1");

contextBridge.exposeInMainWorld("leaveDesk", {
  getSummary: (): Promise<AppSummary> =>
    ipcRenderer.invoke("app:get-summary") as Promise<AppSummary>,
  listEmployees: (filter: EmployeeQuery): Promise<ApiResult<EmployeeWireRecord[]>> =>
    ipcRenderer.invoke("employees:list", filter) as Promise<ApiResult<EmployeeWireRecord[]>>,
  getEmployee: (id: number): Promise<ApiResult<EmployeeWireRecord>> =>
    ipcRenderer.invoke("employees:get", id) as Promise<ApiResult<EmployeeWireRecord>>,
  createEmployee: (input: EmployeeWireInput): Promise<ApiResult<EmployeeWireRecord>> =>
    ipcRenderer.invoke("employees:create", input) as Promise<ApiResult<EmployeeWireRecord>>,
  updateEmployee: (id: number, input: EmployeeWireInput): Promise<ApiResult<EmployeeWireRecord>> =>
    ipcRenderer.invoke("employees:update", id, input) as Promise<ApiResult<EmployeeWireRecord>>,
  setEmployeeStatus: (id: number, status: EmployeeStatus): Promise<ApiResult<EmployeeWireRecord>> =>
    ipcRenderer.invoke("employees:set-status", id, status) as Promise<ApiResult<EmployeeWireRecord>>,
  listDepartments: (): Promise<ApiResult<DepartmentRecord[]>> =>
    ipcRenderer.invoke("departments:list") as Promise<ApiResult<DepartmentRecord[]>>,
  createDepartment: (name: string): Promise<ApiResult<DepartmentRecord>> =>
    ipcRenderer.invoke("departments:create", name) as Promise<ApiResult<DepartmentRecord>>,
  createLeaveRequest: (input: LeaveRequestInput): Promise<ApiResult<LeaveRequestRecord>> =>
    ipcRenderer.invoke("leaves:create-request", input) as Promise<ApiResult<LeaveRequestRecord>>,
  decideLeaveRequest: (input: LeaveDecisionInput): Promise<ApiResult<LeaveRequestRecord>> =>
    ipcRenderer.invoke("leaves:decide-request", input) as Promise<ApiResult<LeaveRequestRecord>>,
  cancelLeaveRequest: (requestId: number): Promise<ApiResult<LeaveRequestRecord>> =>
    ipcRenderer.invoke("leaves:cancel-request", requestId) as Promise<ApiResult<LeaveRequestRecord>>,
  listLeaveRequests: (filter?: LeaveRequestFilter): Promise<ApiResult<LeaveRequestRecord[]>> =>
    ipcRenderer.invoke("leaves:list-requests", filter ?? {}) as Promise<ApiResult<LeaveRequestRecord[]>>,
  getEmployeeLeaveSummary: (employeeId: number, year?: number): Promise<ApiResult<EmployeeLeaveSummary>> =>
    ipcRenderer.invoke("leaves:get-employee-summary", employeeId, year) as Promise<ApiResult<EmployeeLeaveSummary>>,
  getLowBalances: (year?: number): Promise<ApiResult<LowBalanceAlert[]>> =>
    ipcRenderer.invoke("leaves:get-low-balances", year) as Promise<ApiResult<LowBalanceAlert[]>>,
  listEmployeeFiles: (employeeId: number): Promise<ApiResult<EmployeeFilesResult>> =>
    ipcRenderer.invoke("documents:list", employeeId) as Promise<ApiResult<EmployeeFilesResult>>,
  scanEmployeeFiles: (employeeId: number): Promise<ApiResult<ScanResult>> =>
    ipcRenderer.invoke("documents:scan", employeeId) as Promise<ApiResult<ScanResult>>,
  scanAllEmployeeFiles: (): Promise<ApiResult<ScanAllResult>> =>
    ipcRenderer.invoke("documents:scan-all") as Promise<ApiResult<ScanAllResult>>,
  ensureEmployeeFolder: (employeeId: number): Promise<ApiResult<EnsureFolderResult>> =>
    ipcRenderer.invoke("documents:ensure-folder", employeeId) as Promise<ApiResult<EnsureFolderResult>>,
  openEmployeeFolder: (employeeId: number): Promise<ApiResult<OpenFolderResult>> =>
    ipcRenderer.invoke("documents:open-folder", employeeId) as Promise<ApiResult<OpenFolderResult>>,
  pickAndAddDocument: (input: PickAndAddInput): Promise<ApiResult<PickAndAddResult>> =>
    ipcRenderer.invoke("documents:pick-and-add", input) as Promise<ApiResult<PickAndAddResult>>,
  readDocument: (documentId: number): Promise<ApiResult<DocumentReadResult>> =>
    ipcRenderer.invoke("documents:read", documentId) as Promise<ApiResult<DocumentReadResult>>,
  setTheme: (preference: ThemePreference): Promise<ThemePreference> =>
    ipcRenderer.invoke("theme:set", preference) as Promise<ThemePreference>,
  initialTheme,
  initialSystemDark,
  onSystemThemeChanged: (listener: (isDark: boolean) => void): (() => void) => {
    const handleThemeChange = (_event: Electron.IpcRendererEvent, isDark: boolean) => {
      listener(isDark);
    };
    ipcRenderer.on("theme:system-changed", handleThemeChange);
    return () => ipcRenderer.removeListener("theme:system-changed", handleThemeChange);
  },
});