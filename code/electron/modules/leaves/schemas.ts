import { z } from "zod";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export const leaveRequestInputSchema = z.object({
  employeeId: z.number({ invalid_type_error: "رقم الموظف غير صحيح." })
    .int("رقم الموظف غير صحيح.")
    .positive("رقم الموظف غير صحيح."),
  leaveTypeId: z.number({ invalid_type_error: "نوع الإجازة غير صحيح." })
    .int("نوع الإجازة غير صحيح.")
    .positive("نوع الإجازة غير صحيح."),
  startDate: z.string().refine(isValidIsoDate, "تاريخ البداية يجب أن يكون تاريخًا صحيحًا بصيغة yyyy-mm-dd."),
  endDate: z.string().refine(isValidIsoDate, "تاريخ النهاية يجب أن يكون تاريخًا صحيحًا بصيغة yyyy-mm-dd."),
  reason: z.string().trim().max(2000, "سبب الإجازة طويل جدًا.").optional(),
  overrideReason: z.string()
    .trim()
    .min(1, "سبب تجاوز الرصيد مطلوب.")
    .max(500, "سبب التجاوز طويل جدًا.")
    .optional(),
}).refine((value) => value.startDate <= value.endDate, {
  message: "تاريخ النهاية يجب أن يكون مساويًا أو بعد تاريخ البداية.",
  path: ["endDate"],
});

export const leaveRequestFilterSchema = z.object({
  search: z.string().trim().max(200, "عبارة البحث طويلة جدًا.").default(""),
  leaveTypeId: z.number().int().positive("نوع الإجازة غير صحيح.").nullable().optional(),
  leaveTypeKey: z.string().trim().max(50, "نوع الإجازة غير صحيح.").nullable().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled", "all"]).optional(),
  year: z.number().int().min(2000, "السنة غير صحيحة.").max(2100, "السنة غير صحيحة.").optional(),
});

export const leaveDecisionInputSchema = z.object({
  requestId: z.number({ invalid_type_error: "رقم الطلب غير صحيح." })
    .int("رقم الطلب غير صحيح.")
    .positive("رقم الطلب غير صحيح."),
  decision: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "القرار غير صحيح: يجب أن يكون اعتماد أو رفض." }),
  }),
  note: z.string().trim().max(1000, "ملاحظة القرار طويلة جدًا.").optional(),
});

export const leaveRequestIdSchema = z.number({ invalid_type_error: "رقم الطلب غير صحيح." })
  .int("رقم الطلب غير صحيح.")
  .positive("رقم الطلب غير صحيح.");

export const employeeLeaveSummarySchema = z.object({
  employeeId: z.number({ invalid_type_error: "رقم الموظف غير صحيح." })
    .int("رقم الموظف غير صحيح.")
    .positive("رقم الموظف غير صحيح."),
  year: z.number().int().min(2000, "السنة غير صحيحة.").max(2100, "السنة غير صحيحة.").optional(),
});
