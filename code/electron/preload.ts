import { contextBridge, ipcRenderer } from "electron";
import type {
  ApiResult,
  AppSummary,
  DepartmentRecord,
  EmployeeStatus,
  EmployeeQuery,
  EmployeeWireInput,
  EmployeeWireRecord,
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