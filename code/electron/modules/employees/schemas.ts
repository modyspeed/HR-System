import { z } from "zod";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export const employeeInputSchema = z.object({
  code: z.string().trim().min(1, "كود الموظف مطلوب.").max(50, "كود الموظف طويل جدًا."),
  fullName: z.string().trim().min(1, "اسم الموظف مطلوب.").max(200, "اسم الموظف طويل جدًا."),
  departmentId: z.number().int().positive("القسم مطلوب."),
  hireDate: z.string().refine(isValidIsoDate, "تاريخ التعيين غير صحيح."),
  jobTitle: z.string().trim().max(160, "المسمى الوظيفي طويل جدًا.").optional().or(z.literal("")),
});

export const employeeListFilterSchema = z.object({
  search: z.string().trim().max(200, "عبارة البحث طويلة جدًا.").default(""),
  departmentId: z.number().int().positive().nullable().default(null),
});

export const employeeIdSchema = z.number().int().positive("رقم الموظف غير صحيح.");

export const employeeStatusSchema = z.enum(["active", "resigned", "terminated", "suspended"], {
  errorMap: () => ({ message: "حالة الموظف غير صحيحة." }),
});

export const setEmployeeStatusSchema = z.object({
  id: employeeIdSchema,
  status: employeeStatusSchema,
});

export const departmentNameSchema = z.string()
  .trim()
  .min(1, "اسم القسم مطلوب.")
  .max(120, "اسم القسم طويل جدًا.");

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new EmployeeServiceError(result.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة.");
  }
  return result.data;
}

export class EmployeeServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeServiceError";
  }
}