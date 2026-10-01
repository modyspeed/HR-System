import type { AppSummary } from "./contracts";

export function getAppSummary(): Promise<AppSummary> {
  const getSummary = window.leaveDesk?.getSummary;
  if (!getSummary) {
    return Promise.resolve({ employeeCount: 0, enabledModules: [] });
  }

  return getSummary();
}