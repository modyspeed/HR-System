/**
 * LeaveDesk — خدمة ملفات الموظفين (فولدر لكل موظف باسم كوده).
 * كل الدوال تأخذ (database, root) حيث root = مجلد employee_files المعتمد.
 * لا حذف فعلي للملفات أبدًا (قرار D8): التطبيق يضيف ويقرأ ويربط فقط.
 */
import {
  constants as fsConstants,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import type { Database } from "better-sqlite3";
import { AppError } from "../errors";
import {
  MAX_FILE_BYTES,
  PathSafetyError,
  assertRealPathInside,
  assertSafeFolderName,
  detectContentType,
  expectedContentType,
  pathTools,
  sanitizeFileName,
} from "../pathSafety";

export type DocumentCategory = "general" | "leave_form" | "decision" | "import_source";

export interface DocumentRecord {
  id: number;
  employeeId: number;
  category: DocumentCategory;
  relatedLeaveId: number | null;
  relatedDecisionId: number | null;
  fileName: string;
  relativePath: string;
  fileSize: number | null;
  addedVia: "upload" | "folder_scan";
  createdAt: string;
  exists: boolean;
}

export interface EmployeeFilesResult {
  employeeId: number;
  employeeCode: string;
  folderName: string;
  folderExists: boolean;
  files: DocumentRecord[];
}

export interface ScanResult {
  employeeId: number;
  folderExists: boolean;
  added: number;
  alreadyLinked: number;
  missing: number;
}

export interface ScanAllResult {
  scannedEmployees: number;
  added: number;
  unknownFolders: string[];
}

export interface AddFileInput {
  employeeId: number;
  sourcePath: string;
  category: DocumentCategory;
  relatedLeaveId?: number | null;
  relatedDecisionId?: number | null;
}

export interface FileOptions {
  maxBytes?: number;
}

interface EmployeeRow {
  id: number;
  code: string;
}

interface DocumentDbRow {
  id: number;
  employee_id: number;
  category: DocumentCategory;
  related_leave_id: number | null;
  related_decision_id: number | null;
  file_name: string;
  relative_path: string;
  file_size: number | null;
  added_via: "upload" | "folder_scan";
  created_at: string;
}

const SUBFOLDERS = ["leaves", "decisions"] as const;
const MAX_ENTRIES_PER_EMPLOYEE = 2000;
const UPLOAD_CATEGORIES: DocumentCategory[] = ["general", "leave_form", "decision"];

function getEmployee(database: Database, employeeId: number): EmployeeRow {
  const row = database.prepare("SELECT id, code FROM employees WHERE id = ?").get(employeeId) as EmployeeRow | undefined;
  if (!row) throw new AppError("EMPLOYEE_NOT_FOUND", "الموظف غير موجود.");
  return row;
}

function readCodePrefix(database: Database): string {
  const row = database.prepare("SELECT value FROM settings WHERE key = 'code_prefix'").get() as { value: string } | undefined;
  return row?.value ?? "";
}

function assertRootReady(root: string): void {
  if (typeof root !== "string" || root.trim() === "") {
    throw new AppError("FILES_ROOT_NOT_SET", "مجلد ملفات الموظفين غير محدد. حدده من الإعدادات.");
  }
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
}

function wrapSafety<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PathSafetyError) throw new AppError(error.code, error.message);
    throw error;
  }
}

/**
 * اسم فولدر الموظف الفعلي: فولدر باسم الكود إن وُجد، وإلا فولدر بالرقم فقط بعد حذف بادئة الكود
 * (مثال: 101 للموظف EMP-101)، وإلا اسم الكود (يُنشأ عند الطلب).
 */
export function resolveEmployeeFolderName(database: Database, root: string, employee: EmployeeRow): string {
  const byCode = assertSafeFolderName(employee.code);
  if (existsSync(join(root, byCode))) return byCode;
  const prefix = readCodePrefix(database);
  if (prefix !== "" && employee.code.startsWith(prefix)) {
    const stripped = employee.code.slice(prefix.length);
    if (stripped !== "") {
      const numeric = assertSafeFolderName(stripped);
      if (existsSync(join(root, numeric))) return numeric;
    }
  }
  return byCode;
}

function employeeFolderPath(database: Database, root: string, employee: EmployeeRow): { folderName: string; absolutePath: string } {
  const folderName = resolveEmployeeFolderName(database, root, employee);
  const absolutePath = pathTools.resolveInside(root, folderName);
  return { folderName, absolutePath };
}

