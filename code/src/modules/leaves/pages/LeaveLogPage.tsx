import { useEffect, useState } from "react";
import { Ban, CalendarDays, Check, CalendarPlus, X } from "lucide-react";
import {
  Badge, Button, ConfirmDialog, DataTable, EmptyState, IconButton, Input, Select, toast,
} from "../../../components/ui";
import type { DataColumn } from "../../../components/ui";
import type { LeaveRequestRecord, LeaveRequestStatus } from "../../../core/api/contracts";
import {
  cancelLeaveRequest, decideLeaveRequest, listLeaveRequests, unwrapApiResult,
} from "../../../core/api/ipcClient";
import { LeaveTypeBadge } from "../components/LeaveTypeBadge";

interface LeaveLogPageProps {
  onNavigate(path: string): void;
}

const statusLabels: Record<LeaveRequestStatus, string> = {
  pending: "معلّق",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const statusTones: Record<LeaveRequestStatus, "success" | "warning" | "danger" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "muted",
};

function formatDate(value: string): string {
  return value.split("-").reverse().join("-");
}

export function LeaveLogPage({ onNavigate }: LeaveLogPageProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeaveRequestStatus | "all">("all");
  const [leaveTypeKey, setLeaveTypeKey] = useState("");
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [requestToCancel, setRequestToCancel] = useState<LeaveRequestRecord | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadRequests() {
      setLoading(true);
      setError(null);
      try {
        const result = unwrapApiResult(await listLeaveRequests({
          search,
          status,
          leaveTypeKey: leaveTypeKey || undefined,
        }));
        if (!active) return;
        setRequests(result);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "تعذر تحميل سجل الإجازات.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadRequests();
    return () => { active = false; };
  }, [leaveTypeKey, reloadKey, search, status]);

  const knownTypeKeys = Array.from(new Set(requests.map((request) => request.leaveTypeKey)));

  async function decide(request: LeaveRequestRecord, decision: "approved" | "rejected") {
    setBusyRequestId(request.id);
    try {
      unwrapApiResult(await decideLeaveRequest({ requestId: request.id, decision }));
      toast.success(decision === "approved" ? "تم اعتماد طلب الإجازة." : "تم رفض طلب الإجازة.");
      setReloadKey((key) => key + 1);
    } catch (decideError) {
      toast.error(decideError instanceof Error ? decideError.message : "تعذر اتخاذ القرار.");
    } finally {
      setBusyRequestId(null);
    }
  }

  async function cancel() {
    if (!requestToCancel) return;
    setBusyRequestId(requestToCancel.id);
    try {
      unwrapApiResult(await cancelLeaveRequest(requestToCancel.id));
      toast.success("تم إلغاء طلب الإجازة وإرجاع الرصيد.");
      setRequestToCancel(null);
      setReloadKey((key) => key + 1);
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "تعذر إلغاء الطلب.");
    } finally {
      setBusyRequestId(null);
    }
  }

  const columns: DataColumn<LeaveRequestRecord>[] = [
    {
      key: "employeeFullName",
      label: "الموظف",
      render: (request) => (
        <span className="leave-employee-cell">
          <span aria-hidden="true" className="leave-table-avatar">
            {request.employeeFullName.trim().charAt(0)}
          </span>
          <span><strong>{request.employeeFullName}</strong><small>{request.employeeCode}</small></span>
        </span>
      ),
    },
    {
      key: "leaveTypeName",
      label: "النوع",
      render: (request) => <LeaveTypeBadge leaveTypeKey={request.leaveTypeKey}>{request.leaveTypeName}</LeaveTypeBadge>,
    },
    { key: "startDate", label: "من", render: (request) => formatDate(request.startDate) },
    { key: "endDate", label: "إلى", render: (request) => formatDate(request.endDate) },
    { key: "days", label: "الأيام" },
    {
      key: "status",
      label: "الحالة",
      render: (request) => <Badge tone={statusTones[request.status]}>{statusLabels[request.status]}</Badge>,
    },
    {
      key: "id",
      label: "إجراءات",
      render: (request) => (
        <span className="leave-row-actions">
          {request.status === "pending" && (
            <>
              <IconButton
                aria-label={`اعتماد طلب ${request.employeeFullName}`}
                disabled={busyRequestId === request.id}
                label="اعتماد"
                onClick={() => decide(request, "approved")}
              >
                <Check aria-hidden="true" size={16} />
              </IconButton>
              <IconButton
                aria-label={`رفض طلب ${request.employeeFullName}`}
                disabled={busyRequestId === request.id}
                label="رفض"
                onClick={() => decide(request, "rejected")}
              >
                <X aria-hidden="true" size={16} />
              </IconButton>
            </>
          )}
          {request.status === "approved" && (
            <IconButton
              aria-label={`إلغاء طلب ${request.employeeFullName}`}
              disabled={busyRequestId === request.id}
              label="إلغاء"
              onClick={() => setRequestToCancel(request)}
            >
              <Ban aria-hidden="true" size={16} />
            </IconButton>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="leaves-page">
      <div className="page-heading leaves-heading">
        <div>
          <p className="eyebrow">وحدة الإجازات</p>
          <h1>سجل الإجازات</h1>
          <p>استعراض طلبات الإجازات واعتمادها أو رفضها أو إلغائها.</p>
        </div>
        <Button icon={<CalendarPlus size={17} />} onClick={() => onNavigate("/leaves/new")} variant="primary">
          طلب إجازة جديد
        </Button>
      </div>

      <section aria-label="بحث سجل الإجازات" className="leaves-toolbar">
        <label className="leaves-search-field">
          <span>بحث بالاسم أو الكود</span>
          <Input onChange={(event) => setSearch(event.target.value)} placeholder="اكتب الاسم أو الكود" value={search} />
        </label>
        <label className="leaves-filter-field">
          <span>النوع</span>
          <Select
            onChange={(event) => setLeaveTypeKey(event.target.value)}
            options={[
              { label: "كل الأنواع", value: "" },
              ...knownTypeKeys.map((key) => ({ label: key, value: key })),
            ]}
            value={leaveTypeKey}
          />
        </label>
        <label className="leaves-filter-field">
          <span>الحالة</span>
          <Select
            onChange={(event) => setStatus(event.target.value as LeaveRequestStatus | "all")}
            options={[
              { label: "كل الحالات", value: "all" },
              { label: "معلّق", value: "pending" },
              { label: "موافق عليه", value: "approved" },
              { label: "مرفوض", value: "rejected" },
              { label: "ملغي", value: "cancelled" },
            ]}
            value={status}
          />
        </label>
      </section>

      {error ? (
        <div className="leave-page-error" role="alert">
          <EmptyState icon={CalendarDays} title="تعذر تحميل السجل" description={error} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          emptyDescription="يمكنك إنشاء أول طلب إجازة للبدء."
          emptyTitle="لا توجد طلبات إجازات"
          loading={loading}
          rows={requests}
        />
      )}

      <ConfirmDialog
        confirmLabel="إلغاء الطلب"
        message={requestToCancel
          ? `سيتم إلغاء طلب ${requestToCancel.employeeFullName} وإرجاع ${requestToCancel.days} يومًا إلى رصيده.`
          : "سيتم إلغاء الطلب وإرجاع الرصيد."}
        onConfirm={() => void cancel()}
        onOpenChange={(open) => { if (!open) setRequestToCancel(null); }}
        open={requestToCancel !== null}
        title="تأكيد إلغاء طلب الإجازة"
      />
    </div>
  );
}
