export interface EnabledModule {
  id: string;
  nameAr: string;
}

export interface AppSummary {
  employeeCount: number;
  enabledModules: EnabledModule[];
}

export interface LeaveDeskApi {
  getSummary(): Promise<AppSummary>;
}