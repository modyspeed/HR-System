import type { Database } from "better-sqlite3";
import type {
  DepartmentRecord,
  EmployeeStatus,
  EmployeeWireInput,
  EmployeeWireRecord,
} from "../../../src/core/api/contracts";
import {
  departmentNameSchema,
  employeeIdSchema,
  employeeInputSchema,
  employeeListFilterSchema,
  employeeStatusSchema,
} from "./schemas";

export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}

interface EmployeeDbRow extends EmployeeWireRecord {
  department_name: string;
}

interface DepartmentDbRow {
  id: number;
  name: string;
}

interface SqliteError extends Error {
  code?: string;
}

function parseInput<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new AppError("VALIDATION_ERROR", result.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة.");
}

function mapDatabaseError(error: unknown): never {
  const sqliteError = error as SqliteError;
  const detail = `${sqliteError.code ?? ""} ${sqliteError.message ?? ""}`;
  if (detail.includes("employees.code") || /UNIQUE constraint failed: employees\.code/i.test(detail)) {
    throw new AppError("EMPLOYEE_CODE_EXISTS", "كود الموظف مستخدم بالفعل.");
  }
  if (detail.includes("departments.name") || /UNIQUE constraint failed: departments\.name/i.test(detail)) {
    throw new AppError("DEPARTMENT_EXISTS", "اسم القسم موجود بالفعل.");
  }
  throw error;
}

function assertDepartmentExists(database: Database, departmentId: number): void {
  const department = database.prepare("SELECT 1 FROM departments WHERE id = ?").get(departmentId);
  if (!department) throw new AppError("DEPARTMENT_NOT_FOUND", "القسم المحدد غير موجود.");
}

function assertCodeAvailable(database: Database, code: string, excludeEmployeeId?: number): void {
  // التكرار غير حساس لحالة الأحرف: EMP-01 وemp-01 نفس الكود (قرار D28).
  const row = database
    .prepare("SELECT 1 FROM employees WHERE lower(code) = lower(?) AND (? IS NULL OR id != ?)")
    .get(code, excludeEmployeeId ?? null, excludeEmployeeId ?? null);
  if (row) {
    throw new AppError("EMPLOYEE_CODE_EXISTS", "كود الموظف مستخدم بالفعل.");
  }
}

