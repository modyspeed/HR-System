import employeeSchema from "./migrations/001_employees.sql?raw";
import type { ElectronModule } from "../../core/moduleTypes";

export const employeesModule: ElectronModule = {
  id: "employees",
  nameAr: "الموظفون",
  order: 1,
  routes: ["/employees"],
  nav: [{ path: "/employees", labelAr: "الموظفون", icon: "users" }],
  dependsOn: [],
  migrationsDir: "electron/modules/employees/migrations",
  migrations: [{ name: "001_employees.sql", sql: employeeSchema }],
  registerIpc: () => undefined,
};