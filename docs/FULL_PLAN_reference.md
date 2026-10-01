> ملحوظة: الملف ده النسخة الأولى. التصميم والمعمارية والتقنيات المحدثة في DESIGN_SYSTEM.md و ARCHITECTURE_MODULES.md و SPEC_COMPACT.md و DECISIONS.md (D10-D17) وهي الأولى بالاتباع عند أي اختلاف.

# LeaveDesk — نظام إدارة الموظفين وأرصدة الإجازات (ديسكتوب + قاعدة بيانات محلية)

## 0. الهدف
برنامج ديسكتوب يشتغل أوفلاين على جهاز واحد، بقاعدة بيانات محلية، يعمل:
1. إدارة الموظفين (إضافة / تعديل / استيراد من Excel أو PDF).
2. حساب أرصدة الإجازات (اعتيادي / عارضة / مرضي / بدون مرتب) أوتوماتيك.
3. طلبات الإجازة مع رفع الاستمارة (PDF أو صورة).
4. ربط كل موظف بفولدر ملفاته (PDF) باسم رقم الموظف، وتصفح الملف من داخل البرنامج.
5. تسجيل القرارات المتعلقة بالموظف مع المرفق.
6. تقارير وتصدير Excel + نسخ احتياطي.

الواجهة: عربي RTL بالكامل، نفس تصميم النسخة التجريبية (تابات: لوحة التحكم / الموظفين / طلب إجازة / سجل الإجازات) + تابات جديدة: استيراد / الإعدادات.

---

## 1. التقنيات (ثابتة — المنصة المنفذة متغيرهاش)
| الجزء | الاختيار |
|---|---|
| غلاف الديسكتوب | Electron (آخر نسخة مستقرة) |
| الواجهة | React + Vite + TypeScript |
| التصميم | Bootstrap 5 RTL (bootstrap.rtl.min.css) + خط Cairo أو Tajawal محلي (بدون إنترنت) |
| قاعدة البيانات | SQLite عبر better-sqlite3 |
| Migrations | ملفات SQL مرقمة تتنفذ تلقائي عند التشغيل |
| قراءة Excel | exceljs (قراءة وتصدير) |
| قراءة PDF (نص/جداول) | pdfjs-dist داخل الـ main process |
| عرض PDF | pdfjs-dist داخل الواجهة (iframe/canvas) |
| التواريخ | date-fns |
| التحقق | zod |
| بناء المثبّت | electron-builder (Windows .exe) |

قاعدة الأمان: `contextIsolation: true`، `nodeIntegration: false`، كل الوصول للملفات وقاعدة البيانات عبر IPC في `preload.ts` بقنوات محددة فقط.

---

## 2. هيكل المشروع
```
LeaveDesk/
├─ package.json
├─ electron-builder.yml
├─ vite.config.ts
├─ tsconfig.json
├─ electron/
│  ├─ main.ts                 نقطة تشغيل Electron
│  ├─ preload.ts              تعريض API آمن للواجهة
│  ├─ ipc/
│  │  ├─ employees.ipc.ts
│  │  ├─ leaves.ipc.ts
│  │  ├─ files.ipc.ts         ربط الفولدرات + الرفع + الفتح
│  │  ├─ decisions.ipc.ts
│  │  ├─ import.ipc.ts
│  │  ├─ reports.ipc.ts
│  │  └─ settings.ipc.ts
│  ├─ db/
│  │  ├─ connection.ts
│  │  ├─ migrate.ts
│  │  └─ migrations/
│  │     ├─ 001_init.sql
│  │     └─ 002_seed_leave_types.sql
│  ├─ services/
│  │  ├─ leaveCalculator.ts   حساب الأيام والرصيد
│  │  ├─ balanceService.ts
│  │  ├─ importExcel.ts
│  │  ├─ importPdf.ts
│  │  ├─ fileLinker.ts        مسح الفولدر وربط الملفات بالموظفين
│  │  └─ backupService.ts
│  └─ utils/ (paths.ts, logger.ts, dates.ts)
├─ src/                       الواجهة
│  ├─ main.tsx, App.tsx, router.tsx
│  ├─ api/ipcClient.ts        غلاف مكتوب بأنواع لكل قنوات IPC
│  ├─ components/ (Layout, Tabs, StatCard, DataTable, Badge, PdfViewer, FileTree, ConfirmDialog, Toast)
│  ├─ pages/
│  │  ├─ Dashboard.tsx
│  │  ├─ Employees.tsx
│  │  ├─ EmployeeProfile.tsx  (تابات: البيانات / الملف PDF / الإجازات / القرارات)
│  │  ├─ LeaveRequest.tsx
│  │  ├─ LeaveLog.tsx
│  │  ├─ Import.tsx
│  │  └─ Settings.tsx
│  └─ styles/rtl.css
├─ resources/ (icon.ico, templates/employees_template.xlsx)
└─ docs/ (README.md, USER_GUIDE.md)
```

