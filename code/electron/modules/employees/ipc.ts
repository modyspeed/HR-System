import type { Database } from "better-sqlite3";
import type { IpcMain } from "electron";
import { z } from "zod";
import {
  createDepartment,
  createEmployee,
  getEmployee,
  listDepartments,
  listEmployees,
  setEmployeeStatus,
  updateEmployee,
  AppError,
} from "./service";
import {
  departmentNameSchema,
  employeeIdSchema,
  employeeInputSchema,
  employeeListFilterSchema,
  employeeStatusInputSchema,
  employeeUpdateSchema,
} from "./schemas";

type IpcOperation = (...args: unknown[]) => unknown;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError("VALIDATION_ERROR", result.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة.");
}

function errorResult(error: unknown) {
  if (error instanceof AppError) {
    return { ok: false as const, error: { code: error.code, message: error.message } };
  }
  if (error instanceof z.ZodError) {
    return {
      ok: false as const,
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة.",
      },
    };
  }
  return { ok: false as const, error: { code: "INTERNAL_ERROR", message: "تعذر إتمام العملية." } };
}

function registerSafe(ipcMain: IpcMain, channel: string, operation: IpcOperation): void {
  ipcMain.handle(channel, (_event, ...args: unknown[]) => {
    try {
      return { ok: true as const, data: operation(...args) };
    } catch (error) {
      return errorResult(error);
    }
  });
}

export function registerEmployeeIpc(database: Database, ipcMain: IpcMain): void {
  registerSafe(ipcMain, "employees:list", (filter) =>
    listEmployees(database, parse(employeeListFilterSchema, filter)));
  registerSafe(ipcMain, "employees:get", (id) =>
    getEmployee(database, parse(employeeIdSchema, id)));
  registerSafe(ipcMain, "employees:create", (input) =>
    createEmployee(database, parse(employeeInputSchema, input)));
  registerSafe(ipcMain, "employees:update", (id, input) => {
    const request = parse(employeeUpdateSchema, { id, employee: input });
    return updateEmployee(database, request.id, request.employee);
  });
  registerSafe(ipcMain, "employees:set-status", (id, status) => {
    const request = parse(employeeStatusInputSchema, { id, status });
    return setEmployeeStatus(database, request.id, request.status);
  });
  registerSafe(ipcMain, "departments:list", () => listDepartments(database));
  registerSafe(ipcMain, "departments:create", (name) =>
    createDepartment(database, parse(departmentNameSchema, name)));
}