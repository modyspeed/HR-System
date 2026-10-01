export interface EnabledModule {
  id: string;
  nameAr: string;
}

export interface AppSummary {
  employeeCount: number;
  enabledModules: EnabledModule[];
}

export type ThemePreference = "system" | "light" | "dark";

export interface LeaveDeskApi {
  getSummary(): Promise<AppSummary>;
  setTheme(preference: ThemePreference): Promise<ThemePreference>;
  initialTheme: ThemePreference;
  initialSystemDark: boolean;
  onSystemThemeChanged(listener: (isDark: boolean) => void): () => void;
}