import { z } from "zod";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

const UNSAFE_CODE_CHARS = /[\\/:*?"<>|\u0000-\u001f]/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function isValidEmployeeCode(value: string): boolean {
  // نفس قواعد أسماء الفولدرات في documents/pathSafety.ts (قرار D28): الكود اسم فولدر الموظف.
  if (UNSAFE_CODE_CHARS.test(value)) return false;
  if (value.startsWith(".") || /[. ]$/.test(value)) return false;
  // أسماء ويندوز المحجوزة (CON وPRN و... وسواء بامتداد مثل con.txt أو بدونه).
  if (WINDOWS_RESERVED.test(value.split(".")[0] ?? "")) return false;
  return true;
}

export const employeeInputSchema = z.object({
  code: z.string()
    .trim()
    .min(1, "كود الموظف مطلوب.")
    .max(50, "كود الموظف طويل جدًا.")
    .refine(isValidEmployeeCode, "كود الموظف يحتوي رموزًا غير مسموحة"),
  full_name: z.string().trim().min(1, "اسم الموظف مطلوب.").max(200, "اسم الموظف طويل جدًا."),
  department_id: z.number({ invalid_type_error: "القسم مطلوب." }).int("القسم غير صحيح.").positive("القسم مطلوب."),
  hire_date: z.string().refine(isValidIsoDate, "تاريخ التعيين يجب أن يكون تاريخًا صحيحًا بصيغة yyyy-mm-dd."),
  job_title: z.string().trim().max(160, "المسمى الوظيفي طويل جدًا.").optional(),
  birth_date: z.string().refine(isValidIsoDate, "تاريخ الميلاد غير صحيح.").optional(),
  national_id: z.string().trim().max(30, "رقم الهوية طويل جدًا.").optional(),
  phone: z.string().trim().max(30, "رقم الهاتف طويل جدًا.").optional(),
  notes: z.string().trim().max(4000, "الملاحظات طويلة جدًا.").optional(),
});

export const employeeListFilterSchema = z.object({
  search: z.string().trim().max(200, "عبارة البحث طويلة جدًا.").default(""),
  departmentId: z.number().int().positive().nullable().optional(),
  status: z.enum(["active", "resigned", "terminated", "suspended", "all"]).default("active"),
});

export const employeeIdSchema = z.number().int().positive("رقم الموظف غير صحيح.");

export const employeeStatusSchema = z.enum(["active", "resigned", "terminated", "suspended"], {
  errorMap: () => ({ message: "حالة الموظف غير صحيحة." }),
});

export const departmentNameSchema = z.string()
  .trim()
  .min(1, "اسم القسم مطلوب.")
  .max(120, "اسم القسم طويل جدًا.");

export const employeeUpdateSchema = z.object({
  id: employeeIdSchema,
  employee: employeeInputSchema,
});

export const employeeStatusInputSchema = z.object({
  id: employeeIdSchema,
  status: employeeStatusSchema,
});