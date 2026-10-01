import type { LeaveDeskApi } from "./contracts";

declare global {
  interface Window {
    leaveDesk?: LeaveDeskApi;
  }
}

export {};