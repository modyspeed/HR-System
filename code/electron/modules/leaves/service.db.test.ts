import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Database } from "better-sqlite3";
import { AppError } from "./errors";
import { getAvailableLeave, getBalance } from "./services/balanceService";
import {
  cancelRequest,
  createRequest,
  decideRequest,
  getEmployeeLeaveSummary,
  listRequests,
} from "./services/leaveRequestService";

const isElectronNode = process.versions.electron !== undefined;

async function createDatabase(): Promise<Database> {
  const { default: DatabaseConstructor } = await import("better-sqlite3");
  const database = new DatabaseConstructor(":memory:");
  database.pragma("foreign_keys = ON");
  database.exec(readFileSync(new URL("../../core/migrations/001_core.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../employees/migrations/001_employees.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("./migrations/001_leaves.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("./migrations/002_seed.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("./migrations/003_request_year_days.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../decisions/migrations/001_decisions.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../documents/migrations/001_documents.sql", import.meta.url), "utf8"));
  return database as Database;
}

function seedEmployee(database: Database): number {
  const department = database.prepare("INSERT INTO departments (name) VALUES (?)").run("قسم اختباري");
  const result = database.prepare(`
    INSERT INTO employees (code, full_name, department_id, hire_date)
    VALUES ('EMP-TEST-10', 'موظف اختبار الإجازات', ?, '2024-01-01')
  `).run(department.lastInsertRowid);
  return Number(result.lastInsertRowid);
}

function leaveTypeId(database: Database, key: string): number {
  const row = database.prepare("SELECT id FROM leave_types WHERE key = ?").get(key) as { id: number };
  return row.id;
}

describe.skipIf(!isElectronNode)("leave services with real SQLite", () => {
  it("auto-creates a balance row from the leave type entitlement", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annualId = leaveTypeId(database, "annual");
      const balance = getBalance(database, employeeId, annualId, 2026);
      expect(balance.entitlement).toBe(21);
      expect(balance.carried_over).toBe(0);
      expect(balance.adjustment).toBe(0);
      const available = getAvailableLeave(database, employeeId, annualId, 2026);
      expect(available.remaining).toBe(21);
      expect(available.used).toBe(0);
    } finally {
      database.close();
    }
  });

  it("creates a pending request, approves it, then deducts and reverses on cancel", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annualId = leaveTypeId(database, "annual");

      const created = createRequest(database, {
        employeeId,
        leaveTypeId: annualId,
        startDate: "2026-01-04",
        endDate: "2026-01-08",
        reason: "إجازة اختبارية",
      });
      expect(created.status).toBe("pending");
      expect(created.days).toBe(5);
      expect(getAvailableLeave(database, employeeId, annualId, 2026).pending).toBe(5);

      const approved = decideRequest(database, { requestId: created.id, decision: "approved" });
      expect(approved.status).toBe("approved");
      expect(getAvailableLeave(database, employeeId, annualId, 2026).used).toBe(5);
      expect(getAvailableLeave(database, employeeId, annualId, 2026).remaining).toBe(16);

      const cancelled = cancelRequest(database, approved.id);
      expect(cancelled.status).toBe("cancelled");
      expect(getAvailableLeave(database, employeeId, annualId, 2026).used).toBe(0);
      expect(getAvailableLeave(database, employeeId, annualId, 2026).remaining).toBe(21);
    } finally {
      database.close();
    }
  });

  it("rejects overlapping and insufficient-balance requests with coded Arabic errors", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annualId = leaveTypeId(database, "annual");
      const casualId = leaveTypeId(database, "casual");

      createRequest(database, {
        employeeId,
        leaveTypeId: annualId,
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      });

      expect(() =>
        createRequest(database, {
          employeeId,
          leaveTypeId: annualId,
          startDate: "2026-02-03",
          endDate: "2026-02-07",
        }),
      ).toThrowError(expect.objectContaining({ code: "LEAVE_OVERLAP" }));

      expect(() =>
        createRequest(database, {
          employeeId,
          leaveTypeId: casualId,
          startDate: "2026-03-01",
          endDate: "2026-03-20",
        }),
      ).toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));

      const override = createRequest(database, {
        employeeId,
        leaveTypeId: casualId,
        startDate: "2026-03-01",
        endDate: "2026-03-20",
        overrideReason: "تجاوز بقرار الإدارة",
      });
      expect(override.status).toBe("pending");
    } finally {
      database.close();
    }
  });

  it("requires a leave form attachment before approving sick leave", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const sickId = leaveTypeId(database, "sick");
      const request = createRequest(database, {
        employeeId,
        leaveTypeId: sickId,
        startDate: "2026-04-01",
        endDate: "2026-04-03",
      });

      expect(() =>
        decideRequest(database, { requestId: request.id, decision: "approved" }),
      ).toThrowError(expect.objectContaining({ code: "ATTACHMENT_REQUIRED" }));

      database.prepare(`
        INSERT INTO employee_documents (employee_id, category, related_leave_id, file_name, relative_path)
        VALUES (?, 'leave_form', ?, 'leave_form.pdf', 'EMP-TEST-10/leaves/leave_form.pdf')
      `).run(employeeId, request.id);

      const approved = decideRequest(database, { requestId: request.id, decision: "approved" });
      expect(approved.status).toBe("approved");
    } finally {
      database.close();
    }
  });

  it("lists requests with filters and builds the employee leave summary", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annualId = leaveTypeId(database, "annual");
      const casualId = leaveTypeId(database, "casual");

      const first = createRequest(database, {
        employeeId,
        leaveTypeId: annualId,
        startDate: "2026-05-01",
        endDate: "2026-05-03",
      });
      decideRequest(database, { requestId: first.id, decision: "rejected", note: "غير مكتمل" });
      createRequest(database, {
        employeeId,
        leaveTypeId: casualId,
        startDate: "2026-06-01",
        endDate: "2026-06-02",
      });

      expect(listRequests(database, { search: "اختبار" })).toHaveLength(2);
      expect(listRequests(database, { status: "rejected" })).toHaveLength(1);
      expect(listRequests(database, { leaveTypeId: casualId })).toHaveLength(1);
      expect(listRequests(database, { year: 2025 })).toHaveLength(0);

      const summary = getEmployeeLeaveSummary(database, employeeId, 2026);
      expect(summary.employeeId).toBe(employeeId);
      expect(summary.year).toBe(2026);
      const annual = summary.balances.find((entry) => entry.leaveTypeKey === "annual");
      expect(annual?.entitlement).toBe(21);
      const sick = summary.balances.find((entry) => entry.leaveTypeKey === "sick");
      expect(sick?.entitlement).toBe(0);
    } finally {
      database.close();
    }
  });

  it("writes leave request audit rows without personal data", async () => {
    const database = await createDatabase();
    try {
      const employeeId = seedEmployee(database);
      const annualId = leaveTypeId(database, "annual");
      const request = createRequest(database, {
        employeeId,
        leaveTypeId: annualId,
        startDate: "2026-07-01",
        endDate: "2026-07-02",
        reason: "إجازة",
      });
      decideRequest(database, { requestId: request.id, decision: "approved" });

      const auditRows = database.prepare(
        "SELECT entity, action, new_value FROM audit_log WHERE entity = 'leave_request' ORDER BY id",
      ).all() as Array<{ entity: string; action: string; new_value: string }>;
      expect(auditRows.map((row) => row.action)).toEqual(["create", "approved"]);
      expect(JSON.stringify(auditRows)).not.toContain("EMP-TEST-10");
      expect(JSON.stringify(auditRows)).not.toContain("موظف اختبار الإجازات");
    } finally {
      database.close();
    }
  });
});
