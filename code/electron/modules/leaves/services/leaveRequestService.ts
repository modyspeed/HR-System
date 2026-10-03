import type { Database } from "better-sqlite3";
import type {
  EmployeeLeaveSummary,
  LeaveBalanceSummary,
  LeaveDecisionInput,
  LeaveRequestFilter,
  LeaveRequestInput,
  LeaveRequestRecord,
  LeaveRequestStatus,
} from "../../../../src/core/api/contracts";
import { AppError } from "../errors";
import {
  applyLeave,
  asBoolean,
  currentYear,
  getAvailableLeave,
  getLeaveTypeById,
  listLowBalanceAlerts,
  readHolidays,
  readLowBalanceThreshold,
  readWeekendDays,
  reverseLeave,
  type DistributionEntry,
  type LowBalanceAlert,
} from "./balanceService";
import { countLeaveDays, splitDaysByYear, type HolidayContext } from "./leaveCalculator";
import {
  employeeLeaveSummarySchema,
  leaveDecisionInputSchema,
  leaveRequestFilterSchema,
  leaveRequestInputSchema,
  leaveRequestIdSchema,
} from "../schemas";

function parseInput<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new AppError("VALIDATION_ERROR", result.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة.");
}

interface LeaveRequestDbRow {
  id: number;
  employee_id: number;
  employee_code: string;
  employee_full_name: string;
  leave_type_id: number;
  leave_type_key: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  decided_at: string | null;
  decided_note: string | null;
  created_at: string;
}

function mapRequestRow(row: LeaveRequestDbRow): LeaveRequestRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeFullName: row.employee_full_name,
    leaveTypeId: row.leave_type_id,
    leaveTypeKey: row.leave_type_key,
    leaveTypeName: row.leave_type_name,
    startDate: row.start_date,
    endDate: row.end_date,
    days: row.days,
    reason: row.reason,
    status: row.status,
    decidedAt: row.decided_at,
    decidedNote: row.decided_note,
    createdAt: row.created_at,
  };
}

const REQUEST_SELECT_COLUMNS = `
  lr.id, lr.employee_id, e.code AS employee_code, e.full_name AS employee_full_name,
  lr.leave_type_id, lt.key AS leave_type_key, lt.name_ar AS leave_type_name,
  lr.start_date, lr.end_date, lr.days, lr.reason, lr.status, lr.decided_at, lr.decided_note, lr.created_at
`;

function fetchRequestById(database: Database, requestId: number): LeaveRequestDbRow {
  const row = database.prepare(`
    SELECT ${REQUEST_SELECT_COLUMNS}
    FROM leave_requests AS lr
    JOIN employees AS e ON e.id = lr.employee_id
    JOIN leave_types AS lt ON lt.id = lr.leave_type_id
    WHERE lr.id = ?
  `).get(requestId) as LeaveRequestDbRow | undefined;
  if (!row) throw new AppError("LEAVE_REQUEST_NOT_FOUND", "طلب الإجازة غير موجود.");
  return row;
}

function assertEmployeeExists(database: Database, employeeId: number): void {
  const employee = database.prepare("SELECT 1 FROM employees WHERE id = ?").get(employeeId);
  if (!employee) throw new AppError("EMPLOYEE_NOT_FOUND", "الموظف غير موجود.");
}

function assertEmployeeActive(database: Database, employeeId: number): void {
  const employee = database.prepare("SELECT status FROM employees WHERE id = ?").get(employeeId) as { status: string } | undefined;
  if (!employee) throw new AppError("EMPLOYEE_NOT_FOUND", "الموظف غير موجود.");
  if (employee.status !== "active") {
    throw new AppError("EMPLOYEE_INACTIVE", "لا يمكن تسجيل إجازة لموظف غير نشط.");
  }
}