function writeAudit(
  database: Database,
  entityId: number,
  action: "create" | "update" | "status_change",
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown>,
): void {
  database.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, old_value, new_value)
    VALUES ('employee', ?, ?, ?, ?)
  `).run(
    entityId,
    action,
    oldValue === null ? null : JSON.stringify(oldValue),
    JSON.stringify(newValue),
  );
}

interface AuditSnapshotSource {
  department_id?: number | null;
  hire_date?: string | null;
  status?: EmployeeStatus;
  job_title?: string | null;
  birth_date?: string | null;
  national_id?: string | null;
  phone?: string | null;
  notes?: string | null;
}

function auditSnapshot(employee: AuditSnapshotSource): Record<string, unknown> {
  return {
    department_id: employee.department_id ?? null,
    hire_date: employee.hire_date ?? null,
    status: employee.status ?? "active",
    optional_fields_present: {
      job_title: Boolean(employee.job_title),
      birth_date: Boolean(employee.birth_date),
      national_id: Boolean(employee.national_id),
      phone: Boolean(employee.phone),
      notes: Boolean(employee.notes),
    },
  };
}

export function listDepartments(database: Database): DepartmentRecord[] {
  return database.prepare(
    "SELECT id, name FROM departments ORDER BY name COLLATE NOCASE, id",
  ).all() as DepartmentRecord[];
}

export function createDepartment(database: Database, nameInput: unknown): DepartmentRecord {
  const name = parseInput(departmentNameSchema, nameInput);
  try {
    const department = database.transaction(() => {
      const result = database.prepare("INSERT INTO departments (name) VALUES (?)").run(name);
      const id = Number(result.lastInsertRowid);
      database.prepare(`
        INSERT INTO audit_log (entity, entity_id, action, old_value, new_value)
        VALUES ('department', ?, 'create', NULL, ?)
      `).run(id, JSON.stringify({ changedFields: ["name"] }));
      return { id, name };
    })();
    return department;
  } catch (error) {
    mapDatabaseError(error);
  }
}

export function listEmployees(database: Database, filterInput: unknown = {}): EmployeeWireRecord[] {
  const filter = parseInput(employeeListFilterSchema, filterInput);
  const status: EmployeeStatus | "all" = filter.status ?? "active";
  const rows = database.prepare(`
    SELECT
      e.id,
      e.code,
      e.full_name,
      e.department_id,
      d.name AS department_name,
      e.hire_date,
      e.job_title,
      e.birth_date,
      e.national_id,
      e.phone,
      e.notes,
      e.status,
      (SELECT yearly_entitlement FROM leave_types WHERE key = 'annual') AS annual_entitlement,
      (SELECT yearly_entitlement FROM leave_types WHERE key = 'casual') AS casual_entitlement,
      e.created_at,
      e.updated_at
    FROM employees AS e
    LEFT JOIN departments AS d ON d.id = e.department_id
    WHERE (@status = 'all' OR e.status = @status)
      AND (@search = '' OR e.code LIKE @pattern OR e.full_name LIKE @pattern)
      AND (@departmentId IS NULL OR e.department_id = @departmentId)
    ORDER BY e.full_name COLLATE NOCASE, e.id
  `).all({
    status,
    search: filter.search ?? "",
    pattern: `%${filter.search ?? ""}%`,
    departmentId: filter.departmentId ?? null,
  }) as EmployeeDbRow[];
  return rows;
}

export function getEmployee(database: Database, idInput: unknown): EmployeeWireRecord {
  const id = parseInput(employeeIdSchema, idInput);
  const row = database.prepare(`
    SELECT
      e.id,
      e.code,
      e.full_name,
      e.department_id,
      d.name AS department_name,
      e.hire_date,
      e.job_title,
      e.birth_date,
      e.national_id,
      e.phone,
      e.notes,
      e.status,
      (SELECT yearly_entitlement FROM leave_types WHERE key = 'annual') AS annual_entitlement,
      (SELECT yearly_entitlement FROM leave_types WHERE key = 'casual') AS casual_entitlement,
      e.created_at,
      e.updated_at
    FROM employees AS e
    LEFT JOIN departments AS d ON d.id = e.department_id
    WHERE e.id = ?
  `).get(id) as EmployeeDbRow | undefined;
  if (!row) throw new AppError("EMPLOYEE_NOT_FOUND", "الموظف غير موجود.");
  return row;
}

export function createEmployee(database: Database, input: unknown): EmployeeWireRecord {
  const employee: EmployeeWireInput = parseInput(employeeInputSchema, input);
  assertDepartmentExists(database, employee.department_id);
  assertCodeAvailable(database, employee.code);
  try {
    const id = database.transaction(() => {
      const result = database.prepare(`
        INSERT INTO employees (
          code, full_name, department_id, hire_date, job_title, birth_date, national_id, phone, notes
        ) VALUES (
          @code, @full_name, @department_id, @hire_date, @job_title, @birth_date, @national_id, @phone, @notes
        )
      `).run({
        ...employee,
        job_title: employee.job_title || null,
        birth_date: employee.birth_date || null,
        national_id: employee.national_id || null,
        phone: employee.phone || null,
        notes: employee.notes || null,
      });
      const employeeId = Number(result.lastInsertRowid);
      writeAudit(database, employeeId, "create", {}, auditSnapshot({ ...employee, status: "active" }));
      return employeeId;
    })();
    return getEmployee(database, id);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export function updateEmployee(database: Database, idInput: unknown, input: unknown): EmployeeWireRecord {
  const id = parseInput(employeeIdSchema, idInput);
  const employee: EmployeeWireInput = parseInput(employeeInputSchema, input);
  assertDepartmentExists(database, employee.department_id);
  assertCodeAvailable(database, employee.code, id);
  const oldEmployee = getEmployee(database, id);

  try {
    database.transaction(() => {
      database.prepare(`
        UPDATE employees
        SET code = @code,
            full_name = @full_name,
            department_id = @department_id,
            hire_date = @hire_date,
            job_title = @job_title,
            birth_date = @birth_date,
            national_id = @national_id,
            phone = @phone,
            notes = @notes,
            updated_at = datetime('now')
        WHERE id = @id
      `).run({
        ...employee,
        id,
        job_title: employee.job_title || null,
        birth_date: employee.birth_date || null,
        national_id: employee.national_id || null,
        phone: employee.phone || null,
        notes: employee.notes || null,
      });
      const changedFields = Object.keys(employee).filter((key) => {
        const oldValue = oldEmployee[key as keyof EmployeeWireRecord];
        const newValue = employee[key as keyof EmployeeWireInput];
        return oldValue !== newValue;
      });
      writeAudit(
        database,
        id,
        "update",
        { ...auditSnapshot(oldEmployee), changed_fields: changedFields },
        { ...auditSnapshot({ ...employee, status: oldEmployee.status }), changed_fields: changedFields },
      );
    })();
  } catch (error) {
    mapDatabaseError(error);
  }
  return getEmployee(database, id);
}

export function setEmployeeStatus(
  database: Database,
  idInput: unknown,
  statusInput: unknown,
): EmployeeWireRecord {
  const id = parseInput(employeeIdSchema, idInput);
  const status = parseInput(employeeStatusSchema, statusInput);
  const oldEmployee = getEmployee(database, id);
  if (oldEmployee.status === status) return oldEmployee;

  database.transaction(() => {
    database.prepare("UPDATE employees SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
    writeAudit(database, id, "status_change", { status: oldEmployee.status }, { status });
  })();
  return getEmployee(database, id);
}

export function getEmployeeCount(database: Database): number {
  const result = database.prepare("SELECT COUNT(*) AS count FROM employees").get() as { count: number };
  return result.count;
}