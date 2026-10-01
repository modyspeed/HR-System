import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { openApplicationDatabase } from "./core/db";
import { registerApplicationIpc } from "./core/ipc";
import { electronModuleRegistry } from "./modules";

async function createApplicationWindow(): Promise<void> {
  const dataDirectory = join(app.getPath("documents"), "LeaveDeskData");
  await Promise.all(
    ["employee_files", "backups", "imports"].map((directory) =>
      mkdir(join(dataDirectory, directory), { recursive: true }),
    ),
  );

  const database = openApplicationDatabase(dataDirectory);
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
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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