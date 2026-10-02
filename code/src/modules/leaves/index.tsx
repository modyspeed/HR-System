import "./leaves.css";
import { LeaveLogPage } from "./pages/LeaveLogPage";
import { LeaveRequestPage } from "./pages/LeaveRequestPage";

interface LeavesModuleProps {
  path: string;
  onNavigate(path: string): void;
}

export function LeavesModule({ path, onNavigate }: LeavesModuleProps) {
  if (path === "/leaves/new") {
    return <LeaveRequestPage onNavigate={onNavigate} />;
  }
  return <LeaveLogPage onNavigate={onNavigate} />;
}
