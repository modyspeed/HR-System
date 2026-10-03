import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync as readSql } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "better-sqlite3";
import {
  addFileFromPath,
  ensureEmployeeFolder,
  listEmployeeFiles,
  readDocumentBytes,
  scanAllEmployees,
  scanEmployeeFolder,
} from "./fileService";

// تعمل ضمن npm run test:db (SQLite حقيقي) وبفولدرات مؤقتة؛ بيانات وهمية فقط.
const isElectronNode = process.versions.electron !== undefined;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

async function createDatabase(): Promise<Database> {
  const { default: DatabaseConstructor } = await import("better-sqlite3");
  const database = new DatabaseConstructor(":memory:");
  database.pragma("foreign_keys = ON");
  for (const file of [
    "../../../core/migrations/001_core.sql",
    "../../employees/migrations/001_employees.sql",
    "../../leaves/migrations/001_leaves.sql",
    "../../leaves/migrations/002_seed.sql",
    "../../leaves/migrations/003_request_year_days.sql",
    "../../decisions/migrations/001_decisions.sql",
    "../migrations/001_documents.sql",
  ]) database.exec(readSql(new URL(file, import.meta.url), "utf8"));
  return database as Database;
}

function addEmployee(database: Database, code: string, name = "موظف اختبار"): number {
  database.prepare("INSERT OR IGNORE INTO departments (name) VALUES ('قسم')").run();
  const department = database.prepare("SELECT id FROM departments WHERE name = 'قسم'").get() as { id: number };
  return Number(database.prepare("INSERT INTO employees (code, full_name, department_id, hire_date) VALUES (?, ?, ?, '2024-01-01')").run(code, name, department.id).lastInsertRowid);
}

