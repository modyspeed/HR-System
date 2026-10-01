import { decisionsModule } from "./decisions";
import { documentsModule } from "./documents";
import { employeesModule } from "./employees";
import { leavesModule } from "./leaves";

export const electronModuleRegistry = [
  employeesModule,
  leavesModule,
  decisionsModule,
  documentsModule,
];