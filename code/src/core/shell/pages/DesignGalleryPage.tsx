import { useState } from "react";
import { Bell, Check, FileText, Search } from "lucide-react";
import {
  Badge, Button, Card, ConfirmDialog, DataTable, Drawer, EmptyState,
  IconButton, Input, Modal, Select, Skeleton, StatCard, Tabs, toast,
} from "../../../components/ui";
import type { DataColumn } from "../../../components/ui";

interface DemoRow {
  id: number;
  name: string;
  department: string;
  status: string;
}

const demoRows: DemoRow[] = [
  { id: 1, name: "موظف تجريبي", department: "الشؤون الإدارية", status: "نشط" },
  { id: 2, name: "موظفة تجريبية", department: "الموارد البشرية", status: "معلق" },
];

const demoColumns: DataColumn<DemoRow>[] = [
  { key: "name", label: "الاسم" },
  { key: "department", label: "القسم" },
  { key: "status", label: "الحالة", render: (row: DemoRow) => <Badge tone={row.status === "نشط" ? "success" : "warning"}>{row.status}</Badge> },
];

export function DesignGalleryPage() {
  return (
    <div className="design-gallery-page">
      <div className="page-heading">
        <p className="eyebrow">مرجع داخلي</p>
        <h1>معرض المكونات</h1>
        <p>معاينة عناصر الواجهة في الوضعين الفاتح والداكن.</p>
      </div>
      <div className="gallery-theme-grid">
        <ThemeGallery theme="light" title="Light" />
        <ThemeGallery theme="dark" title="Dark" />
      </div>
    </div>
  );
}

function ThemeGallery({ theme, title }: { theme: "light" | "dark"; title: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <section className="theme-preview" data-bs-theme={theme}>
      <header className="gallery-preview-heading"><h2>{title}</h2><span>{theme === "light" ? "فاتح" : "داكن"}</span></header>
      <div className="gallery-samples">
        <StatCard detail="عرض توضيحي" icon={Check} label="الرصيد المتبقي" tone="success" value={18} />
        <Card title="الأزرار والحالات">
          <div className="gallery-inline">
            <Button icon={<Check size={16} />} variant="primary">حفظ</Button>
            <Button variant="secondary">ثانوي</Button>
            <Button variant="danger">حذف</Button>
            <IconButton label="إشعارات"><Bell size={18} /></IconButton>
          </div>
          <div className="gallery-inline gallery-badges">
            <Badge tone="success">موافق</Badge><Badge tone="warning">معلق</Badge>
            <Badge tone="danger">مرفوض</Badge><Badge tone="accent">جديد</Badge>
          </div>
        </Card>
        <Card title="الحقول">
          <label className="gallery-field">بحث<Input placeholder="اسم أو كود" startAdornment={<Search size={16} />} /></label>
          <label className="gallery-field">القسم<Select defaultValue="all" options={[{ label: "كل الأقسام", value: "all" }, { label: "الموارد البشرية", value: "hr" }]} /></label>
        </Card>
        <Card title="التبويبات">
          <Tabs label="عينة التبويبات" items={[
            { id: `${theme}-overview`, label: "نظرة عامة", content: <p>محتوى تجريبي للتبويب.</p> },
            { id: `${theme}-details`, label: "التفاصيل", content: <p>تفاصيل تجريبية.</p> },
          ]} />
        </Card>
        <Card title="الجدول">
          <DataTable columns={demoColumns} rows={demoRows} />
        </Card>
        <Card title="الحالات">
          <div className="gallery-state-grid">
            <div><span>تحميل</span><Skeleton className="gallery-skeleton" lines={2} /></div>
            <div><span>فراغ</span><EmptyState icon={FileText} title="لا توجد ملفات" description="ستظهر العناصر هنا." /></div>
          </div>
        </Card>
        <Card title="الحوارات والتنبيهات">
          <div className="gallery-inline">
            <Button onClick={() => setModalOpen(true)}>نافذة</Button>
            <Button onClick={() => setDrawerOpen(true)}>درج</Button>
            <Button onClick={() => setConfirmOpen(true)}>تأكيد</Button>
            <Button onClick={() => toast.success("تم عرض إشعار تجريبي.")}>Toast</Button>
          </div>
        </Card>
      </div>
      <Modal open={modalOpen} onOpenChange={setModalOpen} title="نافذة تجريبية">
        <p>هذا محتوى تجريبي لنافذة الحوار.</p>
      </Modal>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="درج جانبي">
        <p>محتوى تجريبي للدرج.</p>
      </Drawer>
      <ConfirmDialog
        message="هذا تأكيد تجريبي ولا يغيّر بيانات التطبيق."
        onConfirm={() => toast.info("تم التأكيد التجريبي.")}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="تأكيد الإجراء"
      />
    </section>
  );
}