import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarPlus, Clock } from "lucide-react";
import { Button, Card, EmptyState, Input, Select, Skeleton, toast } from "../../../components/ui";
import type { EmployeeRecord, LeaveBalanceSummary, LeaveRequestInput } from "../../../core/api/contracts";
import {
  createLeaveRequest, getEmployeeLeaveSummary, listEmployees, unwrapApiResult,
} from "../../../core/api/ipcClient";
import { LeaveTypeBadge } from "../components/LeaveTypeBadge";

interface LeaveRequestPageProps {
  onNavigate(path: string): void;
}

interface EmployeeLeaveState {
  employee: EmployeeRecord;
  balances: LeaveBalanceSummary[];
}

function summarizeDays(start: string, end: string): number {
  if (!start || !end) return 0;
  if (end < start) return 0;
  const startMs = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)));
  const endMs = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)));
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

export function LeaveRequestPage({ onNavigate }: LeaveRequestPageProps) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveState, setLeaveState] = useState<EmployeeLeaveState | null>(null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadEmployees() {
      setLoading(true);
      setError(null);
      try {
        const result = unwrapApiResult(await listEmployees({ search: "", departmentId: null }));
        if (!active) return;
        setEmployees(result);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "تعذر تحميل بيانات الموظفين.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadEmployees();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      if (!employeeId) {
        setLeaveState(null);
        return;
      }
      try {
        const summary = unwrapApiResult(await getEmployeeLeaveSummary(Number(employeeId)));
        const employee = employees.find((item) => item.id === Number(employeeId));
        if (!active) return;
        if (employee) setLeaveState({ employee, balances: summary.balances });
      } catch (summaryError) {
        if (!active) return;
        setLeaveState(null);
        setError(summaryError instanceof Error ? summaryError.message : "تعذر تحميل أرصدة الإجازات.");
      }
    }
    void loadSummary();
    return () => { active = false; };
  }, [employeeId, employees]);

  const activeBalances = useMemo(() => (leaveState?.balances ?? []), [leaveState]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId || !leaveTypeId || !startDate || !endDate) return;
    setSubmitting(true);
    try {
      const input: LeaveRequestInput = {
        employeeId: Number(employeeId),
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate,
        reason: reason.trim() || undefined,
        overrideReason: overrideReason.trim() || undefined,
      };
      unwrapApiResult(await createLeaveRequest(input));
      toast.success("تم إنشاء طلب الإجازة بنجاح.");
      onNavigate("/leaves");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "تعذر إنشاء طلب الإجازة.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section aria-label="جارٍ تحميل نموذج طلب الإجازة" className="leave-form-loading" role="status">
        <Skeleton className="leave-form-skeleton" lines={5} />
      </section>
    );
  }

  if (error) {
    return (
      <div className="leave-page-error" role="alert">
        <EmptyState icon={CalendarPlus} title="تعذر تحميل البيانات" description={error} />
        <Button icon={<ArrowRight size={16} />} onClick={() => onNavigate("/leaves")}>العودة إلى سجل الإجازات</Button>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="leave-page-error">
        <EmptyState
          description="يجب إضافة موظفين أولًا قبل إنشاء طلب إجازة."
          icon={CalendarPlus}
          title="لا يوجد موظفون"
        />
        <Button icon={<ArrowRight size={16} />} onClick={() => onNavigate("/employees")}>إدارة الموظفين</Button>
      </div>
    );
  }

  const dayCount = summarizeDays(startDate, endDate);
  const selectedBalance = activeBalances.find((balance) => balance.leaveTypeId === Number(leaveTypeId));

  return (
    <div className="leave-request-page">
      <button className="back-link" onClick={() => onNavigate("/leaves")} type="button">
        <ArrowRight size={16} aria-hidden="true" /> سجل الإجازات
      </button>
      <div className="page-heading leave-heading">
        <div>
          <p className="eyebrow">وحدة الإجازات</p>
          <h1>طلب إجازة جديد</h1>
          <p>اختر الموظف ونوع الإجازة وحدد فترة الطلب. تُحسب الأيام الفعلية عند الاعتماد.</p>
        </div>
      </div>

      <div className="leave-request-grid">
        <Card className="leave-form-card" title="بيانات الطلب">
          <form className="leave-form" noValidate onSubmit={submit}>
            <label className="leave-field">
              <span>الموظف <span aria-hidden="true" className="required-marker"> *</span></span>
              <Select
                onChange={(event) => { setEmployeeId(event.target.value); setLeaveTypeId(""); }}
                options={[
                  { label: "اختر الموظف", value: "" },
                  ...employees.map((employee) => ({ label: `${employee.fullName} — ${employee.code}`, value: String(employee.id) })),
                ]}
                value={employeeId}
              />
            </label>

            <label className="leave-field">
              <span>نوع الإجازة <span aria-hidden="true" className="required-marker"> *</span></span>
              <Select
                disabled={!employeeId}
                onChange={(event) => setLeaveTypeId(event.target.value)}
                options={[
                  { label: employeeId ? "اختر النوع" : "اختر الموظف أولًا", value: "" },
                  ...activeBalances.map((balance) => ({ label: balance.leaveTypeName, value: String(balance.leaveTypeId) })),
                ]}
                value={leaveTypeId}
              />
            </label>

            <div className="leave-date-row">
              <label className="leave-field">
                <span>من تاريخ <span aria-hidden="true" className="required-marker"> *</span></span>
                <Input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
              </label>
              <label className="leave-field">
                <span>إلى تاريخ <span aria-hidden="true" className="required-marker"> *</span></span>
                <Input onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
              </label>
            </div>

            {dayCount > 0 && (
              <p className="leave-days-hint" role="status">
                <Clock size={15} aria-hidden="true" /> عدد الأيام التقريبي: <strong>{dayCount}</strong> يومًا
                <span className="leave-days-note"> (العدد النهائي يستبعد العطلات الأسبوعية والرسمية عند الاعتماد)</span>
              </p>
            )}

            <label className="leave-field">
              <span>السبب</span>
              <Input
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="سبب الإجازة (اختياري)"
                value={reason}
              />
            </label>

            {selectedBalance && dayCount > selectedBalance.remaining && selectedBalance.remaining >= 0 && (
              <label className="leave-field leave-override-field">
                <span>سبب تجاوز الرصيد (الرصيد المتبقي {selectedBalance.remaining} يوم)</span>
                <Input
                  maxLength={500}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="يلزم سبب موثق لتجاوز الرصيد المتاح"
                  value={overrideReason}
                />
              </label>
            )}

            <div className="ui-dialog-actions">
              <Button onClick={() => onNavigate("/leaves")} type="button">إلغاء</Button>
              <Button
                disabled={submitting || !employeeId || !leaveTypeId || !startDate || !endDate}
                icon={<CalendarPlus size={16} />}
                type="submit"
                variant="primary"
              >
                {submitting ? "جارٍ الإرسال..." : "إنشاء الطلب"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="leave-balance-card" title="الرصيد الحالي">
          {leaveState ? (
            <ul className="leave-balance-list">
              {activeBalances.map((balance) => (
                <li key={balance.leaveTypeId}>
                  <div className="leave-balance-row">
                    <LeaveTypeBadge leaveTypeKey={balance.leaveTypeKey}>{balance.leaveTypeName}</LeaveTypeBadge>
                    <strong className="leave-balance-number">{balance.remaining}</strong>
                  </div>
                  <div className="leave-balance-meta">
                    <span>المستحق: {balance.entitlement}</span>
                    <span>المستخدم: {balance.used}</span>
                    <span>المعلّق: {balance.pending}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState description="اختر موظفًا لعرض أرصدته." icon={Clock} title="لا يوجد رصيد معروض" />
          )}
        </Card>
      </div>
    </div>
  );
}
