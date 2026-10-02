import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Clock3, Users,
} from "lucide-react";
import { Badge, Card, EmptyState, StatCard } from "../../../components/ui";
import { getAppSummary, getLowBalances, listLeaveRequests, unwrapApiResult } from "../../api/ipcClient";
import type { LeaveRequestRecord, LowBalanceAlert } from "../../api/contracts";

const monthNames = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const statusLabels: Record<string, string> = {
  pending: "معلّق",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const statusTones: Record<string, "success" | "warning" | "danger" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "muted",
};

function formatDate(value: string): string {
  return value.split("-").reverse().join("-");
}

export function DashboardPage() {
  const reducedMotion = useReducedMotion();
  const [employeeCount, setEmployeeCount] = useState(0);
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [lowBalances, setLowBalances] = useState<LowBalanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const [summary, leaveResult, lowBalanceResult] = await Promise.all([
          getAppSummary(),
          listLeaveRequests(),
          getLowBalances(),
        ]);
        if (!active) return;
        setEmployeeCount(unwrapApiResult(summary).employeeCount);
        setRequests(unwrapApiResult(leaveResult));
        setLowBalances(unwrapApiResult(lowBalanceResult));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "تعذر تحميل لوحة التحكم.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, []);

  const year = new Date().getFullYear();
  const yearRequests = useMemo(
    () => requests.filter((request) => request.startDate.slice(0, 4) === String(year)),
    [requests, year],
  );

  const pendingCount = useMemo(
    () => yearRequests.filter((request) => request.status === "pending").length,
    [yearRequests],
  );
  const usedDays = useMemo(
    () => yearRequests.filter((request) => request.status === "approved").reduce((sum, request) => sum + request.days, 0),
    [yearRequests],
  );

  const monthlyLeaves = useMemo(() => {
    const buckets = monthNames.map((month) => ({ month, days: 0 }));
    for (const request of yearRequests) {
      if (request.status !== "approved") continue;
      const monthIndex = Number(request.startDate.slice(5, 7)) - 1;
      if (monthIndex >= 0 && monthIndex < 12) buckets[monthIndex].days += request.days;
    }
    return buckets;
  }, [yearRequests]);

  const leaveTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of yearRequests) {
      if (request.status !== "approved") continue;
      counts.set(request.leaveTypeName, (counts.get(request.leaveTypeName) ?? 0) + request.days);
    }
    return Array.from(counts, ([name, value]) => ({ name, value, color: "var(--accent)" }));
  }, [yearRequests]);

  const recentRequests = useMemo(() => [...requests].slice(0, 6), [requests]);

  if (loading) {
    return (
      <div aria-label="جارٍ تحميل لوحة التحكم" className="dashboard-page" role="status">
        <div className="page-heading dashboard-heading">
          <div>
            <p className="eyebrow">نظرة عامة</p>
            <h1>لوحة التحكم</h1>
            <p>جارٍ تحميل ملخص الإجازات وحركة الطلبات.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="leave-page-error" role="alert">
          <EmptyState description={error} icon={AlertTriangle} title="تعذر تحميل لوحة التحكم" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">نظرة عامة</p>
          <h1>لوحة التحكم</h1>
          <p>ملخص أرصدة الإجازات وحركة الطلبات للسنة الحالية.</p>
        </div>
        <span className="dashboard-period">سنة {year}</span>
      </div>

      <section aria-label="ملخص الإجازات" className="dashboard-stats">
        <StatCard detail="نشطون حاليًا" icon={Users} label="إجمالي الموظفين" tone="accent" value={employeeCount} />
        <StatCard detail="معتمدة هذا العام" icon={Clock3} label="أيام مستهلكة" tone="gold" value={usedDays} />
        <StatCard detail="في انتظار البت" icon={CheckCircle2} label="طلبات معلّقة" tone="success" value={pendingCount} />
        <StatCard detail="أرصدة منخفضة" icon={AlertTriangle} label="تنبيه أرصدة" tone="warning" value={lowBalances.length} />
      </section>

      <section aria-label="تحليلات الإجازات" className="dashboard-analytics">
        <Card className="chart-card monthly-chart" title="الإجازات حسب الشهر">
          <div className="chart-frame chart-frame-monthly">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyLeaves} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis axisLine={false} dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
                  cursor={{ fill: "var(--accent-soft)" }}
                  formatter={(value) => [`${value} يوم`, "الإجازات"]}
                />
                <Bar
                  animationDuration={250}
                  dataKey="days"
                  fill="var(--accent)"
                  isAnimationActive={!reducedMotion}
                  maxBarSize={30}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="chart-card type-chart" title="حسب النوع">
          <div className="chart-frame chart-frame-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  animationDuration={250}
                  data={leaveTypes}
                  dataKey="value"
                  innerRadius="62%"
                  isAnimationActive={!reducedMotion}
                  outerRadius="82%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {leaveTypes.map((item) => <Cell fill={item.color} key={item.name} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
                  formatter={(value) => [`${value} يوم`, "الأيام"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div aria-hidden="true" className="donut-center"><strong>{usedDays}</strong><span>يوم</span></div>
          </div>
          {leaveTypes.length > 0 ? (
            <ul className="chart-legend">
              {leaveTypes.map((item) => (
                <li key={item.name}><span className="legend-dot" style={{ backgroundColor: item.color }} />{item.name}<strong>{item.value}</strong></li>
              ))}
            </ul>
          ) : (
            <p className="chart-empty-note">لا توجد إجازات معتمدة هذا العام بعد.</p>
          )}
        </Card>

        <Card className="balance-card" title="أرصدة قربت تخلص">
          {lowBalances.length > 0 ? (
            <ul className="balance-alert-list">
              {lowBalances.map((alert) => (
                <li key={alert.employeeId} className="balance-alert-item">
                  <span className="balance-alert-code">{alert.employeeCode}</span>
                  <span className="balance-alert-name">{alert.employeeFullName}</span>
                  <span className="balance-alert-status">
                    {alert.remaining} / {alert.entitlement} متبقي
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState description="جميع الأرصدة في حدها الأدنى." icon={CheckCircle2} title="بلا تنبيهات" />
          )}
        </Card>
      </section>

      <Card className="recent-card" title="آخر الطلبات">
        {recentRequests.length > 0 ? (
          <ul className="recent-list">
            {recentRequests.map((request) => (
              <li className="recent-request" key={request.id}>
                <span aria-hidden="true" className="request-avatar">
                  {request.employeeFullName.trim().charAt(0)}
                </span>
                <span className="request-person">
                  <strong>{request.employeeFullName}</strong>
                  <small>{request.leaveTypeName} · {request.days} أيام</small>
                </span>
                <time className="request-date">{formatDate(request.startDate)}</time>
                <Badge tone={statusTones[request.status]}>{statusLabels[request.status]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description="ستظهر طلبات الإجازات هنا عند إنشائها." icon={CheckCircle2} title="لا توجد طلبات بعد" />
        )}
      </Card>
    </div>
  );
}