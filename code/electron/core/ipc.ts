import { ipcMain } from "electron";
import type { Database } from "better-sqlite3";
import type { AppSummary } from "../../src/core/api/contracts";
import { electronModuleRegistry } from "../modules";

interface EnabledModuleRow {
  key: string;
}

interface EmployeeCountRow {
  count: number;
}

export function registerApplicationIpc(database: Database): void {
  ipcMain.handle("app:get-summary", (): AppSummary => {
    const employeeCount = database
      .prepare("SELECT COUNT(*) AS count FROM employees")
      .get() as EmployeeCountRow;
    const enabledRows = database
      .prepare("SELECT key FROM app_modules WHERE enabled = 1 ORDER BY key")
      .all() as EnabledModuleRow[];
    const registryById = new Map(
      electronModuleRegistry.map((module) => [module.id, module]),
    );

    return {
      employeeCount: employeeCount.count,
      enabledModules: enabledRows.flatMap((row) => {
        const module = registryById.get(row.key);
        return module ? [{ id: module.id, nameAr: module.nameAr }] : [];
      }),
    };
  });
}