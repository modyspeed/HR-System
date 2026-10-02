import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDepartment,
  createEmployee,
  getAppSummary,
  getEmployee,
  listDepartments,
  listEmployees,
  setEmployeeStatus,
  updateEmployee,
  DESKTOP_ONLY_MESSAGE,
} from "./ipcClient";

describe("IPC client outside Electron", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the D19 error envelope when preload is absent", async () => {
    vi.stubGlobal("window", { leaveDesk: undefined });

    const input = {
      code: "TEST-001",
      fullName: "اسم تجريبي",
      departmentId: 1,
      hireDate: "2024-01-01",
      jobTitle: "",
    };
    const results = await Promise.all([
      getAppSummary(),
      listEmployees({ search: "", departmentId: null }),
      getEmployee(1),
      createEmployee(input),
      updateEmployee(1, input),
      setEmployeeStatus(1, "suspended"),
      listDepartments(),
      createDepartment("قسم تجريبي"),
    ]);

    expect(results).toHaveLength(8);
    for (const result of results) {
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_IN_APP", message: DESKTOP_ONLY_MESSAGE },
      });
    }
  });
});