function computeDistribution(
  database: Database,
  startDate: string,
  endDate: string,
  countsWeekends: boolean,
): { days: number; distribution: DistributionEntry[] } {
  const context: HolidayContext = {
    weekendDays: readWeekendDays(database),
    holidays: readHolidays(database),
    countsWeekends,
  };
  const days = countLeaveDays(startDate, endDate, context.weekendDays, context.holidays, countsWeekends);
  const distribution = splitDaysByYear(startDate, endDate, context);
  return { days, distribution };
}

function assertNoOverlap(database: Database, employeeId: number, startDate: string, endDate: string): void {
  const overlap = database.prepare(`
    SELECT 1 FROM leave_requests
    WHERE employee_id = ? AND status IN ('pending', 'approved')
      AND start_date <= ? AND end_date >= ?
  `).get(employeeId, endDate, startDate);
  if (overlap) throw new AppError("LEAVE_OVERLAP", "يوجد طلب إجازة آخر لنفس الموظف في هذه الفترة.");
}

function assertBalanceCoversRequest(
  database: Database,
  employeeId: number,
  leaveTypeId: number,
  distribution: DistributionEntry[],
  deductsBalance: boolean,
): void {
  if (!deductsBalance) return;
  for (const entry of distribution) {
    const available = getAvailableLeave(database, employeeId, leaveTypeId, entry.year);
    // الطلبات المعلقة محجوزة: تُخصم من المتاح عند فحص أي طلب جديد.
    const free = available.remaining - available.pending;
    if (entry.days > free) {
      throw new AppError(
        "INSUFFICIENT_BALANCE",
        `رصيد الإجازات غير كافٍ لسنة ${entry.year}: المطلوب ${entry.days} يوم والمتاح ${free} يوم (بعد حجز الطلبات المعلقة).`,
      );
    }
  }
}

