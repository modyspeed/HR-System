import { useEffect, useState } from "react";
import { Building2, Pencil, Plus, RefreshCw, UserRoundX, UsersRound } from "lucide-react";
import {
  Button, ConfirmDialog, DataTable, EmptyState, IconButton, Input, Modal, Select, toast,
} from "../../../components/ui";
import type { DataColumn } from "../../../components/ui";
import {
  createEmployee, createDepartment, getEmployeeLeaveSummary, listDepartments, listEmployees,
  scanAllEmployeeFiles, setEmployeeStatus, updateEmployee, unwrapApiResult,
} from "../../../core/api/ipcClient";
import type { DepartmentRecord, EmployeeInput, EmployeeRecord, ScanAllResult } from "../../../core/api/contracts";
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
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<ScanAllResult | null>(null);

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

  const balances = useEmployeeBalances(employees, reloadKey);

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
    {
      key: "annualEntitlement",
      label: "اعتيادي",
      render: (employee) => formatBalance(balances.get(employee.id)?.annualRemaining ?? null),
    },
    {
      key: "casualEntitlement",
      label: "عارضة",
      render: (employee) => formatBalance(balances.get(employee.id)?.casualRemaining ?? null),
    },
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

  async function syncFiles() {
    setSyncing(true);
    try {
      const result = unwrapApiResult(await scanAllEmployeeFiles());
      setSyncResult(result);
      setReloadKey((key) => key + 1);
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : "تعذر مزامنة الملفات.");
    } finally {
      setSyncing(false);
    }
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
          <Button disabled={syncing} icon={<RefreshCw size={17} />} onClick={() => void syncFiles()}>مزامنة الملفات</Button>
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
      <Modal
        onOpenChange={(open) => { if (!open) setSyncResult(null); }}
        open={syncResult !== null}
        title="نتيجة مزامنة الملفات"
      >
        {syncResult && (
          <div className="files-sync-result">
            <p className="files-sync-summary">
              تم مسح <strong>{syncResult.scannedEmployees}</strong> موظف، وإضافة
              <strong> {syncResult.added}</strong> ملف.
            </p>
            {syncResult.unknownFolders.length > 0 ? (
              <div className="files-sync-unknown">
                <h3>فولدرات غير معروفة</h3>
                <p>هذه الفولدرات لا تطابق أي كود موظف:</p>
                <ul>
                  {syncResult.unknownFolders.map((folder) => <li key={folder}>{folder}</li>)}
                </ul>
              </div>
            ) : (
              <p className="files-sync-clean">لا توجد فولدرات غير معروفة.</p>
            )}
            <div className="ui-dialog-actions">
              <Button onClick={() => setSyncResult(null)} variant="primary">حسنًا</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function formatDate(value: string): string {
  return value.split("-").reverse().join("-");
}

function formatBalance(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

interface EmployeeBalanceMap {
  annualRemaining: number | null;
  casualRemaining: number | null;
}

function useEmployeeBalances(
  employees: EmployeeRecord[],
  reloadKey: number,
): Map<number, EmployeeBalanceMap> {
  const [balances, setBalances] = useState<Map<number, EmployeeBalanceMap>>(new Map());

  useEffect(() => {
    let active = true;
    async function loadBalances() {
      if (employees.length === 0) {
        setBalances(new Map());
        return;
      }
      try {
        const entries = await Promise.all(
          employees.map(async (employee) => {
            const result = unwrapApiResult(await getEmployeeLeaveSummary(employee.id));
            const annual = result.balances.find((balance) => balance.leaveTypeKey === "annual");
            const casual = result.balances.find((balance) => balance.leaveTypeKey === "casual");
            return [
              employee.id,
              {
                annualRemaining: annual ? annual.remaining : null,
                casualRemaining: casual ? casual.remaining : null,
              },
            ] as const;
          }),
        );
        if (active) setBalances(new Map(entries));
      } catch {
        if (active) setBalances(new Map());
      }
    }
    void loadBalances();
    return () => { active = false; };
  }, [employees, reloadKey]);

  return balances;
}