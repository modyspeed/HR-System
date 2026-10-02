import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import {
  CalendarDays, FileStack, Gavel, LayoutDashboard, Settings, Users,
} from "lucide-react";
import { ToastViewport } from "../../components/ui/Toast";
import { moduleRegistry } from "../../modules";
import { DashboardPage } from "./pages/DashboardPage";
import { DesignGalleryPage } from "./pages/DesignGalleryPage";
import { SettingsPage } from "./SettingsPage";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { CommandItem } from "./CommandPalette";
import { useTheme } from "../theme/ThemeProvider";
import { EmployeesModule } from "../../modules/employees";
import { LeavesModule } from "../../modules/leaves";

const moduleIcons = {
  employees: <Users size={16} aria-hidden="true" />,
  leaves: <CalendarDays size={16} aria-hidden="true" />,
  documents: <FileStack size={16} aria-hidden="true" />,
  decisions: <Gavel size={16} aria-hidden="true" />,
};

const coreScreens: CommandItem[] = [
  { id: "/", label: "لوحة التحكم", keywords: "الرئيسية dashboard", icon: <LayoutDashboard size={16} aria-hidden="true" /> },
  { id: "/design", label: "معرض المكونات", keywords: "تصميم عناصر", icon: <Settings size={16} aria-hidden="true" /> },
  { id: "/settings", label: "الإعدادات", keywords: "المظهر الثيم", icon: <Settings size={16} aria-hidden="true" /> },
];

function readPath(): string {
  const path = window.location.hash.slice(1);
  return path || "/";
}

export function AppShell() {
  const [currentPath, setCurrentPath] = useState(readPath);
  const reducedMotion = useReducedMotion();
  const { effectiveTheme } = useTheme();

  useEffect(() => {
    const updatePath = () => setCurrentPath(readPath());
    window.addEventListener("hashchange", updatePath);
    return () => window.removeEventListener("hashchange", updatePath);
  }, []);

  const commandItems = useMemo(
    () => [
      ...coreScreens,
      ...moduleRegistry.map((module) => ({
        id: module.nav[0]?.path ?? `/${module.id}`,
        label: module.nameAr,
        keywords: module.id,
        icon: moduleIcons[module.id as keyof typeof moduleIcons],
      })),
    ],
    [],
  );

  function navigate(path: string) {
    if (window.location.hash === `#${path}`) setCurrentPath(path);
    else window.location.hash = path;
  }

  const pageTitle = currentPath === "/"
    ? "لوحة التحكم"
    : currentPath === "/design"
      ? "معرض المكونات"
      : currentPath === "/settings"
        ? "الإعدادات"
        : moduleRegistry.find((module) => module.nav[0]?.path === currentPath)?.nameAr ?? "LeaveDesk";

  let page = <PlaceholderPage title={pageTitle} />;
  if (currentPath === "/") page = <DashboardPage />;
  if (currentPath === "/design") page = <DesignGalleryPage />;
  if (currentPath === "/settings") page = <SettingsPage />;
  if (currentPath === "/employees" || /^\/employees\/\d+$/.test(currentPath)) {
    page = <EmployeesModule path={currentPath} onNavigate={navigate} />;
  }
  if (currentPath === "/leaves" || currentPath === "/leaves/new") {
    page = <LeavesModule path={currentPath} onNavigate={navigate} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <Sidebar currentPath={currentPath} onNavigate={navigate} />
        <div className="app-main-column">
          <Topbar commandItems={commandItems} onNavigate={navigate} />
          <AnimatePresence mode="wait">
            <motion.main
              animate={{ opacity: 1, x: 0 }}
              className="app-content"
              exit={{ opacity: 0, x: reducedMotion ? 0 : -8 }}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 8 }}
              key={currentPath}
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
            >
              {page}
            </motion.main>
          </AnimatePresence>
        </div>
        <ToastViewport theme={effectiveTheme} />
      </div>
    </MotionConfig>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="page-heading placeholder-page">
      <p className="eyebrow">الوحدات</p>
      <h1>{title}</h1>
      <p>هذه الصفحة قيد التجهيز ضمن المرحلة المخصصة لها.</p>
    </section>
  );
}