export function ensureEmployeeFolder(database: Database, root: string, employeeId: number): { folderName: string; absolutePath: string } {
  return wrapSafety(() => {
    assertRootReady(root);
    const employee = getEmployee(database, employeeId);
    const { folderName, absolutePath } = employeeFolderPath(database, root, employee);
    assertRealPathInside({ existsSync, realpathSync }, root, absolutePath);
    mkdirSync(absolutePath, { recursive: true });
    for (const sub of SUBFOLDERS) mkdirSync(pathTools.resolveInside(root, folderName, sub), { recursive: true });
    return { folderName, absolutePath };
  });
}

/** مسار فولدر الموظف لفتحه في مستكشف الملفات (ينشئه إن لم يوجد). */
export function getFolderToOpen(database: Database, root: string, employeeId: number): string {
  return ensureEmployeeFolder(database, root, employeeId).absolutePath;
}

function categoryFromRelative(relative: string): DocumentCategory {
  const second = relative.split("/")[1]?.toLowerCase();
  if (second === "leaves") return "leave_form";
  if (second === "decisions") return "decision";
  return "general";
}

function hasAllowedExtension(name: string): boolean {
  return [".pdf", ".png", ".jpg", ".jpeg"].includes(extname(name).toLowerCase());
}

function mapRow(row: DocumentDbRow, root: string): DocumentRecord {
  let fileExists = false;
  try {
    fileExists = existsSync(pathTools.fromStoredRelative(root, row.relative_path));
  } catch {
    fileExists = false;
  }
  return {
    id: row.id,
    employeeId: row.employee_id,
    category: row.category,
    relatedLeaveId: row.related_leave_id,
    relatedDecisionId: row.related_decision_id,
    fileName: row.file_name,
    relativePath: row.relative_path,
    fileSize: row.file_size,
    addedVia: row.added_via,
    createdAt: row.created_at,
    exists: fileExists,
  };
}

function collectFiles(root: string, folderAbsolute: string, folderName: string): Array<{ relative: string; size: number; name: string }> {
  const found: Array<{ relative: string; size: number; name: string }> = [];
  const walk = (directory: string, depth: number): void => {
    if (depth > 2 || found.length >= MAX_ENTRIES_PER_EMPLOYEE) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isSymbolicLink()) continue; // لا نتبع الروابط الرمزية أبدًا
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute, depth + 1);
      } else if (entry.isFile() && hasAllowedExtension(entry.name)) {
        found.push({ relative: pathTools.toStoredRelative(root, absolute), size: statSync(absolute).size, name: entry.name });
      }
    }
  };
  walk(folderAbsolute, 0);
  void folderName;
  return found;
}

/** يمسح فولدر الموظف ويربط أي ملف مسموح غير مربوط. لا يحذف شيئًا ولا يلمس الروابط الموجودة. */
export function scanEmployeeFolder(database: Database, root: string, employeeId: number): ScanResult {
  return wrapSafety(() => {
    assertRootReady(root);
    const employee = getEmployee(database, employeeId);
    const { folderName, absolutePath } = employeeFolderPath(database, root, employee);
    if (!existsSync(absolutePath)) {
      const missing = (database.prepare("SELECT COUNT(*) AS c FROM employee_documents WHERE employee_id = ?").get(employeeId) as { c: number }).c;
      return { employeeId, folderExists: false, added: 0, alreadyLinked: 0, missing };
    }
    assertRealPathInside({ existsSync, realpathSync }, root, absolutePath);
    const files = collectFiles(root, absolutePath, folderName);
    const insert = database.prepare(`
      INSERT OR IGNORE INTO employee_documents (employee_id, category, file_name, relative_path, file_size, added_via)
      VALUES (?, ?, ?, ?, ?, 'folder_scan')
    `);
    let added = 0;
    database.transaction(() => {
      for (const file of files) {
        const result = insert.run(employeeId, categoryFromRelative(file.relative), file.name, file.relative, file.size);
        added += result.changes;
      }
    })();
    const present = new Set(files.map((file) => file.relative));
    const rows = database.prepare("SELECT relative_path FROM employee_documents WHERE employee_id = ?").all(employeeId) as Array<{ relative_path: string }>;
    const missing = rows.filter((row) => !present.has(row.relative_path)).length;
    return { employeeId, folderExists: true, added, alreadyLinked: files.length - added, missing };
  });
}

