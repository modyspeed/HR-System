import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Database } from "better-sqlite3";
import { AppError } from "./errors";
import { countLeaveDays } from "./services/leaveCalculator";
import { getAvailableLeave, getUsedDays } from "./services/balanceService";
import { cancelRequest, createRequest, decideRequest } from "./services/leaveRequestService";

// اختبارات انحدار (Regression) لثغرات اكتشفها Claude في مراجعة P3. بيانات وهمية فقط.
// تعمل مثل باقي *.db.test.ts: تُنفّذ عبر npm run test:db داخل Electron-as-Node.
const isElectronNode = process.versions.electron !== undefined;

async function createDatabase(): Promise<Database> {
  const { default: DatabaseConstructor } = await import("better-sqlite3");
  const database = new DatabaseConstructor(":memory:");
  database.pragma("foreign_keys = ON");
  const files = [
    "../../core/migrations/001_core.sql",
    "../employees/migrations/001_employees.sql",
    "./migrations/001_leaves.sql",
    "./migrations/002_seed.sql",
    "./migrations/003_request_year_days.sql",
    "../decisions/migrations/001_decisions.sql",
    "../documents/migrations/001_documents.sql",
  ];
  for (const file of files) database.exec(readFileSync(new URL(file, import.meta.url), "utf8"));
  return database as Database;
}

function seedEmployee(database: Database, status = "active", code = "EMP-REG-1"): number {
  const department = database.prepare("INSERT OR IGNORE INTO departments (name) VALUES ('قسم اختباري')").run();
  const departmentId = database.prepare("SELECT id FROM departments WHERE name = 'قسم اختباري'").get() as { id: number };
  void department;
  const result = database.prepare(
    "INSERT INTO employees (code, full_name, department_id, hire_date, status) VALUES (?, 'موظف اختبار', ?, '2024-01-01', ?)",
  ).run(code, departmentId.id, status);
  return Number(result.lastInsertRowid);
}

function typeId(database: Database, key: string): number {
  return (database.prepare("SELECT id FROM leave_types WHERE key = ?").get(key) as { id: number }).id;
}

