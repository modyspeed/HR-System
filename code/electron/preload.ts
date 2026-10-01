import { contextBridge, ipcRenderer } from "electron";
import type { AppSummary } from "../src/core/api/contracts";

contextBridge.exposeInMainWorld("leaveDesk", {
  getSummary: (): Promise<AppSummary> =>
    ipcRenderer.invoke("app:get-summary") as Promise<AppSummary>,
});