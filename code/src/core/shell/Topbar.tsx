import { Bell, Moon, Sun } from "lucide-react";
import { CommandPalette, type CommandItem } from "./CommandPalette";
import { IconButton, toast } from "../../components/ui";
import { useTheme } from "../theme/ThemeProvider";

interface TopbarProps {
  commandItems: CommandItem[];
  onNavigate(path: string): void;
}

export function Topbar({ commandItems, onNavigate }: TopbarProps) {
  const { effectiveTheme, setPreference } = useTheme();
  const ThemeIcon = effectiveTheme === "dark" ? Sun : Moon;

  return (
    <header className="app-topbar">
      <CommandPalette items={commandItems} onSelect={onNavigate} />
      <div className="topbar-actions">
        <IconButton label="الإشعارات" onClick={() => toast.info("لا توجد إشعارات جديدة.")}>
          <Bell size={18} aria-hidden="true" />
          <span className="notification-indicator" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={effectiveTheme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
          onClick={() =>
            void setPreference(effectiveTheme === "dark" ? "light" : "dark")
              .catch(() => toast.error("تعذر حفظ المظهر."))
          }
        >
          <ThemeIcon size={18} aria-hidden="true" />
        </IconButton>
        <span aria-label="المستخدم الحالي" className="user-avatar" title="المستخدم الحالي">م</span>
      </div>
    </header>
  );
}