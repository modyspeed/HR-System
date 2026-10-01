import { Check } from "lucide-react";
import { Button, Card } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import type { ThemePreference } from "../api/contracts";
import { useTheme } from "../theme/ThemeProvider";

const themeChoices: Array<{ id: ThemePreference; label: string; description: string }> = [
  { id: "system", label: "حسب النظام", description: "يتبع إعداد مظهر Windows." },
  { id: "light", label: "فاتح", description: "واجهة بإضاءة فاتحة." },
  { id: "dark", label: "داكن", description: "واجهة بإضاءة منخفضة." },
];

export function SettingsPage() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="settings-page">
      <div className="page-heading">
        <p className="eyebrow">النظام</p>
        <h1>الإعدادات</h1>
        <p>تفضيلات المظهر لهذا الجهاز.</p>
      </div>
      <Card className="settings-card" title="المظهر">
        <fieldset className="theme-choice-list">
          <legend className="visually-hidden">اختيار المظهر</legend>
          {themeChoices.map((choice) => (
            <Button
              aria-pressed={preference === choice.id}
              className={`theme-choice${preference === choice.id ? " is-selected" : ""}`}
              key={choice.id}
              onClick={() => void setPreference(choice.id).catch(() => toast.error("تعذر حفظ المظهر."))}
              type="button"
              variant="ghost"
            >
              <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
              {preference === choice.id && <Check size={17} aria-hidden="true" />}
            </Button>
          ))}
        </fieldset>
      </Card>
    </div>
  );
}