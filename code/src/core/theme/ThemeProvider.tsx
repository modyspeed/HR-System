import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThemePreference } from "../api/contracts";

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveTheme: "light" | "dark";
  setPreference(preference: ThemePreference): Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(window.leaveDesk?.initialTheme ?? "system");
  const [systemDark, setSystemDark] = useState<boolean>(window.leaveDesk?.initialSystemDark ?? false);
  const effectiveTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const leaveDesk = window.leaveDesk;
    if (!leaveDesk?.onSystemThemeChanged) return;

    return leaveDesk.onSystemThemeChanged(setSystemDark);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.bsTheme = effectiveTheme;
  }, [effectiveTheme]);

  async function setPreference(nextPreference: ThemePreference): Promise<void> {
    const previousPreference = preference;
    setPreferenceState(nextPreference);

    try {
      if (!window.leaveDesk?.setTheme) return;
      await window.leaveDesk.setTheme(nextPreference);
    } catch (error) {
      setPreferenceState(previousPreference);
      throw error;
    }
  }

  const value = useMemo(
    () => ({ preference, effectiveTheme, setPreference }),
    [preference, effectiveTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}