export function scanAllEmployees(database: Database, root: string): ScanAllResult {
  return wrapSafety(() => {
    assertRootReady(root);
    const employees = database.prepare("SELECT id, code FROM employees ORDER BY id").all() as EmployeeRow[];
    const prefix = readCodePrefix(database);
    const known = new Set<string>();
    let added = 0;
    let scanned = 0;
    for (const employee of employees) {
      try {
        known.add(assertSafeFolderName(employee.code).toLowerCase());
        if (prefix !== "" && employee.code.startsWith(prefix)) known.add(employee.code.slice(prefix.length).toLowerCase());
      } catch {
        continue; // كود لا يصلح اسم فولدر: يُتجاهل هنا ويظهر خطأه عند التعامل مع الموظف
      }
      const result = scanEmployeeFolder(database, root, employee.id);
      if (result.folderExists) {
        scanned += 1;
        added += result.added;
      }
    }
    const unknownFolders = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .filter((name) => !known.has(name.toLowerCase()))
      .sort();
    return { scannedEmployees: scanned, added, unknownFolders };
  });
}

export function listEmployeeFiles(database: Database, root: string, employeeId: number): EmployeeFilesResult {
  return wrapSafety(() => {
    assertRootReady(root);
    const employee = getEmployee(database, employeeId);
    const scan = scanEmployeeFolder(database, root, employeeId);
    const { folderName } = employeeFolderPath(database, root, employee);
    const rows = database.prepare(`
      SELECT id, employee_id, category, related_leave_id, related_decision_id, file_name, relative_path, file_size, added_via, created_at
      FROM employee_documents WHERE employee_id = ? ORDER BY category, file_name COLLATE NOCASE, id
    `).all(employeeId) as DocumentDbRow[];
    return {
      employeeId,
      employeeCode: employee.code,
      folderName,
      folderExists: scan.folderExists,
      files: rows.map((row) => mapRow(row, root)),
    };
  });
}

function readHead(path: string, length: number): Buffer {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = readSync(descriptor, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(descriptor);
  }
}

function targetSubfolder(category: DocumentCategory): string | null {
  if (category === "leave_form") return "leaves";
  if (category === "decision") return "decisions";
  return null;
}

function uniqueTargetPath(directory: string, fileName: string): { fileName: string; absolutePath: string } {
  const extension = extname(fileName);
  const stem = basename(fileName, extension);
  let candidate = fileName;
  for (let counter = 2; existsSync(join(directory, candidate)); counter += 1) {
    candidate = `${stem} (${counter})${extension}`;
    if (counter > 500) throw new AppError("FILE_NAME_EXHAUSTED", "تعذر إيجاد اسم متاح للملف.");
  }
  return { fileName: candidate, absolutePath: join(directory, candidate) };
}

/**
 * ينسخ ملفًا اختاره المستخدم (مسار من مربع حوار النظام في العملية الرئيسية فقط) إلى فولدر الموظف ويربطه.
 * التحقق: الامتداد، الحجم، تطابق المحتوى مع الامتداد، ملكية الإجازة/القرار للموظف، وعدم الكتابة فوق ملف موجود.
 */
