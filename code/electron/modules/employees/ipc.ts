import type { Database } from "better-sqlite3";
import type { IpcMain } from "electron";
import { EmployeeService } from "./services/employeeService";

export function registerEmployeeIpc(database: Database, ipcMain: IpcMain): void {
  const service = new EmployeeService(database);

  ipcMain.handle("employees:list", (_event, filter: unknown) => service.list(filter));
  ipcMain.handle("employees:count", () => service.count());
  ipcMain.handle("employees:get", (_event, id: unknown) => service.getById(id));
  ipcMain.handle("employees:create", (_event, input: unknown) => service.create(input));
  ipcMain.handle("employees:update", (_event, id: unknown, input: unknown) => service.update(id, input));
  ipcMain.handle("employees:set-status", (_event, input: unknown) => service.setStatus(input));
  ipcMain.handle("departments:list", () => service.listDepartments());
  ipcMain.handle("departments:create", (_event, name: unknown) => service.createDepartment(name));
}