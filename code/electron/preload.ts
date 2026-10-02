import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSummary,
  DepartmentRecord,
  EmployeeInput,
  EmployeeListFilter,
  EmployeeRecord,
  EmployeeStatus,
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
  getSummary: async (): Promise<AppSummary> => {
    const [employeeCount, enabledModules] = await Promise.all([
      ipcRenderer.invoke("employees:count") as Promise<number>,
      ipcRenderer.invoke("app:get-enabled-modules") as Promise<AppSummary["enabledModules"]>,
    ]);
    return { employeeCount, enabledModules };
  },
  listEmployees: (filter: EmployeeListFilter): Promise<EmployeeRecord[]> =>
    ipcRenderer.invoke("employees:list", filter) as Promise<EmployeeRecord[]>,
  getEmployee: (id: number): Promise<EmployeeRecord> =>
    ipcRenderer.invoke("employees:get", id) as Promise<EmployeeRecord>,
  createEmployee: (input: EmployeeInput): Promise<EmployeeRecord> =>
    ipcRenderer.invoke("employees:create", input) as Promise<EmployeeRecord>,
  updateEmployee: (id: number, input: EmployeeInput): Promise<EmployeeRecord> =>
    ipcRenderer.invoke("employees:update", id, input) as Promise<EmployeeRecord>,
  setEmployeeStatus: (id: number, status: EmployeeStatus): Promise<EmployeeRecord> =>
    ipcRenderer.invoke("employees:set-status", { id, status }) as Promise<EmployeeRecord>,
  listDepartments: (): Promise<DepartmentRecord[]> =>
    ipcRenderer.invoke("departments:list") as Promise<DepartmentRecord[]>,
  createDepartment: (name: string): Promise<DepartmentRecord> =>
    ipcRenderer.invoke("departments:create", name) as Promise<DepartmentRecord>,
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