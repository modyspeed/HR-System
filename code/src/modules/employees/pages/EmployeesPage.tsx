import { useEffect, useState } from "react";
import { Building2, Pencil, Plus, UserRoundX, UsersRound } from "lucide-react";
import {
  Button, ConfirmDialog, DataTable, EmptyState, IconButton, Input, Select, toast,
} from "../../../components/ui";
import type { DataColumn } from "../../../components/ui";
import {
  createEmployee, createDepartment, listDepartments, listEmployees,
  setEmployeeStatus, updateEmployee, unwrapApiResult,
} from "../../../core/api/ipcClient";
import type { DepartmentRecord, EmployeeInput, EmployeeRecord } from "../../../core/api/contracts";
import { EmployeeFormModal } from "../components/EmployeeFormModal";
import { DepartmentFormModal } from "../components/DepartmentFormModal";

interface EmployeesPageProps {
  onOpenEmployee(id: number): void;
}

export function EmployeesPage({ onOpenEmployee }: EmployeesPageProps) {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const [departmentFormOpen, setDepartmentFormOpen] = useState(false);
  const [employeeToSuspend, setEmployeeToSuspend] = useState<EmployeeRecord | null>(null);

  useEffect(() => {
    let active = true;
    async function loadEmployees() {
      setLoading(true);
      setError(null);
      try {
        const [employeeResult, departmentResult] = await Promise.all([
          listEmployees({ search, departmentId: departmentId ? Number(departmentId) : null }),
          listDepartments(),
        ]);
        if (!active) return;
        setEmployees(unwrapApiResult(employeeResult));
        setDepartments(unwrapApiResult(departmentResult));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "تعذر تحميل بيانات الموظفين.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadEmployees();

    return () => {
      active = false;
    };
  }, [departmentId, reloadKey, search]);

  async function saveEmployee(input: EmployeeInput) {
    if (editingEmployee) {
      unwrapApiResult(await updateEmployee(editingEmployee.id, input));
      toast.success("تم تحديث بيانات الموظف.");
    } else {
      unwrapApiResult(await createEmployee(input));
      toast.success("تمت إضافة الموظف.");
    }
    setReloadKey((key) => key + 1);
  }

  async function saveDepartment(name: string) {
    unwrapApiResult(await createDepartment(name));
    toast.success("تمت إضافة القسم.");
    setReloadKey((key) => key + 1);
  }

  async function suspendEmployee() {
    if (!employeeToSuspend) return;
    try {
      unwrapApiResult(await setEmployeeStatus(employeeToSuspend.id, "suspended"));
      toast.success("تم إيقاف الموظف.");
      setEmployeeToSuspend(null);
      setReloadKey((key) => key + 1);
    } catch (statusError) {
      toast.error(statusError instanceof Error ? statusError.message : "تعذر تغيير حالة الموظف.");
    }
  }

  const columns: DataColumn<EmployeeRecord>[] = [
    {
      key: "fullName",
      label: "الموظف",
      render: (employee) => (
        <button className="employee-name-link" onClick={() => onOpenEmployee(employee.id)} type="button">
          <span aria-hidden="true" className="employee-table-avatar">{employee.fullName.trim().charAt(0)}</span>
          <span>{employee.fullName}</span>
        </button>
      ),
    },
    { key: "code", label: "الكود" },
    { key: "departmentName", label: "القسم" },
    { key: "hireDate", label: "تاريخ التعيين", render: (employee) => formatDate(employee.hireDate) },
    { key: "annualEntitlement", label: "اعتيادي", render: (employee) => formatEntitlement(employee.annualEntitlement) },
    { key: "casualEntitlement", label: "عارضة", render: (employee) => formatEntitlement(employee.casualEntitlement) },
    {
      key: "id",
      label: "إجراءات",
      render: (employee) => (
        <span className="employee-row-actions">
          <IconButton label={`تعديل ${employee.fullName}`} onClick={() => openEdit(employee)}>
            <Pencil aria-hidden="true" size={16} />
          </IconButton>
          <IconButton label={`إيقاف ${employee.fullName}`} onClick={() => setEmployeeToSuspend(employee)}>
            <UserRoundX aria-hidden="true" size={17} />
          </IconButton>
        </span>
      ),
    },
  ];

  function openCreate() {
    setEditingEmployee(null);
    setFormOpen(true);
  }

  function openEdit(employee: EmployeeRecord) {
    setEditingEmployee(employee);
    setFormOpen(true);
  }

  return (
    <div className="employees-page">
      <div className="page-heading employees-heading">
        <div>
          <p className="eyebrow">وحدة الموظفين</p>
          <h1>الموظفون</h1>
          <p>إدارة بيانات الموظفين والأقسام.</p>
        </div>
        <div className="employees-heading-actions">
          <Button icon={<Building2 size={17} />} onClick={() => setDepartmentFormOpen(true)}>إضافة قسم</Button>
          <Button icon={<Plus size={17} />} onClick={openCreate} variant="primary">موظف جديد</Button>
        </div>
      </div>

      <section aria-label="بحث الموظفين" className="employee-toolbar">
        <label className="employee-search-field">
          <span>بحث بالاسم أو الكود</span>
          <Input onChange={(event) => setSearch(event.target.value)} placeholder="اكتب الاسم أو الكود" value={search} />
        </label>
        <label className="employee-department-field">
          <span>القسم</span>
          <Select
            onChange={(event) => setDepartmentId(event.target.value)}
            options={[
              { label: "كل الأقسام", value: "" },
              ...departments.map((department) => ({ label: department.name, value: String(department.id) })),
            ]}
            value={departmentId}
          />
        </label>
        <span className="employee-result-count"><UsersRound aria-hidden="true" size={16} /> {employees.length} موظف</span>
      </section>

      {error ? (
        <div className="employee-page-error" role="alert">
          <EmptyState icon={UsersRound} title="تعذر تحميل الموظفين" description={error} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          emptyDescription="يمكنك إضافة أول موظف للبدء."
          emptyTitle="لا يوجد موظفون"
          loading={loading}
          rows={employees}
        />
      )}

      <EmployeeFormModal
        departments={departments}
        employee={editingEmployee}
        onClose={() => setFormOpen(false)}
        onSave={saveEmployee}
        open={formOpen}
      />
      <DepartmentFormModal
        onClose={() => setDepartmentFormOpen(false)}
        onSave={saveDepartment}
        open={departmentFormOpen}
      />
      <ConfirmDialog
        confirmLabel="إيقاف الموظف"
        message={employeeToSuspend ? `سيتم تغيير حالة ${employeeToSuspend.fullName} إلى موقوف. لن تُحذف بياناته.` : "سيتم إيقاف الموظف دون حذف بياناته."}
        onConfirm={() => void suspendEmployee()}
        onOpenChange={(open) => {
          if (!open) setEmployeeToSuspend(null);
        }}
        open={employeeToSuspend !== null}
        title="تأكيد إيقاف الموظف"
      />
    </div>
  );
}

function formatDate(value: string): string {
  return value.split("-").reverse().join("-");
}

function formatEntitlement(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}