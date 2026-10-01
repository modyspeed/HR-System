import { beforeEach, describe, expect, it, vi } from "vitest";
import { ipcMain, nativeTheme } from "electron";
import type { Database } from "better-sqlite3";
import { readThemePreference, registerThemeIpc } from "./theme";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  nativeTheme: { shouldUseDarkColors: true },
}));

describe("theme preference persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads an allowed preference and falls back to system", () => {
    const database = {
      prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue({ value: "dark" }) }),
    } as unknown as Database;
    expect(readThemePreference(database)).toBe("dark");

    const invalidDatabase = {
      prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue({ value: "sepia" }) }),
    } as unknown as Database;
    expect(readThemePreference(invalidDatabase)).toBe("system");
  });

  it("writes a valid preference through the fixed theme channel", () => {
    const run = vi.fn();
    const database = {
      prepare: vi.fn().mockReturnValue({ run }),
    } as unknown as Database;
    const send = vi.fn();
    const window = { webContents: { send } } as unknown as Electron.BrowserWindow;
    const onPreferenceChanged = vi.fn();

    registerThemeIpc(database, window, onPreferenceChanged);
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as unknown as (
      event: unknown,
      value: unknown,
    ) => string;

    expect(handler({}, "dark")).toBe("dark");
    expect(ipcMain.handle).toHaveBeenCalledWith("theme:set", expect.any(Function));
    expect(database.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO settings"));
    expect(run).toHaveBeenCalledWith("dark");
    expect(onPreferenceChanged).toHaveBeenCalledWith("dark");
    expect(send).toHaveBeenCalledWith("theme:system-changed", true);
  });

  it("rejects invalid preferences without writing them", () => {
    const run = vi.fn();
    const database = {
      prepare: vi.fn().mockReturnValue({ run }),
    } as unknown as Database;
    registerThemeIpc(database, { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow, vi.fn());
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as unknown as (
      event: unknown,
      value: unknown,
    ) => string;

    expect(() => handler({}, "sepia")).toThrow("Invalid theme preference.");
    expect(run).not.toHaveBeenCalled();
  });
});