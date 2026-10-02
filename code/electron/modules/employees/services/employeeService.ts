import type { Database } from "better-sqlite3";
import type {
  DepartmentRecord,
  EmployeeInput,
  EmployeeListFilter,
  EmployeeRecord,
  EmployeeStatus,
} from "../../../../src/core/api/contracts";
import {
  departmentNameSchema,
  employeeIdSchema,
  employeeInputSchema,
  employeeListFilterSchema,
  EmployeeServiceError,
  parseInput,
  setEmployeeStatusSchema,
} from "../schemas";

interface EmployeeDatabaseRow {
  id: number;
  code: string;
  fullName: string;
  departmentId: number;
  departmentName: string;
  hireDate: string;
  jobTitle: string | null;
  status: EmployeeStatus;
  annualEntitlement: number | null;
  casualEntitlement: number | null;
}

interface DepartmentDatabaseRow {
  id: number;
  name: string;
}

interface EmployeeIdRow {
  id: number;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export class EmployeeService {
  constructor(private readonly database: Database) {}

  list(filterInput: unknown = {}): EmployeeRecord[] {
    const parsedFilter = parseInput(employeeListFilterSchema, filterInput);
    const filter: EmployeeListFilter = {
      search: parsedFilter.search ?? "",
      departmentId: parsedFilter.departmentId ?? null,
    };
    const rows = this.database.prepare(`
      SELECT
        e.id,
        e.code,
        e.full_name AS fullName,
        e.department_id AS departmentId,
        d.name AS departmentName,
        e.hire_date AS hireDate,
        e.job_title AS jobTitle,
        e.status,
        (SELECT yearly_entitlement FROM leave_types WHERE key = 'annual') AS annualEntitlement,
        (SELECT yearly_entitlement FROM leave_types WHERE key = 'casual') AS casualEntitlement
      FROM employees AS e
      JOIN departments AS d ON d.id = e.department_id
      WHERE e.status = 'active'
        AND (@search = '' OR e.code LIKE @pattern OR e.full_name LIKE @pattern)
        AND (@departmentId IS NULL OR e.department_id = @departmentId)
      ORDER BY e.full_name COLLATE NOCASE, e.id
    `).all({
      search: filter.search,
      pattern: `%${filter.search}%`,
      departmentId: filter.departmentId,
    }) as EmployeeDatabaseRow[];
    return rows;
  }

  count(): number {
    const result = this.database.prepare(
      "SELECT COUNT(*) AS count FROM employees",
    ).get() as { count: number };
    return result.count;
  }

  getById(idInput: unknown): EmployeeRecord {
    const id = parseInput(employeeIdSchema, idInput);
    const employee = this.database.prepare(`
      SELECT
        e.id,
        e.code,
        e.full_name AS fullName,
        e.department_id AS departmentId,
        d.name AS departmentName,
        e.hire_date AS hireDate,
        e.job_title AS jobTitle,
        e.status,
        (SELECT yearly_entitlement FROM leave_types WHERE key = 'annual') AS annualEntitlement,
        (SELECT yearly_entitlement FROM leave_types WHERE key = 'casual') AS casualEntitlement
      FROM employees AS e
      JOIN departments AS d ON d.id = e.department_id
      WHERE e.id = ?
    `).get(id) as EmployeeDatabaseRow | undefined;

    if (!employee) throw new EmployeeServiceError("الموظف غير موجود.");
    return employee;
  }

  create(input: unknown): EmployeeRecord {
    const employee: EmployeeInput = parseInput(employeeInputSchema, input);
    this.assertDepartmentExists(employee.departmentId);

    try {
      const employeeId = this.database.transaction(() => {
        const result = this.database.prepare(`
          INSERT INTO employees (code, full_name, department_id, job_title, hire_date)
          VALUES (@code, @fullName, @departmentId, @jobTitle, @hireDate)
        `).run({
          ...employee,
          jobTitle: employee.jobTitle?.trim() || null,
        });
        const id = Number(result.lastInsertRowid);
        this.writeAudit(id, "create", null, { fields: Object.keys(employee) });
        return id;
      })();
      return this.getById(employeeId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmployeeServiceError("كود الموظف مستخدم بالفعل.");
      }
      throw error;
    }
  }

  update(idInput: unknown, input: unknown): EmployeeRecord {
    const id = parseInput(employeeIdSchema, idInput);
    const employee: EmployeeInput = parseInput(employeeInputSchema, input);
    this.assertDepartmentExists(employee.departmentId);
    this.getById(id);

    try {
      this.database.transaction(() => {
        this.database.prepare(`
          UPDATE employees
          SET code = @code,
              full_name = @fullName,
              department_id = @departmentId,
              job_title = @jobTitle,
              hire_date = @hireDate,
              updated_at = datetime('now')
          WHERE id = @id
        `).run({
          ...employee,
          id,
          jobTitle: employee.jobTitle?.trim() || null,
        });
        this.writeAudit(id, "update", { fields: Object.keys(employee) }, { fields: Object.keys(employee) });
      })();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmployeeServiceError("كود الموظف مستخدم بالفعل.");
      }
      throw error;
    }
    return this.getById(id);
  }

  setStatus(input: unknown): EmployeeRecord {
    const { id, status } = parseInput(setEmployeeStatusSchema, input);
    const current = this.getById(id);
    if (current.status === status) return current;

    this.database.transaction(() => {
      this.database.prepare(`
        UPDATE employees SET status = ?, updated_at = datetime('now') WHERE id = ?
      `).run(status, id);
      this.writeAudit(id, "status_change", { status: current.status }, { status });
    })();

    return this.getById(id);
  }

  listDepartments(): DepartmentRecord[] {
    return this.database.prepare(
      "SELECT id, name FROM departments ORDER BY name COLLATE NOCASE, id",
    ).all() as DepartmentRecord[];
  }

  createDepartment(nameInput: unknown): DepartmentRecord {
    const name = parseInput(departmentNameSchema, nameInput);
    try {
      const result = this.database.prepare(
        "INSERT INTO departments (name) VALUES (?)",
      ).run(name);
      return { id: Number(result.lastInsertRowid), name };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmployeeServiceError("اسم القسم موجود بالفعل.");
      }
      throw error;
    }
  }

  private assertDepartmentExists(departmentId: number): void {
    const department = this.database.prepare(
      "SELECT id FROM departments WHERE id = ?",
    ).get(departmentId) as DepartmentDatabaseRow | undefined;
    if (!department) throw new EmployeeServiceError("القسم المحدد غير موجود.");
  }

  private writeAudit(
    employeeId: number,
    action: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown>,
  ): void {
    this.database.prepare(`
      INSERT INTO audit_log (entity, entity_id, action, old_value, new_value)
      VALUES ('employees', ?, ?, ?, ?)
    `).run(
      employeeId,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      JSON.stringify(newValue),
    );
  }
}