function writeRequestAudit(
  database: Database,
  requestId: number,
  action: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown>,
): void {
  database.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, old_value, new_value)
    VALUES ('leave_request', ?, ?, ?, ?)
  `).run(requestId, action, oldValue === null ? null : JSON.stringify(oldValue), JSON.stringify(newValue));
}

export function createRequest(database: Database, input: unknown): LeaveRequestRecord {
  const request = parseInput(leaveRequestInputSchema, input);
  assertEmployeeActive(database, request.employeeId);
  const leaveType = getLeaveTypeById(database, request.leaveTypeId);
  if (!asBoolean(leaveType.active)) throw new AppError("LEAVE_TYPE_INACTIVE", "نوع الإجازة غير مفعل.");
  assertNoOverlap(database, request.employeeId, request.startDate, request.endDate);

  const { days, distribution } = computeDistribution(
    database,
    request.startDate,
    request.endDate,
    asBoolean(leaveType.counts_weekends),
  );
  if (days <= 0) throw new AppError("NO_LEAVE_DAYS", "فترة الإجازة لا تحتوي على أيام عمل.");
  const hasOverride = Boolean(request.overrideReason);
  if (!hasOverride) {
    assertBalanceCoversRequest(database, request.employeeId, request.leaveTypeId, distribution, asBoolean(leaveType.deducts_balance));
  }

  const requestId = database.transaction(() => {
    const result = database.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      request.employeeId,
      request.leaveTypeId,
      request.startDate,
      request.endDate,
      days,
      request.reason ? request.reason.trim() : null,
    );
    const newRequestId = Number(result.lastInsertRowid);
    const insertYearDays = database.prepare(
      "INSERT INTO leave_request_year_days (request_id, year, days) VALUES (?, ?, ?)",
    );
    for (const entry of distribution) insertYearDays.run(newRequestId, entry.year, entry.days);
    writeRequestAudit(database, newRequestId, "create", null, {
      leave_type_id: request.leaveTypeId,
      start_date: request.startDate,
      end_date: request.endDate,
      days,
      status: "pending",
      override: hasOverride,
    });
    if (hasOverride) {
      writeRequestAudit(database, newRequestId, "override", null, { reason: request.overrideReason!.trim(), days });
    }
    return newRequestId;
  })();

  return mapRequestRow(fetchRequestById(database, requestId));
}

function assertAttachmentPresent(database: Database, requestId: number): void {
  const document = database.prepare(`
    SELECT 1 FROM employee_documents
    WHERE related_leave_id = ? AND category = 'leave_form'
  `).get(requestId);
  if (!document) throw new AppError("ATTACHMENT_REQUIRED", "لا يمكن اعتماد هذه الإجازة: يجب ربط استمارة الإجازة (مرفق) بالطلب أولًا.");
}

export function decideRequest(database: Database, input: unknown): LeaveRequestRecord {
  const decision = parseInput(leaveDecisionInputSchema, input) as LeaveDecisionInput;
  const existing = fetchRequestById(database, decision.requestId);
  if (existing.status !== "pending") {
    throw new AppError("LEAVE_REQUEST_NOT_PENDING", "لا يمكن اتخاذ قرار على طلب ليس قيد الانتظار.");
  }
  const leaveType = getLeaveTypeById(database, existing.leave_type_id);

  if (decision.decision === "approved" && asBoolean(leaveType.requires_attachment)) {
    assertAttachmentPresent(database, decision.requestId);
  }
  if (decision.decision === "approved" && asBoolean(leaveType.deducts_balance)
      && !hasOverrideRecord(database, decision.requestId)) {
    assertApprovalWithinBalance(database, existing);
  }

  database.transaction(() => {
    database.prepare(`
      UPDATE leave_requests
      SET status = ?, decided_at = datetime('now'), decided_note = ?
      WHERE id = ?
    `).run(decision.decision, decision.note ? decision.note.trim() : null, decision.requestId);
    writeRequestAudit(database, decision.requestId, decision.decision, { status: "pending" }, {
      status: decision.decision,
      note: decision.note ? decision.note.trim() : null,
    });
    if (decision.decision === "approved") {
      const distribution = loadFrozenDistribution(database, existing.id);
      applyLeave(
        database,
        decision.requestId,
        existing.employee_id,
        existing.leave_type_id,
        Number(existing.start_date.slice(0, 4)),
        existing.days,
        distribution,
      );
    }
  })();

  return mapRequestRow(fetchRequestById(database, decision.requestId));
}

function loadFrozenDistribution(database: Database, requestId: number): DistributionEntry[] {
  return database
    .prepare("SELECT year, days FROM leave_request_year_days WHERE request_id = ? ORDER BY year")
    .all(requestId) as DistributionEntry[];
}

function hasOverrideRecord(database: Database, requestId: number): boolean {
  const row = database.prepare(
    "SELECT 1 FROM audit_log WHERE entity = 'leave_request' AND entity_id = ? AND action = 'override'",
  ).get(requestId);
  return Boolean(row);
}

// عند الاعتماد: أعد فحص الرصيد المعتمد فعليًا، إلا لو سُجّل تجاوز بسبب وقت الإنشاء.
function assertApprovalWithinBalance(database: Database, existing: LeaveRequestDbRow): void {
  for (const entry of loadFrozenDistribution(database, existing.id)) {
    const available = getAvailableLeave(database, existing.employee_id, existing.leave_type_id, entry.year);
    if (entry.days > available.remaining) {
      throw new AppError(
        "INSUFFICIENT_BALANCE",
        `لا يمكن الاعتماد: رصيد سنة ${entry.year} غير كافٍ (المطلوب ${entry.days} يوم والمتبقي ${available.remaining} يوم).`,
      );
    }
  }
}

export function cancelRequest(database: Database, requestIdInput: unknown): LeaveRequestRecord {
  const requestId = parseInput(leaveRequestIdSchema, requestIdInput);
  const existing = fetchRequestById(database, requestId);
  if (existing.status !== "approved") {
    throw new AppError("LEAVE_REQUEST_NOT_CANCELLABLE", "يمكن إلغاء الطلبات المعتمدة فقط.");
  }

  database.transaction(() => {
    database.prepare(`
      UPDATE leave_requests
      SET status = 'cancelled', decided_at = datetime('now'), decided_note = ?
      WHERE id = ?
    `).run("تم الإلغاء", requestId);
    writeRequestAudit(database, requestId, "cancel", { status: "approved" }, { status: "cancelled" });
    const distribution = loadFrozenDistribution(database, existing.id);
    reverseLeave(
      database,
      requestId,
      existing.employee_id,
      existing.leave_type_id,
      Number(existing.start_date.slice(0, 4)),
      existing.days,
      distribution,
    );
  })();

  return mapRequestRow(fetchRequestById(database, requestId));
}

export function listRequests(database: Database, filterInput: unknown = {}): LeaveRequestRecord[] {
  const filter = parseInput(leaveRequestFilterSchema, filterInput) as LeaveRequestFilter;
  const status = filter.status ?? "all";
  const rows = database.prepare(`
    SELECT ${REQUEST_SELECT_COLUMNS}
    FROM leave_requests AS lr
    JOIN employees AS e ON e.id = lr.employee_id
    JOIN leave_types AS lt ON lt.id = lr.leave_type_id
    WHERE (@status = 'all' OR lr.status = @status)
      AND (@leaveTypeId IS NULL OR lr.leave_type_id = @leaveTypeId)
      AND (@leaveTypeKey IS NULL OR lr.leave_type_id = (
        SELECT lt2.id FROM leave_types AS lt2 WHERE lt2.key = @leaveTypeKey
      ))
      AND (@year IS NULL OR CAST(strftime('%Y', lr.start_date) AS INTEGER) = @year)
      AND (@search = '' OR e.code LIKE @pattern OR e.full_name LIKE @pattern)
    ORDER BY lr.start_date DESC, lr.id DESC
  `).all({
    status,
    leaveTypeId: filter.leaveTypeId ?? null,
    leaveTypeKey: filter.leaveTypeKey || null,
    year: filter.year ?? null,
    search: filter.search ?? "",
    pattern: `%${filter.search ?? ""}%`,
  }) as LeaveRequestDbRow[];
  return rows.map(mapRequestRow);
}

export function getEmployeeLeaveSummary(
  database: Database,
  employeeIdInput: unknown,
  yearInput?: unknown,
): EmployeeLeaveSummary {
  const parsed = parseInput(employeeLeaveSummarySchema, {
    employeeId: employeeIdInput,
    year: yearInput ?? currentYear(),
  }) as { employeeId: number; year: number };
  assertEmployeeExists(database, parsed.employeeId);

  const leaveTypes = database.prepare(`
    SELECT id, key, name_ar, yearly_entitlement, deducts_balance, counts_weekends, requires_attachment, active
    FROM leave_types ORDER BY id
  `).all() as Array<{
    id: number;
    key: string;
    name_ar: string;
    yearly_entitlement: number | null;
    deducts_balance: number;
    counts_weekends: number;
    requires_attachment: number;
    active: number;
  }>;

  const balances: LeaveBalanceSummary[] = leaveTypes.map((leaveType) => {
    const available = getAvailableLeave(database, parsed.employeeId, leaveType.id, parsed.year);
    return {
      leaveTypeId: leaveType.id,
      leaveTypeKey: leaveType.key,
      leaveTypeName: leaveType.name_ar,
      ...available,
    };
  });

  return { employeeId: parsed.employeeId, year: parsed.year, balances };
}

export function getLowBalances(database: Database, yearInput?: unknown): LowBalanceAlert[] {
  const year = yearInput ?? currentYear();
  const threshold = readLowBalanceThreshold(database);
  return listLowBalanceAlerts(database, Number(year), threshold);
}
