import { describe, expect, it } from "vitest";
import { employeeInputSchema } from "./schemas";

describe("employee input schema", () => {
  it("trims a valid code and accepts an optional job title", () => {
    const result = employeeInputSchema.safeParse({
      code: "  EMP-TEST  ",
      full_name: "موظف تجريبي",
      department_id: 2,
      hire_date: "2024-02-29",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("EMP-TEST");
      expect(result.data.job_title).toBeUndefined();
    }
  });

  it.each([
    [{ code: "   " }, "كود الموظف مطلوب."],
    [{ full_name: " " }, "اسم الموظف مطلوب."],
    [{ department_id: 0 }, "القسم مطلوب."],
    [{ department_id: -1 }, "القسم مطلوب."],
    [{ hire_date: "2023-02-29" }, "تاريخ التعيين يجب أن يكون تاريخًا صحيحًا بصيغة yyyy-mm-dd."],
    [{ hire_date: "2024-2-09" }, "تاريخ التعيين يجب أن يكون تاريخًا صحيحًا بصيغة yyyy-mm-dd."],
  ])("rejects invalid employee fields", (partial, expectedMessage) => {
    const result = employeeInputSchema.safeParse({
      code: "EMP-TEST",
      full_name: "موظف تجريبي",
      department_id: 1,
      hire_date: "2024-01-01",
      ...partial,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(expectedMessage);
  });

  it("accepts and validates optional employee fields", () => {
    const result = employeeInputSchema.safeParse({
      code: "EMP-TEST",
      full_name: "موظف تجريبي",
      department_id: 1,
      hire_date: "2024-01-01",
      job_title: "مراجع",
      birth_date: "1990-12-31",
      national_id: "TEST-ID",
      phone: "01000000000",
      notes: "بيانات اختبار وهمية",
    });
    expect(result.success).toBe(true);

    const invalidBirthDate = employeeInputSchema.safeParse({
      code: "EMP-TEST",
      full_name: "موظف تجريبي",
      department_id: 1,
      hire_date: "2024-01-01",
      birth_date: "1990-02-30",
    });
    expect(invalidBirthDate.success).toBe(false);
  });

  it.each([
    "EMP/101", "EMP\\101", "EMP:101", "EMP*101", 'EMP?101', 'EMP"101', "EMP<101", "EMP>101",
    "EMP|101", ".EMP-101", "EMP-101.", "EMP\u0000-101",
  ])("rejects employee code with unsafe folder characters: %s", (code) => {
    const result = employeeInputSchema.safeParse({
      code,
      full_name: "موظف تجريبي",
      department_id: 1,
      hire_date: "2024-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("كود الموظف يحتوي رموزًا غير مسموحة");
  });

  it.each(["EMP-101", "EMP_202", "موظف-١", "A.B.C"])("accepts ordinary employee codes: %s", (code) => {
    const result = employeeInputSchema.safeParse({
      code,
      full_name: "موظف تجريبي",
      department_id: 1,
      hire_date: "2024-01-01",
    });
    expect(result.success).toBe(true);
  });

  it.each(["CON", "con", "Con.txt", "PRN", "AUX", "NUL", "COM1", "com9", "LPT1", "LPT9.log"])(
    "rejects Windows-reserved employee codes: %s",
    (code) => {
      const result = employeeInputSchema.safeParse({
        code,
        full_name: "موظف تجريبي",
        department_id: 1,
        hire_date: "2024-01-01",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("كود الموظف يحتوي رموزًا غير مسموحة");
    },
  );

  it.each(["CONSOLE", "COMM", "LPT", "COMPUTER", "NULLIFIED"])("accepts codes that merely contain reserved names: %s", (code) => {
    const result = employeeInputSchema.safeParse({
      code,
      full_name: "موظف تجريبي",
      department_id: 1,
      hire_date: "2024-01-01",
    });
    expect(result.success).toBe(true);
  });
});