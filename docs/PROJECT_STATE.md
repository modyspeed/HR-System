# حالة المشروع — LeaveDesk
آخر تحديث: 2026-10-02 (بواسطة: GitHub Copilot) — النسخة: P2 للمراجعة

## الملخص في سطرين
برنامج ديسكتوب (Electron + React + SQLite) لحصر أرصدة الإجازات وملفات الموظفين (PDF) والقرارات، عربي RTL، أوفلاين.
المرحلة الحالية: **P1a مقبولة، P1b مقبولة حسب تأكيد المالك في جلسة P2، وP2 تنفيذ مكتمل (مستني مراجعة).** P3 وما بعدها لم تبدأ.

## جدول المراحل
| المرحلة | الوصف | الحالة | المنصة | تاريخ | ملاحظات |
|---|---|---|---|---|---|
| P0 | الخطة + التوثيق | تم | Claude | 2026-10-01 | |
| P1a | النواة التقنية: Electron + SQLite + migrations لكل وحدة + registry | تم (راجعه Claude) | GitHub Copilot | 2026-10-01 | تحققنا: 13 جدول مطابقة لـ SCHEMA.sql، البذور صحيحة، typecheck ✅، 7 اختبارات ✅. code/README.md مقبول بدل docs/README.md (D18) |
| P1b | نظام التصميم + Shell + دارك/لايت + لوحة التحكم النهائية | تم مشروطًا | GitHub Copilot | 2026-10-01 | المالك أكد القبول في رسالة بدء P2؛ حالة المراجعة السابقة بانتظار فحص يدوي لم يحدّثها Claude بعد |
| P2 | الموظفين CRUD + الأقسام + ملف الموظف (تاب البيانات) | تنفيذ مكتمل (مستني مراجعة) | GitHub Copilot | 2026-10-02 | تقرير `reports/P2_GitHubCopilot_2026-10-02.md`؛ SQLite service tests 3/3 |
| P3 | الإجازات: الحاسبة + الأرصدة + الطلبات + السجل + اللوحة | لم تبدأ | — | — | |
| P4 | ملفات الموظف PDF + الرفع + المسح + استمارة الإجازة | لم تبدأ | — | — | |
| P5 | القرارات + مرفقاتها | لم تبدأ | — | — | |
| P6 | الاستيراد Excel ثم PDF | لم تبدأ | — | — | |
| P7 | الإعدادات + سنة جديدة + نسخ احتياطي + تصدير + المثبّت | لم تبدأ | — | — | |

الحالات المسموحة: لم تبدأ / جارية / تنفيذ مكتمل (مستني مراجعة) / تم (راجعه Claude) / تحتاج تصحيح

## الخطوة الجاية بالظبط
مراجعة P2 في `reports/P2_GitHubCopilot_2026-10-02.md` والكود. لا تبدأ P3 قبل موافقة المالك/Claude. يلزم أيضًا مزامنة حالة مراجعة P1b الرسمية مع تأكيد المالك.

## تغييرات v1
اتضاف: معمارية وحدات (D10)، نظام تصميم فخم Light/Dark (D11-D16)، وتقسيم P1 إلى P1a/P1b (D17).

## مكان الكود
`code/` — مستودع GitHub: https://github.com/modyspeed/HR-System (عام) | آخر commit: سيُحدّث بعد commit P2 | tags السابقة: `P1a`, `P1b` | آخر ZIP: —

