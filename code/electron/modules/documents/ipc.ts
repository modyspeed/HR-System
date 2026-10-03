import type { Database } from "better-sqlite3";
import type { IpcMain } from "electron";
import { z } from "zod";
import { AppError } from "./errors";
import { PathSafetyError } from "./pathSafety";
import { documentIdSchema, employeeIdSchema, pickAndAddInputSchema } from "./schemas";
import {
  addFileFromPath,
  getFolderToOpen,
  listEmployeeFiles,
  readDocumentBytes,
  scanAllEmployees,
  scanEmployeeFolder,
  ensureEmployeeFolder,
} from "./services/fileService";

/** خدمات المضيف (Electron) التي لا تُنفَّذ داخل الخدمة نفسها: مربع الحوار وفتح المجلد ومسار الجذر. */
export interface DocumentsHostServices {
  /** مسار مجلد employee_files المعتمد (من الإعدادات أو الافتراضي). */
  getFilesRoot(): string;
  /** يعرض مربع اختيار ملفات من النظام ويرجع المسارات المختارة (فارغة إن ألغى المستخدم). */
  pickFiles(): Promise<string[]>;
  /** يفتح مسارًا في مستكشف الملفات؛ يرجع "" عند النجاح أو نص الخطأ (سلوك shell.openPath). */
  openFolder(absolutePath: string): Promise<string>;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError("VALIDATION_ERROR", result.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة.");
}

function errorResult(error: unknown) {
  if (error instanceof AppError || error instanceof PathSafetyError) {
    return { ok: false as const, error: { code: error.code, message: error.message } };
  }
  if (error instanceof z.ZodError) {
    return { ok: false as const, error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة." } };
  }
  return { ok: false as const, error: { code: "INTERNAL_ERROR", message: "تعذر إتمام العملية." } };
}

function registerSafe(ipcMain: IpcMain, channel: string, operation: (...args: unknown[]) => unknown | Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return { ok: true as const, data: await operation(...args) };
    } catch (error) {
      return errorResult(error);
    }
  });
}

export function registerDocumentsIpc(database: Database, ipcMain: IpcMain, host: DocumentsHostServices): void {
  registerSafe(ipcMain, "documents:list", (employeeId) =>
    listEmployeeFiles(database, host.getFilesRoot(), parse(employeeIdSchema, employeeId)));
  registerSafe(ipcMain, "documents:scan", (employeeId) =>
    scanEmployeeFolder(database, host.getFilesRoot(), parse(employeeIdSchema, employeeId)));
  registerSafe(ipcMain, "documents:scan-all", () => scanAllEmployees(database, host.getFilesRoot()));
  registerSafe(ipcMain, "documents:ensure-folder", (employeeId) => {
    const { folderName } = ensureEmployeeFolder(database, host.getFilesRoot(), parse(employeeIdSchema, employeeId));
    return { folderName };
  });
  registerSafe(ipcMain, "documents:open-folder", async (employeeId) => {
    const folder = getFolderToOpen(database, host.getFilesRoot(), parse(employeeIdSchema, employeeId));
    const failure = await host.openFolder(folder);
    if (failure !== "") throw new AppError("OPEN_FOLDER_FAILED", "تعذر فتح الفولدر في مستكشف الملفات.");
    return { opened: true };
  });
  registerSafe(ipcMain, "documents:pick-and-add", async (input) => {
    const request = parse(pickAndAddInputSchema, input);
    const picked = await host.pickFiles();
    const added = [];
    const errors: Array<{ fileName: string; code: string; message: string }> = [];
    for (const sourcePath of picked) {
      const fileName = sourcePath.split(/[\\/]/).pop() ?? sourcePath;
      try {
        added.push(addFileFromPath(database, host.getFilesRoot(), { ...request, sourcePath }));
      } catch (error) {
        const failure = errorResult(error).error;
        errors.push({ fileName, code: failure.code, message: failure.message });
      }
    }
    return { cancelled: picked.length === 0, added, errors };
  });
  registerSafe(ipcMain, "documents:read", (documentId) => {
    const { fileName, mimeType, bytes } = readDocumentBytes(database, host.getFilesRoot(), parse(documentIdSchema, documentId));
    return { fileName, mimeType, base64: bytes.toString("base64") };
  });
}
