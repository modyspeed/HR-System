import { ipcMain } from "electron";
import type { Database } from "better-sqlite3";
import { electronModuleRegistry } from "../modules";
import { getEmployeeCount } from "../modules/employees/service";

interface EnabledModuleRow {
  key: string;
}

export function registerApplicationIpc(database: Database): void {
  ipcMain.handle("app:get-summary", () => {
    const enabledRows = database
      .prepare("SELECT key FROM app_modules WHERE enabled = 1 ORDER BY key")
      .all() as EnabledModuleRow[];
    const registryById = new Map(
      electronModuleRegistry.map((module) => [module.id, module]),
    );

    const enabledModules = enabledRows.flatMap((row) => {
        const module = registryById.get(row.key);
        return module ? [{ id: module.id, nameAr: module.nameAr }] : [];
      });
    return { employeeCount: getEmployeeCount(database), enabledModules };
  });
}