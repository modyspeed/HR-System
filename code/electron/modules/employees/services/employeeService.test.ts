import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { EmployeeService } from "./employeeService";

const runsOnElectronNode = process.versions.electron !== undefined;

describe.skipIf(!runsOnElectronNode)("EmployeeService with real SQLite", () => {
  it("creates, filters, updates, and softly deactivates employees with audit rows", async () => {
    const { default: Database } = await import("better-sqlite3");
    const database = new Database(":memory:");
    try {
      database.pragma("foreign_keys = ON");
      database.exec(readFileSync(new URL("../../../core/migrations/001_core.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/001_employees.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../../leaves/migrations/001_leaves.sql", import.meta.url), "utf8"));
      const service = new EmployeeService(database);
      const department = service.createDepartment("قسم تجريبي");

      const employee = service.create({
        code: "TEST-001",
        fullName: "موظف تجريبي",
        departmentId: department.id,
        hireDate: "2024-01-15",
        jobTitle: "",
      });

      expect(employee.code).toBe("TEST-001");
      expect(employee.jobTitle).toBeNull();
      expect(service.count()).toBe(1);
      expect(service.list({ search: "تجريبي", departmentId: department.id })).toHaveLength(1);
      expect(service.list({ search: "مفقود", departmentId: department.id })).toHaveLength(0);

      const updated = service.update(employee.id, {
        code: "TEST-001",
        fullName: "موظف تجريبي معدل",
        departmentId: department.id,
        hireDate: "2024-01-15",
        jobTitle: "مراجع",
      });
      expect(updated.fullName).toBe("موظف تجريبي معدل");

      const suspended = service.setStatus({ id: employee.id, status: "suspended" });
      expect(suspended.status).toBe("suspended");
      expect(service.list({ search: "", departmentId: null })).toHaveLength(0);
      expect(database.prepare("SELECT action FROM audit_log WHERE entity = 'employees' ORDER BY id").pluck().all())
        .toEqual(["create", "update", "status_change"]);

      const auditPayloads = database.prepare("SELECT old_value, new_value FROM audit_log WHERE entity = 'employees'").all() as Array<{
        old_value: string | null;
        new_value: string;
      }>;
      expect(JSON.stringify(auditPayloads)).not.toContain("موظف تجريبي");
    } finally {
      database.close();
    }
  });

  it("rejects duplicate codes, missing departments, and invalid hire dates with Arabic messages", async () => {
    const { default: Database } = await import("better-sqlite3");
    const database = new Database(":memory:");
    try {
      database.pragma("foreign_keys = ON");
      database.exec(readFileSync(new URL("../../../core/migrations/001_core.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/001_employees.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../../leaves/migrations/001_leaves.sql", import.meta.url), "utf8"));
      const service = new EmployeeService(database);
      const department = service.createDepartment("قسم التحقق");
      const input = {
        code: "TEST-002",
        fullName: "اسم تجريبي",
        departmentId: department.id,
        hireDate: "2023-06-01",
        jobTitle: "",
      };
      service.create(input);

      expect(() => service.create(input)).toThrow("كود الموظف مستخدم بالفعل.");
      expect(() => service.create({ ...input, code: "TEST-003", departmentId: 999 }))
        .toThrow("القسم المحدد غير موجود.");
      expect(() => service.create({ ...input, code: "TEST-004", hireDate: "2023-02-29" }))
        .toThrow("تاريخ التعيين غير صحيح.");
      expect(service.count()).toBe(1);
    } finally {
      database.close();
    }
  });

  it("persists employee data and audit records after closing and reopening SQLite", async () => {
    const { default: Database } = await import("better-sqlite3");
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "leavedesk-p2-"));
    const databasePath = join(temporaryDirectory, "service-test.db");
    let database = new Database(databasePath);
    try {
      database.pragma("foreign_keys = ON");
      database.exec(readFileSync(new URL("../../../core/migrations/001_core.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/001_employees.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../../leaves/migrations/001_leaves.sql", import.meta.url), "utf8"));
      const service = new EmployeeService(database);
      const department = service.createDepartment("قسم استمرارية تجريبي");
      const employee = service.create({
        code: "TEST-PERSIST",
        fullName: "موظف استمرارية تجريبي",
        departmentId: department.id,
        hireDate: "2022-08-19",
        jobTitle: "",
      });

      database.close();
      database = new Database(databasePath);
      const reopenedService = new EmployeeService(database);
      expect(reopenedService.getById(employee.id).fullName).toBe("موظف استمرارية تجريبي");
      expect(reopenedService.count()).toBe(1);
      expect(database.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE entity = 'employees'").get()).toEqual({
        count: 1,
      });
    } finally {
      database.close();
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});