describe.skipIf(!isElectronNode)("employee files with real SQLite and real folders", () => {
  let workdir: string;
  let root: string;
  let incoming: string;
  let database: Database;

  beforeEach(async () => {
    workdir = mkdtempSync(join(tmpdir(), "leavedesk-files-"));
    root = join(workdir, "employee_files");
    incoming = join(workdir, "incoming");
    mkdirSync(incoming, { recursive: true });
    database = await createDatabase();
  });
  afterEach(() => {
    database.close();
    rmSync(workdir, { recursive: true, force: true });
  });

  function source(name: string, content: Buffer = PDF): string {
    const path = join(incoming, name);
    writeFileSync(path, content);
    return path;
  }

  it("ينشئ فولدر الموظف باسم كوده مع leaves وdecisions", () => {
    const employeeId = addEmployee(database, "EMP-101");
    const { folderName } = ensureEmployeeFolder(database, root, employeeId);
    expect(folderName).toBe("EMP-101");
    expect(existsSync(join(root, "EMP-101", "leaves"))).toBe(true);
    expect(existsSync(join(root, "EMP-101", "decisions"))).toBe(true);
  });

  it("يرفض كودًا يصلح للهروب من الجذر (لا فولدر ولا كتابة خارج الجذر)", () => {
    const evil = addEmployee(database, "../evil");
    expect(() => ensureEmployeeFolder(database, root, evil)).toThrowError(expect.objectContaining({ code: "FOLDER_NAME_INVALID" }));
    expect(existsSync(join(workdir, "evil"))).toBe(false);
    expect(() => addFileFromPath(database, root, { employeeId: evil, sourcePath: source("a.pdf"), category: "general" }))
      .toThrowError(expect.objectContaining({ code: "FOLDER_NAME_INVALID" }));
  });

  it("يرفع ملف PDF عامًا ويسجله بمسار نسبي وبـ audit بلا أسماء", () => {
    const employeeId = addEmployee(database, "EMP-101");
    const record = addFileFromPath(database, root, { employeeId, sourcePath: source("عقد العمل.pdf"), category: "general" });
    expect(record.relativePath).toBe("EMP-101/عقد العمل.pdf");
    expect(record.addedVia).toBe("upload");
    expect(readFileSync(join(root, "EMP-101", "عقد العمل.pdf")).equals(PDF)).toBe(true);
    const audit = database.prepare("SELECT new_value FROM audit_log WHERE entity = 'employee_document'").get() as { new_value: string };
    expect(audit.new_value).not.toContain("عقد");
    expect(JSON.parse(audit.new_value)).toMatchObject({ category: "general", extension: ".pdf" });
  });

  it("لا يكتب فوق ملف موجود: يضيف (2) للاسم", () => {
    const employeeId = addEmployee(database, "EMP-101");
    const first = addFileFromPath(database, root, { employeeId, sourcePath: source("form.pdf"), category: "general" });
    const second = addFileFromPath(database, root, { employeeId, sourcePath: source("form.pdf"), category: "general" });
    expect(first.fileName).toBe("form.pdf");
    expect(second.fileName).toBe("form (2).pdf");
  });

  it("يرفض امتدادًا ممنوعًا ومحتوى لا يطابق الامتداد وملفًا فارغًا وحجمًا زائدًا", () => {
    const employeeId = addEmployee(database, "EMP-101");
    const add = (path: string, maxBytes?: number) => addFileFromPath(database, root, { employeeId, sourcePath: path, category: "general" }, { maxBytes });
    expect(() => add(source("virus.exe", Buffer.from("MZ")))).toThrowError(expect.objectContaining({ code: "EXTENSION_NOT_ALLOWED" }));
    expect(() => add(source("fake.pdf", Buffer.from("just text, not a pdf")))).toThrowError(expect.objectContaining({ code: "CONTENT_MISMATCH" }));
    expect(() => add(source("png-as-pdf.pdf", PNG))).toThrowError(expect.objectContaining({ code: "CONTENT_MISMATCH" }));
    expect(() => add(source("empty.pdf", Buffer.alloc(0)))).toThrowError(expect.objectContaining({ code: "FILE_EMPTY" }));
    expect(() => add(source("big.pdf"), 10)).toThrowError(expect.objectContaining({ code: "FILE_TOO_LARGE" }));
    expect(() => add(join(incoming, "missing.pdf"))).toThrowError(expect.objectContaining({ code: "SOURCE_NOT_FOUND" }));
    expect(database.prepare("SELECT COUNT(*) AS c FROM employee_documents").get()).toEqual({ c: 0 });
  });

  it("استمارة الإجازة: تُحفظ في leaves/ وتُربط بالطلب، ويُرفض طلب موظف آخر", () => {
    const employeeId = addEmployee(database, "EMP-101");
    const otherId = addEmployee(database, "EMP-102");
    const annual = (database.prepare("SELECT id FROM leave_types WHERE key = 'annual'").get() as { id: number }).id;
    const leave = (employee: number) => Number(database.prepare(
      "INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days) VALUES (?, ?, '2026-03-01', '2026-03-02', 2)",
    ).run(employee, annual).lastInsertRowid);
    const mine = leave(employeeId);
    const theirs = leave(otherId);

    const record = addFileFromPath(database, root, { employeeId, sourcePath: source("استمارة.pdf"), category: "leave_form", relatedLeaveId: mine });
    expect(record.relativePath).toBe("EMP-101/leaves/استمارة.pdf");
    expect(record.relatedLeaveId).toBe(mine);
    expect(() => addFileFromPath(database, root, { employeeId, sourcePath: source("x.pdf"), category: "leave_form", relatedLeaveId: theirs }))
      .toThrowError(expect.objectContaining({ code: "RELATED_LEAVE_MISMATCH" }));
    expect(() => addFileFromPath(database, root, { employeeId, sourcePath: source("y.pdf"), category: "leave_form" }))
      .toThrowError(expect.objectContaining({ code: "RELATED_LEAVE_REQUIRED" }));
    expect(() => addFileFromPath(database, root, { employeeId, sourcePath: source("z.pdf"), category: "general", relatedLeaveId: mine }))
      .toThrowError(expect.objectContaining({ code: "RELATED_LEAVE_NOT_ALLOWED" }));
  });

  it("المسح يربط الملفات الموضوعة يدويًا بتصنيفها، ولا يكرر، ويبلّغ عن المفقود", () => {
    const employeeId = addEmployee(database, "EMP-101");
    mkdirSync(join(root, "EMP-101", "leaves"), { recursive: true });
    writeFileSync(join(root, "EMP-101", "بطاقة.pdf"), PDF);
    writeFileSync(join(root, "EMP-101", "leaves", "اجازة.pdf"), PDF);
    writeFileSync(join(root, "EMP-101", "notes.txt"), "ignored");
    writeFileSync(join(root, "EMP-101", ".hidden.pdf"), PDF);

    const first = scanEmployeeFolder(database, root, employeeId);
    expect(first).toMatchObject({ folderExists: true, added: 2, alreadyLinked: 0, missing: 0 });
    expect(scanEmployeeFolder(database, root, employeeId)).toMatchObject({ added: 0, alreadyLinked: 2 });

    const listed = listEmployeeFiles(database, root, employeeId);
    expect(listed.files.map((file) => [file.fileName, file.category, file.addedVia, file.exists])).toEqual([
      ["بطاقة.pdf", "general", "folder_scan", true],
      ["اجازة.pdf", "leave_form", "folder_scan", true],
    ].sort((a, b) => String(a[1]).localeCompare(String(b[1]))));

    rmSync(join(root, "EMP-101", "بطاقة.pdf"));
    expect(scanEmployeeFolder(database, root, employeeId)).toMatchObject({ missing: 1 });
    expect(listEmployeeFiles(database, root, employeeId).files.filter((file) => !file.exists)).toHaveLength(1);
  });

  it("فولدر بالرقم فقط يُربط بالموظف حسب code_prefix، ومسح الكل يبلّغ عن فولدرات غير معروفة", () => {
    database.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('code_prefix', 'EMP-')").run();
    const employeeId = addEmployee(database, "EMP-205");
    mkdirSync(join(root, "205"), { recursive: true });
    writeFileSync(join(root, "205", "ملف.pdf"), PDF);
    mkdirSync(join(root, "999"), { recursive: true });
    mkdirSync(join(root, "random-folder"), { recursive: true });

    const result = scanAllEmployees(database, root);
    expect(result.scannedEmployees).toBe(1);
    expect(result.added).toBe(1);
    expect(result.unknownFolders).toEqual(["999", "random-folder"]);
    expect(listEmployeeFiles(database, root, employeeId).files[0].relativePath).toBe("205/ملف.pdf");
  });

  it("القراءة للمعاينة: تعيد البايتات، وترفض مسارًا مخزَّنًا خارج الجذر", () => {
    const employeeId = addEmployee(database, "EMP-101");
    const record = addFileFromPath(database, root, { employeeId, sourcePath: source("a.pdf"), category: "general" });
    const read = readDocumentBytes(database, root, record.id);
    expect(read.mimeType).toBe("application/pdf");
    expect(read.bytes.equals(PDF)).toBe(true);

    writeFileSync(join(workdir, "secret.pdf"), PDF);
    for (const evilPath of ["../secret.pdf", "EMP-101/../../secret.pdf", "/etc/passwd", "C:/Windows/win.ini"]) {
      database.prepare("UPDATE employee_documents SET relative_path = ? WHERE id = ?").run(evilPath, record.id);
      expect(() => readDocumentBytes(database, root, record.id)).toThrowError(expect.objectContaining({ code: "PATH_OUTSIDE_ROOT" }));
    }
    expect(() => readDocumentBytes(database, root, 99999)).toThrowError(expect.objectContaining({ code: "DOCUMENT_NOT_FOUND" }));
  });

  it("الرابط الرمزي: المسح لا يتبعه، والقراءة تعبره ممنوعة", () => {
    const employeeId = addEmployee(database, "EMP-101");
    ensureEmployeeFolder(database, root, employeeId);
    const outside = join(workdir, "outside.pdf");
    writeFileSync(outside, PDF);
    try {
      symlinkSync(outside, join(root, "EMP-101", "link.pdf"));
    } catch {
      return; // ويندوز بدون صلاحية إنشاء روابط رمزية: يُتخطى هذا الاختبار
    }
    expect(scanEmployeeFolder(database, root, employeeId).added).toBe(0);
    database.prepare(`INSERT INTO employee_documents (employee_id, category, file_name, relative_path, added_via)
                      VALUES (?, 'general', 'link.pdf', 'EMP-101/link.pdf', 'folder_scan')`).run(employeeId);
    const id = (database.prepare("SELECT id FROM employee_documents WHERE file_name = 'link.pdf'").get() as { id: number }).id;
    expect(() => readDocumentBytes(database, root, id)).toThrowError(expect.objectContaining({ code: "PATH_OUTSIDE_ROOT" }));
  });
});
