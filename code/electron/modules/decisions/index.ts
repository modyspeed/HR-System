import decisionSchema from "./migrations/001_decisions.sql?raw";
import type { ElectronModule } from "../../core/moduleTypes";

export const decisionsModule: ElectronModule = {
  id: "decisions",
  nameAr: "القرارات",
  order: 3,
  routes: ["/decisions"],
  nav: [{ path: "/decisions", labelAr: "القرارات", icon: "gavel" }],
  dependsOn: ["employees"],
  migrationsDir: "electron/modules/decisions/migrations",
  migrations: [{ name: "001_decisions.sql", sql: decisionSchema }],
  registerIpc: () => undefined,
};