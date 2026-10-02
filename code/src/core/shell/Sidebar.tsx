import { useState } from "react";
import {
  CalendarDays, ChevronLeft, ClipboardList, FileStack, Gavel,
  LayoutDashboard, Settings, Users, type LucideIcon,
} from "lucide-react";
import { moduleRegistry } from "../../modules";
import { IconButton } from "../../components/ui/IconButton";

interface SidebarProps {
  currentPath: string;
  onNavigate(path: string): void;
}

const moduleIcons: Record<string, LucideIcon> = {
  users: Users,
  calendar: CalendarDays,
  files: FileStack,
  gavel: Gavel,
};

export function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-mark"><CalendarDays size={21} aria-hidden="true" /></span>
        {!collapsed && <span>LeaveDesk</span>}
      </div>
      <nav aria-label="التنقل الرئيسي" className="sidebar-nav">
        <p className="sidebar-section-label">الرئيسية</p>
        <SidebarLink
          active={currentPath === "/"}
          collapsed={collapsed}
          icon={LayoutDashboard}
          label="لوحة التحكم"
          onClick={() => onNavigate("/")}
        />
        <p className="sidebar-section-label">الوحدات</p>
        {moduleRegistry.flatMap((module) =>
          module.nav.map((item) => {
            const Icon = moduleIcons[item.icon] ?? ClipboardList;
            return (
              <SidebarLink
                active={currentPath === item.path || currentPath.startsWith(`${item.path}/`)}
                collapsed={collapsed}
                icon={Icon}
                key={`${module.id}:${item.path}`}
                label={item.labelAr}
                onClick={() => onNavigate(item.path)}
              />
            );
          }),
        )}
        <p className="sidebar-section-label">النظام</p>
        <SidebarLink
          active={currentPath === "/settings"}
          collapsed={collapsed}
          icon={Settings}
          label="الإعدادات"
          onClick={() => onNavigate("/settings")}
        />
      </nav>
      <footer className="sidebar-footer">
        {!collapsed && <span>نسخة تجريبية · قاعدة محلية</span>}
        <IconButton
          label={collapsed ? "توسيع القائمة" : "طي القائمة"}
          onClick={() => setCollapsed((value) => !value)}
        >
          <ChevronLeft className={collapsed ? "collapse-icon is-reversed" : "collapse-icon"} size={17} aria-hidden="true" />
        </IconButton>
      </footer>
    </aside>
  );
}

interface SidebarLinkProps {
  active: boolean;
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  onClick(): void;
}

function SidebarLink({ active, collapsed, icon: Icon, label, onClick }: SidebarLinkProps) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={`sidebar-link${active ? " is-active" : ""}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
      type="button"
    >
      <Icon aria-hidden="true" size={19} />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}