describe.skipIf(!isElectronNode)("leave regression (Claude review of P3)", () => {
  it("A1: الطلبات المعلقة تحجز الرصيد: لا يُقبل طلب ثانٍ يتجاوز المتاح بعد الحجز", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annual = typeId(database, "annual");
      // 2026-03-01 (الأحد) إلى 2026-03-19 (الخميس) = 15 يوم عمل بعطلة الجمعة والسبت
      const first = createRequest(database, { employeeId, leaveTypeId: annual, startDate: "2026-03-01", endDate: "2026-03-19" });
      expect(first.days).toBe(15);
      expect(() => createRequest(database, {
        employeeId, leaveTypeId: annual, startDate: "2026-05-03", endDate: "2026-05-21",
      })).toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));
    } finally { database.close(); }
  });

  it("A2: الاعتماد يعيد فحص الرصيد، ولا يسمح بالسالب إلا بتجاوز مسجَّل", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annual = typeId(database, "annual");
      const request = createRequest(database, { employeeId, leaveTypeId: annual, startDate: "2026-03-01", endDate: "2026-03-12" }); // 10 أيام
      // خفّض الرصيد بعد إنشاء الطلب (تسوية سالبة) ليصبح المتاح أقل من المطلوب
      database.prepare("UPDATE leave_balances SET adjustment = -15 WHERE employee_id = ? AND leave_type_id = ? AND year = 2026")
        .run(employeeId, annual);
      expect(() => decideRequest(database, { requestId: request.id, decision: "approved" }))
        .toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));

      // طلب بتجاوز مسجَّل يُعتمد حتى لو الرصيد غير كافٍ
      const overridden = createRequest(database, {
        employeeId, leaveTypeId: annual, startDate: "2026-06-07", endDate: "2026-06-11", overrideReason: "موافقة استثنائية",
      });
      const approved = decideRequest(database, { requestId: overridden.id, decision: "approved" });
      expect(approved.status).toBe("approved");
      const overrideRows = database.prepare(
        "SELECT COUNT(*) AS c FROM audit_log WHERE entity = 'leave_request' AND entity_id = ? AND action = 'override'",
      ).get(overridden.id) as { c: number };
      expect(overrideRows.c).toBe(1);
    } finally { database.close(); }
  });

  it("C: إضافة عطلة رسمية بعد الاعتماد لا تغيّر الرصيد المستهلك بأثر رجعي", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annual = typeId(database, "annual");
      const request = createRequest(database, { employeeId, leaveTypeId: annual, startDate: "2026-03-01", endDate: "2026-03-05" });
      decideRequest(database, { requestId: request.id, decision: "approved" });
      const before = getUsedDays(database, employeeId, annual, 2026);
      database.prepare("INSERT INTO holidays (date, name) VALUES ('2026-03-03', 'عطلة اختبار')").run();
      database.prepare("UPDATE settings SET value = '5' WHERE key = 'weekend_days'").run(); // غيّر العطلة الأسبوعية أيضًا
      expect(getUsedDays(database, employeeId, annual, 2026)).toBe(before);
      expect(before).toBe(5);
    } finally { database.close(); }
  });

  it("C2: الطلب العابر لسنتين يُثبَّت توزيعه ويخصم من السنتين، والإلغاء يرجّعهما", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annual = typeId(database, "annual");
      // الأحد 2024-12-29 إلى الخميس 2025-01-02: 2024 = (الأحد-الإثنين-الثلاثاء-الأربعاء-الخميس 29..31 = 3 أيام) ...
      const request = createRequest(database, { employeeId, leaveTypeId: annual, startDate: "2024-12-29", endDate: "2025-01-02" });
      const rows = database.prepare("SELECT year, days FROM leave_request_year_days WHERE request_id = ? ORDER BY year")
        .all(request.id) as Array<{ year: number; days: number }>;
      expect(rows.length).toBe(2);
      expect(rows.reduce((sum, row) => sum + row.days, 0)).toBe(request.days);
      decideRequest(database, { requestId: request.id, decision: "approved" });
      expect(getAvailableLeave(database, employeeId, annual, 2024).used).toBe(rows[0].days);
      expect(getAvailableLeave(database, employeeId, annual, 2025).used).toBe(rows[1].days);
      cancelRequest(database, request.id);
      expect(getAvailableLeave(database, employeeId, annual, 2024).remaining).toBe(21);
      expect(getAvailableLeave(database, employeeId, annual, 2025).remaining).toBe(21);
    } finally { database.close(); }
  });

  it("I: لا تُقبل إجازة لموظف غير نشط", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database, "suspended", "EMP-REG-2");
      expect(() => createRequest(database, {
        employeeId, leaveTypeId: typeId(database, "annual"), startDate: "2026-03-01", endDate: "2026-03-02",
      })).toThrowError(expect.objectContaining({ code: "EMPLOYEE_INACTIVE" }));
    } finally { database.close(); }
  });

  it("E: الإلغاء يعيد الرصيد كاملًا", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annual = typeId(database, "annual");
      const request = createRequest(database, { employeeId, leaveTypeId: annual, startDate: "2026-03-01", endDate: "2026-03-05" });
      decideRequest(database, { requestId: request.id, decision: "approved" });
      expect(getAvailableLeave(database, employeeId, annual, 2026).remaining).toBe(16);
      cancelRequest(database, request.id);
      expect(getAvailableLeave(database, employeeId, annual, 2026).remaining).toBe(21);
    } finally { database.close(); }
  });
});

// لا يحتاج SQLite: يعمل ضمن npm test العادي.
describe("D: فئة الخطأ واحدة", () => {
  it("أخطاء الحاسبة هي نفس AppError الذي تعرفه قنوات IPC", () => {
    let caught: unknown;
    try { countLeaveDays("bad-date", "2026-01-01", [5, 6], [], false); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("INVALID_DATE");
  });
});
