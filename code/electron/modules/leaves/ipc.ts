import type { Database } from "better-sqlite3";
import type { IpcMain } from "electron";
import { z } from "zod";
import { AppError } from "./errors";
import {
  cancelRequest,
  createRequest,
  decideRequest,
  getEmployeeLeaveSummary,
  getLowBalances,
  listRequests,
} from "./services/leaveRequestService";
import {
  employeeLeaveSummarySchema,
  leaveDecisionInputSchema,
  leaveRequestFilterSchema,
  leaveRequestInputSchema,
  leaveRequestIdSchema,
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

export function registerLeavesIpc(database: Database, ipcMain: IpcMain): void {
  registerSafe(ipcMain, "leaves:create-request", (input) =>
    createRequest(database, parse(leaveRequestInputSchema, input)));
  registerSafe(ipcMain, "leaves:decide-request", (input) =>
    decideRequest(database, parse(leaveDecisionInputSchema, input)));
  registerSafe(ipcMain, "leaves:cancel-request", (requestId) =>
    cancelRequest(database, parse(leaveRequestIdSchema, requestId)));
  registerSafe(ipcMain, "leaves:list-requests", (filter) =>
    listRequests(database, parse(leaveRequestFilterSchema, filter ?? {})));
  registerSafe(ipcMain, "leaves:get-employee-summary", (employeeId, year) =>
    getEmployeeLeaveSummary(database, parse(employeeLeaveSummarySchema, { employeeId, year }).employeeId, year));
  registerSafe(ipcMain, "leaves:get-low-balances", (year) =>
    getLowBalances(database, year));
}
