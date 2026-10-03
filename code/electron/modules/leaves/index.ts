import leaveSchema from "./migrations/001_leaves.sql?raw";
import leaveSeed from "./migrations/002_seed.sql?raw";
import leaveYearDays from "./migrations/003_request_year_days.sql?raw";
import type { ElectronModule } from "../../core/moduleTypes";
import { registerLeavesIpc } from "./ipc";

export const leavesModule: ElectronModule = {
  id: "leaves",
  nameAr: "الإجازات",
  order: 2,
  routes: ["/leaves"],
  nav: [{ path: "/leaves", labelAr: "الإجازات", icon: "calendar" }],
  dependsOn: ["employees"],
  migrationsDir: "electron/modules/leaves/migrations",
  migrations: [
    { name: "001_leaves.sql", sql: leaveSchema },
    { name: "002_seed.sql", sql: leaveSeed },
    { name: "003_request_year_days.sql", sql: leaveYearDays },
  ],
  registerIpc: ({ database, ipcMain }) => registerLeavesIpc(database, ipcMain),
};