export function addFileFromPath(database: Database, root: string, input: AddFileInput, options: FileOptions = {}): DocumentRecord {
  return wrapSafety(() => {
    if (!UPLOAD_CATEGORIES.includes(input.category)) {
      throw new AppError("INVALID_CATEGORY", "تصنيف الملف غير صحيح.");
    }
    const maxBytes = options.maxBytes ?? MAX_FILE_BYTES;
    const employee = getEmployee(database, input.employeeId);

    if (input.category === "leave_form") {
      if (!input.relatedLeaveId) throw new AppError("RELATED_LEAVE_REQUIRED", "استمارة الإجازة يجب ربطها بطلب إجازة.");
      const leave = database.prepare("SELECT employee_id FROM leave_requests WHERE id = ?").get(input.relatedLeaveId) as { employee_id: number } | undefined;
      if (!leave || leave.employee_id !== employee.id) {
        throw new AppError("RELATED_LEAVE_MISMATCH", "طلب الإجازة غير موجود أو لا يخص هذا الموظف.");
      }
    } else if (input.relatedLeaveId) {
      throw new AppError("RELATED_LEAVE_NOT_ALLOWED", "الربط بطلب إجازة مسموح لاستمارات الإجازة فقط.");
    }
    if (input.category === "decision") {
      if (!input.relatedDecisionId) throw new AppError("RELATED_DECISION_REQUIRED", "مرفق القرار يجب ربطه بقرار.");
      const decision = database.prepare("SELECT employee_id FROM decisions WHERE id = ?").get(input.relatedDecisionId) as { employee_id: number } | undefined;
      if (!decision || decision.employee_id !== employee.id) {
        throw new AppError("RELATED_DECISION_MISMATCH", "القرار غير موجود أو لا يخص هذا الموظف.");
      }
    } else if (input.relatedDecisionId) {
      throw new AppError("RELATED_DECISION_NOT_ALLOWED", "الربط بقرار مسموح لمرفقات القرارات فقط.");
    }

    const safeName = sanitizeFileName(basename(String(input.sourcePath ?? "").replace(/\\/g, "/")));
    let sourceStat;
    try {
      sourceStat = statSync(input.sourcePath);
    } catch {
      throw new AppError("SOURCE_NOT_FOUND", "الملف المختار غير موجود.");
    }
    if (!sourceStat.isFile()) throw new AppError("SOURCE_NOT_FILE", "المسار المختار ليس ملفًا.");
    if (sourceStat.size === 0) throw new AppError("FILE_EMPTY", "الملف فارغ.");
    if (sourceStat.size > maxBytes) {
      throw new AppError("FILE_TOO_LARGE", `حجم الملف أكبر من الحد المسموح (${Math.floor(maxBytes / (1024 * 1024))} ميجابايت).`);
    }
    const detected = detectContentType(readHead(input.sourcePath, 16));
    if (detected === null || detected !== expectedContentType(safeName)) {
      throw new AppError("CONTENT_MISMATCH", "محتوى الملف لا يطابق امتداده (ملف PDF أو صورة صالح فقط).");
    }

    const { absolutePath: employeeFolder, folderName } = ensureEmployeeFolder(database, root, input.employeeId);
    const sub = targetSubfolder(input.category);
    const directory = sub === null ? employeeFolder : pathTools.resolveInside(root, folderName, sub);
    assertRealPathInside({ existsSync, realpathSync }, root, directory);
    mkdirSync(directory, { recursive: true });

    const target = uniqueTargetPath(directory, safeName);
    pathTools.resolveInside(root, folderName, ...(sub === null ? [] : [sub]), target.fileName);
    copyFileSync(input.sourcePath, target.absolutePath, fsConstants.COPYFILE_EXCL);

    const relative = pathTools.toStoredRelative(root, target.absolutePath);
    const documentId = database.transaction(() => {
      const result = database.prepare(`
        INSERT INTO employee_documents
          (employee_id, category, related_leave_id, related_decision_id, file_name, relative_path, file_size, added_via)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'upload')
      `).run(
        input.employeeId,
        input.category,
        input.relatedLeaveId ?? null,
        input.relatedDecisionId ?? null,
        target.fileName,
        relative,
        sourceStat.size,
      );
      const id = Number(result.lastInsertRowid);
      database.prepare(`
        INSERT INTO audit_log (entity, entity_id, action, old_value, new_value)
        VALUES ('employee_document', ?, 'add', NULL, ?)
      `).run(id, JSON.stringify({ category: input.category, extension: extname(target.fileName).toLowerCase(), size: sourceStat.size }));
      return id;
    })();

    const row = database.prepare(`
      SELECT id, employee_id, category, related_leave_id, related_decision_id, file_name, relative_path, file_size, added_via, created_at
      FROM employee_documents WHERE id = ?
    `).get(documentId) as DocumentDbRow;
    return mapRow(row, root);
  });
}

/** يقرأ محتوى ملف مربوط للمعاينة. يرفض أي مسار خارج الجذر حتى لو كان مخزَّنًا هكذا في القاعدة. */
export function readDocumentBytes(
  database: Database,
  root: string,
  documentId: number,
  options: FileOptions = {},
): { fileName: string; mimeType: "application/pdf" | "image/png" | "image/jpeg"; bytes: Buffer } {
  return wrapSafety(() => {
    assertRootReady(root);
    const row = database.prepare("SELECT file_name, relative_path FROM employee_documents WHERE id = ?").get(documentId) as
      | { file_name: string; relative_path: string }
      | undefined;
    if (!row) throw new AppError("DOCUMENT_NOT_FOUND", "الملف غير موجود.");
    const absolute = pathTools.fromStoredRelative(root, row.relative_path);
    if (!existsSync(absolute)) throw new AppError("FILE_MISSING", "الملف غير موجود على القرص (ربما نُقل أو حُذف من خارج البرنامج).");
    assertRealPathInside({ existsSync, realpathSync }, root, absolute);
    const stat = statSync(absolute);
    if (!stat.isFile()) throw new AppError("SOURCE_NOT_FILE", "المسار ليس ملفًا.");
    const maxBytes = options.maxBytes ?? MAX_FILE_BYTES;
    if (stat.size > maxBytes) throw new AppError("FILE_TOO_LARGE", "حجم الملف أكبر من الحد المسموح للمعاينة.");
    const bytes = readFileSync(absolute);
    const detected = detectContentType(bytes.subarray(0, 16));
    if (detected === null) throw new AppError("CONTENT_MISMATCH", "الملف ليس PDF أو صورة صالحة.");
    return { fileName: row.file_name, mimeType: detected, bytes };
  });
}
