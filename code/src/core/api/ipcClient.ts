import type { AppSummary } from "./contracts";

export function getAppSummary(): Promise<AppSummary> {
  return window.leaveDesk.getSummary();
}