### مكان البيانات على الجهاز (قابل للتغيير من الإعدادات)
```
LeaveDeskData/
├─ leavedesk.db
├─ backups/
├─ employee_files/            ← الفولدر الرئيسي لملفات الموظفين
│  ├─ EMP-101/
│  │  ├─ عقد العمل.pdf         (ملفات عامة)
│  │  ├─ leaves/               (استمارات الإجازات المرفوعة من البرنامج)
│  │  └─ decisions/            (مرفقات القرارات)
│  └─ EMP-102/ ...
└─ imports/                   (نسخة من ملفات الاستيراد للتتبع)
```
**قاعدة التسمية:** اسم الفولدر = كود الموظف بالظبط. لو المستخدم يستخدم رقم فقط (101) البرنامج يطابقه مع EMP-101 حسب إعداد "بادئة الكود" (افتراضي `EMP-`). كمان يدعم ملف PDF واحد باسم الكود (`101.pdf`) يتعامل معاه كملف عام للموظف.

---

## 3. قاعدة البيانات (SQLite) — `001_init.sql`

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,            -- EMP-101
  full_name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  job_title TEXT,
  hire_date TEXT NOT NULL,              -- ISO yyyy-mm-dd
  birth_date TEXT,
  national_id TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resigned','terminated','suspended')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leave_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,             -- annual, casual, sick, unpaid, ...
  name_ar TEXT NOT NULL,
  yearly_entitlement REAL,              -- NULL = بدون سقف
  deducts_balance INTEGER NOT NULL DEFAULT 1,
  counts_weekends INTEGER NOT NULL DEFAULT 0,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  entitlement REAL NOT NULL,            -- الاستحقاق لهذه السنة (ممكن يتعدل يدوي)
  carried_over REAL NOT NULL DEFAULT 0,
  adjustment REAL NOT NULL DEFAULT 0,   -- تسوية يدوية بسبب
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL,                   -- محسوبة أوتوماتيك
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_at TEXT,
  decided_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE employee_documents (        -- أي ملف متربط بموظف
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('general','leave_form','decision','import_source')),
  related_leave_id INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL,
  related_decision_id INTEGER REFERENCES decisions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  relative_path TEXT NOT NULL,           -- نسبي لـ employee_files (عشان نقل الفولدر ميكسرش حاجة)
  file_size INTEGER,
  page_count INTEGER,
  added_via TEXT NOT NULL DEFAULT 'upload' CHECK (added_via IN ('upload','folder_scan')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, relative_path)
);

CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  decision_no TEXT,
  decision_date TEXT NOT NULL,
  type TEXT NOT NULL,                    -- ترقية، نقل، جزاء، إنذار، شكر، تعيين، تجديد عقد، أخرى
  subject TEXT NOT NULL,
  details TEXT,
  effective_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('excel','pdf')),
  file_name TEXT NOT NULL,
  rows_total INTEGER, rows_inserted INTEGER, rows_updated INTEGER, rows_skipped INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL, entity_id INTEGER, action TEXT NOT NULL,
  old_value TEXT, new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_leave_emp ON leave_requests(employee_id, start_date);
