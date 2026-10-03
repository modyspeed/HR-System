import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Pencil, UserRound } from "lucide-react";
import { Badge, Button, Card, EmptyState, Skeleton, Tabs, toast } from "../../../components/ui";
import type { DepartmentRecord, EmployeeInput, EmployeeRecord } from "../../../core/api/contracts";
import { getEmployee, listDepartments, updateEmployee, unwrapApiResult } from "../../../core/api/ipcClient";
import { EmployeeFormModal } from "../components/EmployeeFormModal";
import { EmployeeFilesTab } from "../../../modules/documents/components/EmployeeFilesTab";
import "../../../modules/documents/documents.css";

interface EmployeeProfilePageProps {
  employeeId: number;
  onBack(): void;
}

export function EmployeeProfilePage({ employeeId, onBack }: EmployeeProfilePageProps) {
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const [employeeResult, departmentResult] = await Promise.all([getEmployee(employeeId), listDepartments()]);
        if (!active) return;
        setEmployee(unwrapApiResult(employeeResult));
        setDepartments(unwrapApiResult(departmentResult));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "تعذر تحميل ملف الموظف.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [employeeId]);

  async function saveEmployee(input: EmployeeInput) {
    const updated = unwrapApiResult(await updateEmployee(employeeId, input));
    setEmployee(updated);
    toast.success("تم تحديث بيانات الموظف.");
  }

  if (loading) {
    return <section aria-label="جارٍ تحميل ملف الموظف" className="profile-loading" role="status">
      <Skeleton className="profile-hero-skeleton" />
      <Skeleton className="profile-details-skeleton" lines={4} />
    </section>;
  }

  if (error || !employee) {
    return (
      <div className="employee-page-error" role="alert">
        <EmptyState icon={UserRound} title="تعذر تحميل ملف الموظف" description={error ?? "الموظف غير موجود."} />
        <Button icon={<ArrowRight size={16} />} onClick={onBack}>العودة إلى الموظفين</Button>
      </div>
    );
  }

  const tabs = [
    {
      id: "data",
      label: "البيانات",
      content: <EmployeeData employee={employee} />,
    },
    { id: "files", label: "ملف الموظف PDF", content: <EmployeeFilesTab employeeId={employee.id} /> },
    { id: "leaves", label: "الإجازات — قريبًا", content: <ComingSoon title="الإجازات والاستمارات" /> },
    { id: "decisions", label: "القرارات — قريبًا", content: <ComingSoon title="القرارات" /> },
  ];

  return (
    <div className="employee-profile-page">
      <button className="back-link" onClick={onBack} type="button"><ArrowRight size={16} aria-hidden="true" /> الموظفون</button>
      <section className="employee-profile-hero">
        <span aria-hidden="true" className="employee-profile-avatar">{employee.fullName.trim().charAt(0)}</span>
        <div className="employee-profile-identity">
          <p className="eyebrow">ملف الموظف</p>
          <h1>{employee.fullName}</h1>
          <div className="employee-profile-meta">
            <span>{employee.code}</span>
            <span>{employee.departmentName}</span>
            <Badge tone={employee.status === "active" ? "success" : "muted"}>{statusLabel(employee.status)}</Badge>
          </div>
        </div>
        <Button className="profile-edit-button" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>تعديل البيانات</Button>
      </section>

      <Tabs items={tabs} label="تبويبات ملف الموظف" />
      <EmployeeFormModal
        departments={departments}
        employee={employee}
        onClose={() => setEditing(false)}
        onSave={saveEmployee}
        open={editing}
      />
    </div>
  );
}

function EmployeeData({ employee }: { employee: EmployeeRecord }) {
  return (
    <Card className="employee-data-card" title="البيانات الأساسية">
      <dl className="employee-data-grid">
        <DataField icon={UserRound} label="اسم الموظف" value={employee.fullName} />
        <DataField icon={BriefcaseBusiness} label="الكود الوظيفي" value={employee.code} />
        <DataField icon={BriefcaseBusiness} label="القسم" value={employee.departmentName} />
        <DataField icon={CalendarDays} label="تاريخ التعيين" value={formatDate(employee.hireDate)} />
        <DataField icon={BriefcaseBusiness} label="المسمى الوظيفي" value={employee.jobTitle || "غير محدد"} />
      </dl>
    </Card>
  );
}

function DataField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="employee-data-field">
      <dt><Icon aria-hidden="true" size={16} />{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return <EmptyState icon={CalendarDays} title="قريبًا" description={title} />;
}

function formatDate(value: string): string {
  return value.split("-").reverse().join("-");
}

function statusLabel(status: EmployeeRecord["status"]): string {
  if (status === "active") return "نشط";
  if (status === "suspended") return "موقوف";
  if (status === "resigned") return "مستقيل";
  return "منتهي الخدمة";
}