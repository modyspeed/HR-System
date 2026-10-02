import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Database } from "better-sqlite3";
import {
  AppError,
  createDepartment,
  createEmployee,
  getEmployee,
  getEmployeeCount,
  listDepartments,
  listEmployees,
  setEmployeeStatus,
  updateEmployee,
} from "./service";

const isElectronNode = process.versions.electron !== undefined;

describe.skipIf(!isElectronNode)("employee service with real SQLite", () => {
  async function createDatabase(): Promise<Database> {
    const { default: DatabaseConstructor } = await import("better-sqlite3");
    const database = new DatabaseConstructor(":memory:");
    database.pragma("foreign_keys = ON");
    database.exec(readFileSync(new URL("../../core/migrations/001_core.sql", import.meta.url), "utf8"));
    database.exec(readFileSync(new URL("./migrations/001_employees.sql", import.meta.url), "utf8"));
    database.exec(readFileSync(new URL("../leaves/migrations/001_leaves.sql", import.meta.url), "utf8"));
    return database as Database;
  }

  it("creates departments/employees, filters, edits and changes status with audit rows", async () => {
    const database = await createDatabase();
    try {
      const department = createDepartment(database, "قسم اختباري");
      expect(listDepartments(database)).toContainEqual(department);

      const input = {
        code: "EMP-TEST-01",
        full_name: "موظف اختبار",
        department_id: department.id,
        hire_date: "2024-01-15",
        job_title: "مراجع",
        birth_date: "1990-05-20",
        national_id: "NID-TEST",
        phone: "01000000000",
        notes: "اختبار وهمي",
      };
      const created = createEmployee(database, input);
      expect(created.full_name).toBe(input.full_name);
      expect(getEmployee(database, created.id)).toMatchObject({ code: input.code, department_id: department.id });
      expect(getEmployeeCount(database)).toBe(1);
      expect(listEmployees(database, { search: "اختبار", departmentId: department.id })).toHaveLength(1);
      expect(listEmployees(database, { search: "غير موجود", departmentId: department.id })).toHaveLength(0);
      expect(listEmployees(database, { search: "", departmentId: null, status: "all" })).toHaveLength(1);

      const updated = updateEmployee(database, created.id, { ...input, full_name: "موظف معدل" });
      expect(updated.full_name).toBe("موظف معدل");
      const inactive = setEmployeeStatus(database, created.id, "suspended");
      expect(inactive.status).toBe("suspended");
      expect(listEmployees(database)).toHaveLength(0);

      const auditRows = database.prepare(
        "SELECT entity, action, old_value, new_value FROM audit_log WHERE entity = 'employee' ORDER BY id",
      ).all() as Array<{ entity: string; action: string; old_value: string | null; new_value: string }>;
      expect(auditRows.map((row) => row.action)).toEqual(["create", "update", "status_change"]);
      expect(auditRows.every((row) => row.entity === "employee" && typeof row.new_value === "string")).toBe(true);
      expect(JSON.stringify(auditRows)).not.toContain("NID-TEST");
      expect(JSON.stringify(auditRows)).not.toContain("موظف اختبار");
    } finally {
      database.close();
    }
  });

  it("rejects duplicate employee code and nonexistent department with coded Arabic errors", async () => {
    const database = await createDatabase();
    try {
      const department = createDepartment(database, "قسم التحقق");
      const employee = {
        code: "EMP-TEST-02",
        full_name: "اسم اختبار",
        department_id: department.id,
        hire_date: "2024-01-01",
      };
      createEmployee(database, employee);

      expect(() => createEmployee(database, employee)).toThrowError(
        expect.objectContaining({ code: "EMPLOYEE_CODE_EXISTS", message: "كود الموظف مستخدم بالفعل." }),
      );
      expect(() => createEmployee(database, { ...employee, code: "EMP-TEST-03", department_id: 999 }))
        .toThrowError(expect.objectContaining({ code: "DEPARTMENT_NOT_FOUND", message: "القسم المحدد غير موجود." }));
    } finally {
      database.close();
    }
  });
});