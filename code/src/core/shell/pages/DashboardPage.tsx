import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Clock3, Users,
} from "lucide-react";
import { Badge, Card, StatCard } from "../../../components/ui";

const monthlyLeaves = [
  { month: "يناير", days: 28 },
  { month: "فبراير", days: 35 },
  { month: "مارس", days: 31 },
  { month: "أبريل", days: 38 },
  { month: "مايو", days: 34 },
  { month: "يونيو", days: 48 },
  { month: "يوليو", days: 53 },
  { month: "أغسطس", days: 44 },
  { month: "سبتمبر", days: 37 },
  { month: "أكتوبر", days: 33 },
  { month: "نوفمبر", days: 36 },
  { month: "ديسمبر", days: 30 },
];

const leaveTypes = [
  { name: "اعتيادي", value: 56, color: "var(--accent)" },
  { name: "عارضة", value: 27, color: "var(--gold)" },
  { name: "مرضي", value: 17, color: "var(--success)" },
];

const lowBalances = [
  { name: "موظف تجريبي 1", remaining: 2, progress: 12, tone: "danger" },
  { name: "موظف تجريبي 2", remaining: 3, progress: 18, tone: "warning" },
  { name: "موظف تجريبي 3", remaining: 3, progress: 18, tone: "warning" },
];

const recentRequests = [
  { id: 1, name: "موظف تجريبي 4", leave: "اعتيادي · 3 أيام", date: "10-01-2024", status: "موافق عليه", tone: "success" as const, initials: "م" },
  { id: 2, name: "موظف تجريبي 5", leave: "اعتيادي · 5 أيام", date: "28-03-2024", status: "معلّق", tone: "warning" as const, initials: "م" },
  { id: 3, name: "موظف تجريبي 6", leave: "مرضي · 5 أيام", date: "09-03-2024", status: "موافق عليه", tone: "success" as const, initials: "م" },
  { id: 4, name: "موظف تجريبي 7", leave: "عارضة · يوم", date: "05-02-2024", status: "موافق عليه", tone: "success" as const, initials: "م" },
];

export function DashboardPage() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">نظرة عامة</p>
          <h1>لوحة التحكم</h1>
          <p>ملخص تجريبي لأرصدة الإجازات وحركة الطلبات.</p>
        </div>
        <span className="dashboard-period">بيانات عرض تجريبية</span>
      </div>

      <section aria-label="ملخص الإجازات" className="dashboard-stats">
        <StatCard detail="نشطون حاليًا" icon={Users} label="إجمالي الموظفين" tone="accent" value={128} />
        <StatCard detail="منذ بداية السنة" icon={Clock3} label="أيام مستهلكة" tone="gold" value={342} />
        <StatCard detail="اعتيادي + عارضة" icon={CheckCircle2} label="الرصيد المتبقي" tone="success" value={2916} />
        <StatCard detail="يحتاجون متابعة" icon={AlertTriangle} label="تنبيه أرصدة" tone="warning" value={5} />
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
                  formatter={(value) => [`${value}%`, "النسبة"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div aria-hidden="true" className="donut-center"><strong>342</strong><span>يوم</span></div>
          </div>
          <ul className="chart-legend">
            {leaveTypes.map((item) => (
              <li key={item.name}><span className="legend-dot" style={{ backgroundColor: item.color }} />{item.name}<strong>{item.value}%</strong></li>
            ))}
          </ul>
        </Card>

        <Card className="balance-card" title="أرصدة قربت تخلص">
          <ul className="balance-list">
            {lowBalances.map((item) => (
              <li key={item.name}>
                <div className="balance-row"><span>{item.name}</span><strong className={`balance-number tone-${item.tone}`}>{item.remaining} أيام</strong></div>
                <div
                  aria-label={`رصيد منخفض، المتبقي ${item.remaining} أيام`}
                  className="balance-track"
                  role="meter"
                  aria-valuenow={item.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`${item.remaining} أيام متبقية`}
                >
                  <span className={`balance-fill tone-${item.tone}`} style={{ width: `${item.progress}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card className="recent-card" title="آخر الطلبات">
        <ul className="recent-list">
          {recentRequests.map((request) => (
            <li className="recent-request" key={request.id}>
              <span aria-hidden="true" className={`request-avatar request-avatar-${request.id}`}>{request.initials}</span>
              <span className="request-person"><strong>{request.name}</strong><small>{request.leave}</small></span>
              <time className="request-date">{request.date}</time>
              <Badge tone={request.tone}>{request.status}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}