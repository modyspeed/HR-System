import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import { openApplicationDatabase } from "./core/db";
import { registerApplicationIpc } from "./core/ipc";
import { readThemePreference, registerThemeIpc } from "./core/theme";
import { electronModuleRegistry } from "./modules";

async function createApplicationWindow(): Promise<void> {
  const dataDirectory = join(app.getPath("documents"), "LeaveDeskData");
  await Promise.all(
    ["employee_files", "backups", "imports"].map((directory) =>
      mkdir(join(dataDirectory, directory), { recursive: true }),
    ),
  );

  const database = openApplicationDatabase(dataDirectory);
  let themePreference = readThemePreference(database);
  nativeTheme.themeSource = themePreference;
  registerApplicationIpc(database);
  for (const module of electronModuleRegistry) {
    module.registerIpc({ database, ipcMain });
  }

  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: "LeaveDesk",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0B1020" : "#F4F5FB",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [
        `--leavedesk-theme=${themePreference}`,
        `--leavedesk-system-dark=${nativeTheme.shouldUseDarkColors ? "1" : "0"}`,
      ],
    },
  });
  registerThemeIpc(database, window, (preference) => {
    themePreference = preference;
    nativeTheme.themeSource = preference;
  });
  nativeTheme.on("updated", () => {
    if (themePreference === "system" && !window.isDestroyed()) {
      window.webContents.send("theme:system-changed", nativeTheme.shouldUseDarkColors);
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createApplicationWindow).catch((error: unknown) => {
  console.error("LeaveDesk failed to start.", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});