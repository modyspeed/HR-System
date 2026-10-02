import type { Database } from "better-sqlite3";
import { AppError } from "../errors";
import { splitDaysByYear, type HolidayContext, type YearDays } from "./leaveCalculator";

export type { YearDays };

export interface LeaveTypeRow {
  id: number;
  key: string;
  name_ar: string;
  yearly_entitlement: number | null;
  deducts_balance: number;
  counts_weekends: number;
  requires_attachment: number;
  active: number;
}

interface LeaveBalanceRow {
  id: number;
  employee_id: number;
  leave_type_id: number;
  year: number;
  entitlement: number;
  carried_over: number;
  adjustment: number;
}

export interface AvailableLeave {
  entitlement: number;
  carriedOver: number;
  adjustment: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface DistributionEntry {
  year: number;
  days: number;
}

const FALLBACK_WEEKEND_DAYS = [5, 6];

export function readWeekendDays(database: Database): number[] {
  const row = database.prepare("SELECT value FROM settings WHERE key = 'weekend_days'").get() as { value: string } | undefined;
  if (!row) return FALLBACK_WEEKEND_DAYS;
  const parsed = row.value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return parsed.length > 0 ? parsed : FALLBACK_WEEKEND_DAYS;
}

export function readHolidays(database: Database): string[] {
  const rows = database.prepare("SELECT date FROM holidays").all() as Array<{ date: string }>;
  return rows.map((row) => row.date);
}

export function getLeaveTypeById(database: Database, leaveTypeId: number): LeaveTypeRow {
  const leaveType = database
    .prepare("SELECT id, key, name_ar, yearly_entitlement, deducts_balance, counts_weekends, requires_attachment, active FROM leave_types WHERE id = ?")
    .get(leaveTypeId) as LeaveTypeRow | undefined;
  if (!leaveType) throw new AppError("LEAVE_TYPE_NOT_FOUND", "نوع الإجازة غير موجود.");
  return leaveType;
}

export function getBalance(
  database: Database,
  employeeId: number,
  leaveTypeId: number,
  year: number,
): LeaveBalanceRow {
  const existing = database
    .prepare("SELECT id, employee_id, leave_type_id, year, entitlement, carried_over, adjustment FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?")
    .get(employeeId, leaveTypeId, year) as LeaveBalanceRow | undefined;
  if (existing) return existing;

  const leaveType = getLeaveTypeById(database, leaveTypeId);
  const entitlement = leaveType.yearly_entitlement ?? 0;

  database.transaction(() => {
    database.prepare(`
      INSERT INTO leave_balances (employee_id, leave_type_id, year, entitlement, carried_over, adjustment)
      VALUES (?, ?, ?, ?, 0, 0)
    `).run(employeeId, leaveTypeId, year, entitlement);
  })();

  const created = database
    .prepare("SELECT id, employee_id, leave_type_id, year, entitlement, carried_over, adjustment FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?")
    .get(employeeId, leaveTypeId, year) as LeaveBalanceRow;
  return created;
}

function sumRequestDaysByStatus(
  database: Database,
  employeeId: number,
  leaveTypeId: number,
  year: number,
  status: "approved" | "pending",
): number {
  const requests = database
    .prepare(`
      SELECT lr.start_date AS start_date, lr.end_date AS end_date, lt.counts_weekends AS counts_weekends
      FROM leave_requests AS lr
      JOIN leave_types AS lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ? AND lr.leave_type_id = ? AND lr.status = ?
    `)
    .all(employeeId, leaveTypeId, status) as Array<{ start_date: string; end_date: string; counts_weekends: number }>;

  const weekendDays = readWeekendDays(database);
  const holidays = readHolidays(database);

  let total = 0;
  for (const request of requests) {
    const context: HolidayContext = {
      weekendDays,
      holidays,
      countsWeekends: request.counts_weekends === 1,
    };
    const distribution = splitDaysByYear(request.start_date, request.end_date, context);
    total += distribution
      .filter((entry) => entry.year === year)
      .reduce((sum, entry) => sum + entry.days, 0);
  }
  return total;
}

export function getUsedDays(
  database: Database,
  employeeId: number,
  leaveTypeId: number,
  year: number,
): number {
  return sumRequestDaysByStatus(database, employeeId, leaveTypeId, year, "approved");
}

export function getPendingDays(
  database: Database,
  employeeId: number,
  leaveTypeId: number,
  year: number,
): number {
  return sumRequestDaysByStatus(database, employeeId, leaveTypeId, year, "pending");
}

export function getAvailableLeave(
  database: Database,
  employeeId: number,
  leaveTypeId: number,
  year: number,
): AvailableLeave {
  const balance = getBalance(database, employeeId, leaveTypeId, year);
  const used = getUsedDays(database, employeeId, leaveTypeId, year);
  const pending = getPendingDays(database, employeeId, leaveTypeId, year);
  const remaining = balance.entitlement + balance.carried_over + balance.adjustment - used;
  return {
    entitlement: balance.entitlement,
    carriedOver: balance.carried_over,
    adjustment: balance.adjustment,
    used,
    pending,
    remaining,
  };
}

function writeBalanceAudit(
  database: Database,
  balanceId: number,
  action: "apply" | "reverse",
  requestId: number,
  leaveTypeId: number,
  year: number,
  days: number,
): void {
  database.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, old_value, new_value)
    VALUES ('leave_balance', ?, ?, NULL, ?)
  `).run(
    balanceId,
    action,
    JSON.stringify({ request_id: requestId, leave_type_id: leaveTypeId, year, days }),
  );
}

export function applyLeave(
  database: Database,
  requestId: number,
  employeeId: number,
  leaveTypeId: number,
  year: number,
  days: number,
  distribution?: DistributionEntry[],
): void {
  const entries = distribution && distribution.length > 0 ? distribution : [{ year, days }];
  database.transaction(() => {
    for (const entry of entries) {
      if (entry.days <= 0) continue;
      const balance = getBalance(database, employeeId, leaveTypeId, entry.year);
      writeBalanceAudit(database, balance.id, "apply", requestId, leaveTypeId, entry.year, entry.days);
    }
  })();
}

export function reverseLeave(
  database: Database,
  requestId: number,
  employeeId: number,
  leaveTypeId: number,
  year: number,
  days: number,
  distribution?: DistributionEntry[],
): void {
  const entries = distribution && distribution.length > 0 ? distribution : [{ year, days }];
  database.transaction(() => {
    for (const entry of entries) {
      if (entry.days <= 0) continue;
      const balance = getBalance(database, employeeId, leaveTypeId, entry.year);
      writeBalanceAudit(database, balance.id, "reverse", requestId, leaveTypeId, entry.year, entry.days);
    }
  })();
}

export function asBoolean(flag: number): boolean {
  return flag === 1;
}

export function currentYear(): number {
  return new Date().getFullYear();
}