## الملفات المنفذة (File manifest)
- `code/package.json`, `code/package-lock.json` — اعتماديات وأوامر Electron/Vite/React/SQLite — مكتمل.
- `code/electron.vite.config.ts`, `code/tsconfig.json`, `code/tsconfig.electron.json` — إعداد البناء والأنواع — مكتمل.
- `code/electron/main.ts`, `code/electron/preload.ts`, `code/electron/raw-imports.d.ts` — نافذة آمنة وواجهة IPC محدودة — مكتمل.
- `code/electron/core/db.ts`, `ipc.ts`, `migrate.ts`, `moduleTypes.ts`, `theme.ts`, `theme.test.ts` — DB وIPC وrunner وعقد الوحدات والثيم — مكتمل.
- `code/electron/core/migrations/001_core.sql`, `002_seed.sql` — مخطط وبذور core — مكتمل.
- `code/electron/modules/index.ts` و`code/electron/modules/{employees,leaves,decisions,documents}/index.ts` — registry Electron ووحدات placeholders — مكتمل.
- `code/electron/modules/{employees,leaves,decisions,documents}/migrations/*.sql` — مخططات الوحدات والبذور — مكتمل.
- `code/src/index.html`, `main.tsx`, `App.tsx`, `styles.css` — صفحات RTL وتهيئة الثيم — مكتمل.
- `code/src/core/api/{contracts.ts,global.d.ts,ipcClient.ts}` — عقد وعميل IPC typed ومتابعة bridge آمنة — مكتمل.
- `code/src/core/theme/ThemeProvider.tsx` — نظام الثيم Light/Dark/System مع fallback آمن — مكتمل.
- `code/src/core/shell/{AppShell.tsx,Sidebar.tsx,Topbar.tsx,CommandPalette.tsx,SettingsPage.tsx}` — shell + شريط التنقل + لوحة التحكم + إعدادات — مكتمل.
- `code/src/core/shell/pages/{DashboardPage.tsx,DesignGalleryPage.tsx}` — لوحة التحكم ومعرض المكونات — مكتمل.
- `code/src/components/ui/*` — مكونات UI الأساسية — مكتمل.
- `code/src/modules/index.ts` — registry الواجهة وأسماء/مسارات الوحدات — مكتمل.
- `code/electron/modules/employees/{schemas.ts,ipc.ts,services/employeeService.ts}` — Zod وخدمات الموظفين/الأقسام والـ IPC — مكتمل.
- `code/electron/modules/employees/services/employeeService.test.ts` — اختبارات SQLite حقيقية وclose/reopen — مكتمل.
- `code/src/modules/employees/{index.tsx,validation.ts,employees.css}` — مسارات الموظفين والتحقق والتصميم — مكتمل.
- `code/src/modules/employees/components/{EmployeeFormModal.tsx,DepartmentFormModal.tsx}` — نماذج الموظف والقسم — مكتمل.
- `code/src/modules/employees/pages/{EmployeesPage.tsx,EmployeeProfilePage.tsx}` — القائمة وملف الموظف/تاب البيانات — مكتمل.
- `code/src/core/api/ipcClient.test.ts`, `code/src/modules/employees/validation.test.ts` — D19 والتحقق من المدخلات — مكتمل.
- `code/electron/core/migrate.test.ts`, `code/electron/modules/index.test.ts`, `code/src/modules/index.test.ts` — اختبارات registry وترتيب migrations — مكتمل.
- `code/README.md` — تثبيت وتشغيل وبناء واختبار — مكتمل.
- `reports/P1a_GitHubCopilot_2026-10-01.md` — تقرير P1a — مكتمل.
- `reports/P1b_GitHubCopilot_2026-10-01.md` — تقرير P1b — مكتمل.
- `reports/P2_GitHubCopilot_2026-10-02.md` — تقرير P2 — مكتمل.

## مشاكل مفتوحة / ملاحظات المراجعة
- `npm install` أبلغ عن 4 ثغرات في الاعتماديات (2 متوسطة و2 عالية)؛ لم تُطبّق تحديثات تلقائية.
- (محلول) تعارض docs/README.md مع AGENTS.md: القرار D18 = code/README.md هو المعتمد.
- (محلول في P2 — D19) عمليات بيانات الموظفين خارج Electron تفشل برسالة واضحة ولا تستخدم fallback تخزين.
- (محلول في P2 — D21) services اختُبرت على SQLite حقيقية عبر `ELECTRON_RUN_AS_NODE=1`، مع اختبار close/reopen.
- لا CSP في index.html (السكربت المبكر inline): يُضاف لاحقًا بـ hash.
- اختلاف مراجعة P1b: الحالة السابقة تشترط فحصًا يدويًا داخل Electron، بينما المالك أكد القبول في طلب P2؛ لم أغيّر قرار مراجعة Claude.
- ملاحظات P7: single-instance lock، إغلاق قاعدة البيانات عند الخروج، npm audit (4 ثغرات).
- (محلول — D20) القسم إجباري والمسمى اختياري، يُطبَّق في طبقة التحقق لا في SCHEMA.

## افتراضات اتاخدت أثناء التنفيذ
- قاعدة البيانات محفوظة في Documents تحت `LeaveDeskData`، وبنية `app.getPath("documents")` هي أساس مسار المستخدم.
- SQL migrations مستوردة كـ raw assets محلية ليتضمنها build.
