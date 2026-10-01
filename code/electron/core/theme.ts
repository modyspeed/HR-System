import { ipcMain, nativeTheme, type BrowserWindow } from "electron";
import type { Database } from "better-sqlite3";
import type { ThemePreference } from "../../src/core/api/contracts";

const themePreferences: ThemePreference[] = ["system", "light", "dark"];

export function readThemePreference(database: Database): ThemePreference {
  const row = database
    .prepare("SELECT value FROM settings WHERE key = 'theme'")
    .get() as { value: string } | undefined;
  return themePreferences.includes(row?.value as ThemePreference)
    ? (row?.value as ThemePreference)
    : "system";
}

export function registerThemeIpc(
  database: Database,
  window: BrowserWindow,
  onPreferenceChanged: (preference: ThemePreference) => void,
): void {
  ipcMain.handle("theme:set", (_event, value: unknown): ThemePreference => {
    if (typeof value !== "string" || !themePreferences.includes(value as ThemePreference)) {
      throw new TypeError("Invalid theme preference.");
    }

    const preference = value as ThemePreference;
    database
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('theme', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(preference);
    onPreferenceChanged(preference);
    window.webContents.send("theme:system-changed", nativeTheme.shouldUseDarkColors);
    return preference;
  });
}