import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

export interface CommandItem {
  id: string;
  label: string;
  keywords?: string;
  icon: ReactNode;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onSelect(path: string): void;
}

export function CommandPalette({ items, onSelect }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((isOpen) => !isOpen);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <>
      <button className="command-trigger" onClick={() => setOpen(true)} type="button">
        <span><Search aria-hidden="true" size={18} /> ابحث عن شاشة</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Command.Dialog
        aria-label="البحث والتنقل"
        className="command-dialog"
        label="البحث والتنقل"
        onOpenChange={setOpen}
        open={open}
      >
        <div className="command-search-row">
          <Search aria-hidden="true" size={18} />
          <Command.Input autoFocus placeholder="اكتب اسم الشاشة..." />
          <kbd>ESC</kbd>
        </div>
        <Command.List>
          <Command.Empty>لا توجد نتائج</Command.Empty>
          <Command.Group heading="الشاشات">
            {items.map((item) => (
              <Command.Item
                key={item.id}
                onSelect={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                value={`${item.label} ${item.keywords ?? ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </>
  );
}