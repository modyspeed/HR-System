import { describe, expect, it } from "vitest";
import { employeeFormSchema } from "./validation";

describe("employee form validation", () => {
  it("requires code, name, department, and valid hire date but not job title", () => {
    expect(employeeFormSchema.safeParse({
      code: "EMP-TEST",
      fullName: "اسم تجريبي",
      departmentId: "1",
      hireDate: "2024-02-29",
      jobTitle: "",
    }).success).toBe(true);

    expect(employeeFormSchema.safeParse({
      code: "EMP-TEST",
      fullName: "اسم تجريبي",
      departmentId: "1",
      hireDate: "2023-02-29",
      jobTitle: "",
    }).success).toBe(false);
  });
});