import { z } from "zod";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export const employeeFormSchema = z.object({
  code: z.string().trim().min(1, "كود الموظف مطلوب.").max(50, "كود الموظف طويل جدًا."),
  fullName: z.string().trim().min(1, "اسم الموظف مطلوب.").max(200, "اسم الموظف طويل جدًا."),
  departmentId: z.string().min(1, "القسم مطلوب.").refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, "القسم مطلوب."),
  hireDate: z.string().refine(isValidIsoDate, "تاريخ التعيين غير صحيح."),
  jobTitle: z.string().trim().max(160, "المسمى الوظيفي طويل جدًا."),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export function formatEmployeeFormErrors(error: z.ZodError): Partial<Record<keyof EmployeeFormValues, string>> {
  const messages: Partial<Record<keyof EmployeeFormValues, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in employeeFormSchema.shape) {
      messages[field as keyof EmployeeFormValues] ??= issue.message;
    }
  }
  return messages;
}