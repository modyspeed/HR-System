import { describe, expect, it } from "vitest";
import {
  employeeLeaveSummarySchema,
  leaveDecisionInputSchema,
  leaveRequestFilterSchema,
  leaveRequestInputSchema,
  leaveRequestIdSchema,
} from "./schemas";

const validRequest = {
  employeeId: 1,
  leaveTypeId: 2,
  startDate: "2026-01-04",
  endDate: "2026-01-08",
  reason: "إجازة اعتيادية",
};

describe("leave request input schema", () => {
  it("accepts a valid request and trims the reason", () => {
    const result = leaveRequestInputSchema.safeParse({
      ...validRequest,
      reason: "  إجازة عائلية  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe("إجازة عائلية");
  });

  it("accepts an optional override reason", () => {
    const result = leaveRequestInputSchema.safeParse({
      ...validRequest,
      overrideReason: "تجاوز بقرار الإدارة",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty override reason", () => {
    const result = leaveRequestInputSchema.safeParse({
      ...validRequest,
      overrideReason: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("سبب تجاوز الرصيد مطلوب.");
  });

  it("rejects a non-positive employee id", () => {
    const result = leaveRequestInputSchema.safeParse({ ...validRequest, employeeId: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("رقم الموظف غير صحيح.");
  });

  it("rejects an invalid start date", () => {
    const result = leaveRequestInputSchema.safeParse({ ...validRequest, startDate: "2026-13-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("تاريخ البداية يجب أن يكون تاريخًا صحيحًا بصيغة yyyy-mm-dd.");
    }
  });

  it("rejects an end date before the start date", () => {
    const result = leaveRequestInputSchema.safeParse({
      ...validRequest,
      startDate: "2026-01-10",
      endDate: "2026-01-05",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("تاريخ النهاية يجب أن يكون مساويًا أو بعد تاريخ البداية.");
    }
  });
});

describe("leave request filter schema", () => {
  it("defaults the search to an empty string", () => {
    const result = leaveRequestFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.search).toBe("");
  });

  it("accepts type, status, year and nullable type", () => {
    const result = leaveRequestFilterSchema.safeParse({
      search: "موظف",
      leaveTypeId: null,
      status: "approved",
      year: 2026,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = leaveRequestFilterSchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range year", () => {
    const result = leaveRequestFilterSchema.safeParse({ year: 1999 });
    expect(result.success).toBe(false);
  });
});

describe("leave decision schema", () => {
  it("accepts approve and reject with an optional note", () => {
    expect(leaveDecisionInputSchema.safeParse({ requestId: 3, decision: "approved" }).success).toBe(true);
    const rejected = leaveDecisionInputSchema.safeParse({
      requestId: 3,
      decision: "rejected",
      note: "نقص الرصيد",
    });
    expect(rejected.success).toBe(true);
  });

  it("rejects an invalid decision value", () => {
    const result = leaveDecisionInputSchema.safeParse({ requestId: 3, decision: "maybe" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("القرار غير صحيح: يجب أن يكون اعتماد أو رفض.");
    }
  });

  it("rejects a non-positive request id", () => {
    const result = leaveDecisionInputSchema.safeParse({ requestId: -1, decision: "approved" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("رقم الطلب غير صحيح.");
  });
});

describe("leave request id and summary schemas", () => {
  it("accepts a positive request id", () => {
    expect(leaveRequestIdSchema.safeParse(7).success).toBe(true);
    expect(leaveRequestIdSchema.safeParse(0).success).toBe(false);
  });

  it("accepts a summary query with and without a year", () => {
    expect(employeeLeaveSummarySchema.safeParse({ employeeId: 5, year: 2026 }).success).toBe(true);
    expect(employeeLeaveSummarySchema.safeParse({ employeeId: 5 }).success).toBe(true);
    expect(employeeLeaveSummarySchema.safeParse({ employeeId: "5" }).success).toBe(false);
  });
});
