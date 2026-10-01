import { contextBridge, ipcRenderer } from "electron";
import type { AppSummary, ThemePreference } from "../src/core/api/contracts";

function readInitialTheme(): ThemePreference {
  const argument = process.argv.find((value) => value.startsWith("--leavedesk-theme="));
  const preference = argument?.slice("--leavedesk-theme=".length);
  return preference === "light" || preference === "dark" ? preference : "system";
}

const initialTheme = readInitialTheme();
const initialSystemDark = process.argv.includes("--leavedesk-system-dark=1");

contextBridge.exposeInMainWorld("leaveDesk", {
  getSummary: (): Promise<AppSummary> =>
    ipcRenderer.invoke("app:get-summary") as Promise<AppSummary>,
  setTheme: (preference: ThemePreference): Promise<ThemePreference> =>
    ipcRenderer.invoke("theme:set", preference) as Promise<ThemePreference>,
  initialTheme,
  initialSystemDark,
  onSystemThemeChanged: (listener: (isDark: boolean) => void): (() => void) => {
    const handleThemeChange = (_event: Electron.IpcRendererEvent, isDark: boolean) => {
      listener(isDark);
    };
    ipcRenderer.on("theme:system-changed", handleThemeChange);
    return () => ipcRenderer.removeListener("theme:system-changed", handleThemeChange);
  },
});