CREATE INDEX idx_docs_emp ON employee_documents(employee_id, category);
CREATE INDEX idx_dec_emp ON decisions(employee_id, decision_date);
```

### `002_seed_leave_types.sql` (قيم افتراضية قابلة للتعديل من الإعدادات)
| key | الاسم | الاستحقاق/سنة | يخصم من الرصيد | يحسب الجمع/العطلات |
|---|---|---|---|---|
| annual | اعتيادي | 21 | نعم | لا |
| casual | عارضة | 7 | نعم | لا |
| sick | مرضي | بدون سقف | لا (يتطلب مرفق) | لا |
| unpaid | بدون مرتب | بدون سقف | لا | نعم |
| maternity / other | حسب الحاجة | — | — | — |

> **مهم:** أرقام الاستحقاق تتخزن في الإعدادات وليست مكتوبة في الكود. النسخة التجريبية استخدمت 21 اعتيادي + 7 عارضة؛ راجع القيمة الصحيحة مع قانون العمل الساري وسياسة شركتك قبل الاعتماد (القانون ممكن يفرّق حسب سنوات الخدمة أو السن). لذلك نضيف قاعدة اختيارية في الإعدادات: "رفع الاعتيادي إلى X يوم بعد Y سنة خدمة أو عند سن Z".

---

## 4. قواعد العمل (leaveCalculator / balanceService)
1. **عدد الأيام** = الأيام بين `start` و`end` شاملة الطرفين، مع استبعاد: أيام الإجازة الأسبوعية (إعداد، افتراضي الجمعة + السبت) والإجازات الرسمية من جدول `holidays`، إلا لو نوع الإجازة `counts_weekends = 1`.
2. **الرصيد المتبقي** = `entitlement + carried_over + adjustment − مجموع أيام الطلبات (approved)` للنوع والسنة. الطلبات `pending` تظهر كـ "محجوزة" ولا تخصم نهائيًا.
3. **منع الطلب** لو الأيام > المتاح (للأنواع التي تخصم) مع رسالة واضحة؛ والمدير يقدر يتجاوز بخانة "تجاوز بسبب" تتسجل في audit_log.
4. **منع التداخل:** نفس الموظف لا يكون له طلبين approved/pending متداخلين.
5. **طلب يعبر نهاية السنة:** يتقسم الخصم على السنتين حسب أيام كل سنة.
6. **بداية السنة:** زر "تجهيز أرصدة سنة جديدة" ينشئ سجلات leave_balances للكل، مع خيار ترحيل رصيد الاعتيادي (بسقف يحدده المستخدم).
7. **الحالات:** pending → approved / rejected؛ approved → cancelled (يرجّع الرصيد).
8. **تنبيه الأرصدة:** موظف رصيده الاعتيادي ≤ حد قابل للضبط (افتراضي 3 أيام).
9. **المرضي:** يطلب مرفق (استمارة/شهادة) قبل الاعتماد لو `requires_attachment`.
10. كل تعديل مهم يتسجل في `audit_log`.

---

## 5. الشاشات (حسب ترتيب التنفيذ)
| # | الشاشة | المحتوى |
|---|---|---|
| 1 | لوحة التحكم | كروت: إجمالي الموظفين، أيام مستهلكة، الرصيد المتبقي، تنبيه أرصدة + جدول "أرصدة قربت تخلص" + آخر الطلبات + عدد الطلبات المعلقة |
| 2 | الموظفين | بحث بالاسم/الكود، فلتر القسم، جدول الأرصدة، أزرار: موظف جديد / استيراد / تصدير Excel / مزامنة الملفات |
| 3 | ملف الموظف | هيدر (بيانات + أرصدة) + 4 تابات: البيانات، ملف الموظف (PDF)، الإجازات والاستمارات، القرارات — انظر الصورة التقريبية |
| 4 | طلب إجازة | اختيار موظف/نوع، عرض الرصيد الحالي، من/إلى، حساب الأيام أوتوماتيك، سبب، رفع الاستمارة (PDF/صورة)، حالة الطلب |
| 5 | سجل الإجازات | فلاتر (بحث، نوع، حالة، فترة)، جدول، اعتماد/رفض بنقرة، فتح استمارة الطلب، تصدير |
| 6 | الاستيراد | خطوات: اختيار الملف → معاينة → ربط الأعمدة → فحص الأخطاء → تأكيد |
| 7 | الإعدادات | مسار فولدر الملفات، بادئة الكود، الأرصدة الافتراضية، أيام الإجازة الأسبوعية، العطلات الرسمية، حد التنبيه، النسخ الاحتياطي |

### تفاصيل تاب "ملف الموظف (PDF)"
- يسرد محتويات `employee_files/<الكود>/` (ملفات + فولدرات فرعية) كشجرة.
- نقر على ملف = معاينة داخل البرنامج (صفحات، تكبير، طباعة).
- أزرار: رفع ملف (نسخ لفولدر الموظف) / فتح الفولدر في الجهاز (`shell.openPath`) / إعادة المسح.
- لو الفولدر مش موجود: رسالة "لا يوجد ملف لهذا الموظف" + زر "إنشاء الفولدر".
- أي ملف يضاف يدويًا للفولدر من خارج البرنامج يظهر عند المسح (`added_via = folder_scan`).

### تاب "الإجازات والاستمارات"
قائمة طلبات الموظف، ولكل طلب أيقونة الاستمارة المرفقة (تفتح في المعاينة) + زر "رفع/استبدال استمارة".

### تاب "القرارات"
جدول: رقم القرار، التاريخ، النوع، الموضوع، تاريخ السريان، المرفق. زر "قرار جديد" بنموذج + رفع مرفق يتحفظ في `decisions/`.

---

## 6. الاستيراد
### Excel
- قالب جاهز يتحمل من البرنامج: `الكود | الاسم | القسم | المسمى | تاريخ التعيين | الرقم القومي | الهاتف` (+ اختياري: أرصدة افتتاحية اعتيادي/عارضة مستخدمة).
- المستخدم يقدر يرفع ملف بأعمدة مختلفة؛ شاشة **ربط الأعمدة** تخليه يحدد كل عمود.
- معالجة التاريخ: يقبل `yyyy-mm-dd` و`dd/mm/yyyy` وأرقام Excel التسلسلية.
- التكرار: لو الكود موجود → خيار (تخطي / تحديث).
- لا يُكتب شيء قبل شاشة المعاينة والتأكيد. كل الاستيراد داخل transaction واحدة (فشل = رجوع كامل).
- تقرير نهاية الاستيراد: تم إضافة / تحديث / تخطي / أخطاء (قابل للتصدير).

### PDF
- PDF النصي (ليس صورة): استخراج النص بـ pdfjs وإعادة بناء الصفوف حسب الإحداثيات، ثم نفس شاشة ربط الأعمدة.
- **تنبيه صريح:** استخراج الجداول العربية من PDF غير مضمون 100% (اتجاه النص RTL وترتيب الحروف). لذلك المعاينة إجبارية، والمستخدم يصحح الصفوف قبل الحفظ.
- PDF ممسوح (صور): خارج النطاق في الإصدار الأول؛ يظهر تنبيه "الملف صورة، استخدم Excel". (OCR مرحلة اختيارية لاحقًا.)

### ربط الفولدر (مسح تلقائي)
زر "مزامنة الملفات": يمسح `employee_files/`، لكل فولدر اسمه كود موجود يربط ملفاته بسجل `employee_documents`؛ فولدرات بأكواد غير معروفة تظهر في تقرير "ملفات بدون موظف".

---

## 7. المراحل وشروط القبول
كل مرحلة = برومبت للمنصة المنفذة + مراجعتي قبل الانتقال للي بعدها.

| المرحلة | المحتوى | شرط القبول |
|---|---|---|
| P1 | هيكل المشروع + Electron + Vite + SQLite + migrations + Layout عربي RTL + التابات الفارغة | `npm run dev` يفتح نافذة عربية RTL، قاعدة البيانات تتكوّن لوحدها |
| P2 | الموظفين CRUD + الأقسام + بحث وفلتر + ملف الموظف (تاب البيانات) | إضافة/تعديل/حذف ناعم، البحث يشتغل، البيانات تفضل بعد غلق البرنامج |
| P3 | الإجازات: الحاسبة + الأرصدة + طلب إجازة + سجل + اعتماد/رفض + لوحة التحكم | أمثلة اختبار الحاسبة (القسم 8) كلها تنجح؛ منع تجاوز الرصيد والتداخل |
| P4 | ملفات الموظف: فولدر الموظف + المعاينة + الرفع + المسح + استمارة الإجازة | فتح PDF داخل البرنامج، رفع استمارة بيتحفظ في `leaves/` ومربوط بالطلب |
| P5 | القرارات + مرفقاتها | قرار جديد بمرفق يظهر في تاب القرارات وفي فولدر `decisions/` |
| P6 | الاستيراد Excel ثم PDF + شاشة المعاينة وربط الأعمدة | استيراد 200 صف بدون أخطاء، فشل صف واحد لا يوقف الباقي (يتسجل خطأ) |
| P7 | الإعدادات + العطلات + سنة جديدة + نسخ احتياطي/استرجاع + تصدير Excel + المثبّت | `.exe` يتثبّت ويشتغل على جهاز نضيف |

---

## 8. حالات اختبار الحاسبة (للمراجعة)
| الحالة | المتوقع |
|---|---|
| اعتيادي من السبت 2024-03-02 إلى الأربعاء 2024-03-06 (أسبوع جمعة/سبت) | استبعاد الجمعة والسبت، الأيام حسب الأيام الفعلية |
| طلب فيه عطلة رسمية داخل الفترة | العطلة لا تُحسب |
| رصيد اعتيادي 2 وطلب 3 أيام | رفض مع رسالة، إلا مع "تجاوز بسبب" |
| طلب 2024-12-30 → 2025-01-03 | الخصم يتوزع على سنتين |
| إلغاء طلب معتمد | الرصيد يرجع |
| طلب متداخل مع طلب آخر لنفس الموظف | رفض |
| مرضي بدون مرفق | لا يمكن اعتماده |

---

## 9. معايير الجودة العامة
- كل النصوص عربي، التواريخ بالعرض `dd-mm-yyyy` والتخزين ISO.
- أي عملية حذف تطلب تأكيد، وحذف الموظف "ناعم" (status) مش فعلي.
- لا اتصال بالإنترنت ولا CDN: الخطوط والمكتبات كلها محلية.
- لا تُخزَّن مسارات مطلقة للملفات؛ فقط نسبية.
- النسخ الاحتياطي = نسخة من `leavedesk.db` (+ اختياري فولدر الملفات) في `backups/` بتاريخ.
- بيانات الموظفين حساسة: لا تُرسل لأي خدمة خارجية، ولا يوجد logging للأسماء أو الأرقام القومية.
- كل مرحلة تنتهي بكود **كامل** لكل ملف اتعدل (مش diff)، وبتحديث `docs/README.md`.

---

## 10. البرومبت الرئيسي (الصقه كما هو في المنصة المنفذة قبل أي مرحلة)

```
أنت مهندس برمجيات Full-Stack. نفّذ مشروع ديسكتوب اسمه LeaveDesk وفق المواصفات التالية بدقة.
التقنيات: Electron + React + Vite + TypeScript + Bootstrap 5 RTL + SQLite (better-sqlite3) + exceljs + pdfjs-dist + date-fns + zod + electron-builder.
الواجهة عربي RTL بالكامل ولا تعتمد على الإنترنت.
أمان: contextIsolation=true و nodeIntegration=false، وكل الوصول للملفات وقاعدة البيانات عبر IPC في preload بقنوات محددة.
التزم بهيكل المجلدات وجداول قاعدة البيانات وقواعد العمل الموجودة في ملف الخطة المرفق حرفيًا. لا تغيّر أسماء الجداول أو الأعمدة.
أرصدة الإجازات والقيم الافتراضية تُقرأ من جداول leave_types وsettings ولا تُكتب داخل الكود.
عند التسليم: 1) اعرض شجرة الملفات اللي أنشأتها أو عدّلتها 2) اكتب الكود الكامل لكل ملف (بدون اختصار أو "..." ) 3) اكتب أوامر التشغيل والاختبار 4) اكتب قائمة "ما تم" و"ما لم يتم" بصراحة 5) لا تنتقل للمرحلة التالية قبل تأكيدي.
لو في نقطة غامضة، افترض أبسط حل واكتب الافتراض في أول ردك.
نفّذ الآن المرحلة: [P1 / P2 / ...]
```

### برومبت P1 (جاهز)
```
نفّذ المرحلة P1 فقط:
- أنشئ مشروع Electron + Vite + React + TS بالهيكل المذكور في القسم 2.
- اعمل اتصال SQLite ونظام migrations يشغّل 001_init.sql و002_seed_leave_types.sql تلقائيًا عند أول تشغيل، وينشئ فولدر البيانات LeaveDeskData في مجلد المستندات.
- اعمل Layout عربي RTL فيه الهيدر "نظام إدارة الإجازات" والتابات: لوحة التحكم، الموظفين، طلب إجازة، سجل الإجازات، استيراد، الإعدادات (صفحات فارغة بعنوان فقط).
- جهّز ipcClient بأنواع TypeScript وقناة واحدة تجريبية تقرأ عدد الموظفين من قاعدة البيانات وتعرضه في لوحة التحكم.
- ملف README فيه أوامر: install, dev, build.
شرط القبول: npm run dev يفتح النافذة بالعربية RTL ويظهر رقم 0 في لوحة التحكم.
```

---

## 11. قائمة مراجعتي (أنا) على كل مرحلة
- مطابقة الجداول والأعمدة للخطة.
- أمان Electron (isolation + قنوات IPC).
- عدم وجود أرقام استحقاق مكتوبة داخل الكود.
- اختبار حالات القسم 8.
- RTL سليم (محاذاة، ترتيب الأعمدة، الأرقام، الـ PDF viewer).
- عدم وجود مسارات مطلقة، وأن الاستيراد داخل transaction.
- اكتمال الكود بدون اختصار.
