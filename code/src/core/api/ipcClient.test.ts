import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmployee, listEmployees, DESKTOP_ONLY_MESSAGE } from "./ipcClient";

describe("IPC client outside Electron", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails employee data operations with the D19 message when preload is absent", () => {
    vi.stubGlobal("window", { leaveDesk: undefined });

    expect(() => listEmployees({ search: "", departmentId: null })).toThrow(DESKTOP_ONLY_MESSAGE);
    expect(() => createEmployee({
      code: "TEST-001",
      fullName: "اسم تجريبي",
      departmentId: 1,
      hireDate: "2024-01-01",
      jobTitle: "",
    })).toThrow("هذه الوظيفة تعمل داخل التطبيق فقط");
  });
});