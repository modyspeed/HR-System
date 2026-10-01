import documentSchema from "./migrations/001_documents.sql?raw";
import type { ElectronModule } from "../../core/moduleTypes";

export const documentsModule: ElectronModule = {
  id: "documents",
  nameAr: "ملفات الموظفين",
  order: 4,
  routes: ["/documents"],
  nav: [{ path: "/documents", labelAr: "ملفات الموظفين", icon: "files" }],
  dependsOn: ["leaves", "decisions"],
  migrationsDir: "electron/modules/documents/migrations",
  migrations: [{ name: "001_documents.sql", sql: documentSchema }],
  registerIpc: () => undefined,
};