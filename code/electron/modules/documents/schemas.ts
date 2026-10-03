import { z } from "zod";

const id = (message: string) => z.number({ invalid_type_error: message }).int(message).positive(message);

export const employeeIdSchema = id("رقم الموظف غير صحيح.");
export const documentIdSchema = id("رقم الملف غير صحيح.");

export const pickAndAddInputSchema = z.object({
  employeeId: employeeIdSchema,
  category: z.enum(["general", "leave_form", "decision"], {
    errorMap: () => ({ message: "تصنيف الملف غير صحيح." }),
  }),
  relatedLeaveId: id("رقم طلب الإجازة غير صحيح.").nullable().optional(),
  relatedDecisionId: id("رقم القرار غير صحيح.").nullable().optional(),
});
