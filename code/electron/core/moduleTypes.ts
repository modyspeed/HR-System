import type { Database } from "better-sqlite3";
import type { IpcMain } from "electron";
import type { DocumentsHostServices } from "../modules/documents/ipc";

export interface ModuleMigration {
  name: string;
  sql: string;
}

export interface ModuleContext {
  database: Database;
  ipcMain: IpcMain;
  /** خدمات المضيف (Electron) لوحدة documents: مربع الحوار وفتح المجلد ومسار الجذر. قد تكون undefined للوحدات الأخرى. */
  host?: DocumentsHostServices;
}

export interface ElectronModule {
  id: string;
  nameAr: string;
  order: number;
  routes: string[];
  nav: Array<{ path: string; labelAr: string; icon: string }>;
  dependsOn: string[];
  migrationsDir: string;
  migrations: ModuleMigration[];
  registerIpc(context: ModuleContext): void;
}