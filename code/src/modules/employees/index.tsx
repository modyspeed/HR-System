import "./employees.css";
import { EmployeesPage } from "./pages/EmployeesPage";
import { EmployeeProfilePage } from "./pages/EmployeeProfilePage";

interface EmployeesModuleProps {
  path: string;
  onNavigate(path: string): void;
}

export function EmployeesModule({ path, onNavigate }: EmployeesModuleProps) {
  const profileMatch = /^\/employees\/(\d+)$/.exec(path);
  if (profileMatch) {
    return <EmployeeProfilePage employeeId={Number(profileMatch[1])} onBack={() => onNavigate("/employees")} />;
  }
  return <EmployeesPage onOpenEmployee={(id) => onNavigate(`/employees/${id}`)} />;
}