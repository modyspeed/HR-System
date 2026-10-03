# حالة المشروع — LeaveDesk
آخر تحديث: 2026-10-03 (بواسطة: Kilo) — النسخة: P4 جارية: P4.2a تنفيذ مكتمل (مستني مراجعة وفحص يدوي) — typecheck/test/test:db/build كلها ✅

## الملخص في سطرين
برنامج ديسكتوب (Electron + React + SQLite) لحصر أرصدة الإجازات وملفات الموظفين (PDF) والقرارات، عربي RTL، أوفلاين.
المرحلة الحالية: **P4 جارية: P4.2a تنفيذ مكتمل (مستني مراجعة وفحص يدوي)** — تاب "ملف الموظف PDF" كامل + عارض PDF محلي + مزامنة ملفات + تشديد كود الموظف. الخطوة التالية P4.2b (استمارة الإجازة وسحب وإفلات) وتنتظر موافقة المالك.

## جدول المراحل
| المرحلة | الوصف | الحالة | المنصة | تاريخ | ملاحظات |
|---|---|---|---|---|---|
| P0 | الخطة + التوثيق | تم | Claude | 2026-10-01 | |
| P1a | النواة التقنية: Electron + SQLite + migrations لكل وحدة + registry | تم (راجعه Claude) | GitHub Copilot | 2026-10-01 | تحققنا: 13 جدول مطابقة لـ SCHEMA.sql، البذور صحيحة، typecheck ✅، 7 اختبارات ✅. code/README.md مقبول بدل docs/README.md (D18) |
| P1b | نظام التصميم + Shell + دارك/لايت + لوحة التحكم النهائية | تم مشروطًا | GitHub Copilot | 2026-10-01 | المالك أكد القبول في رسالة بدء P2؛ حالة المراجعة السابقة بانتظار فحص يدوي لم يحدّثها Claude بعد |
| P2 | الموظفين CRUD + الأقسام + ملف الموظف (تاب البيانات) | جارية: P2.1 تنفيذ مكتمل (مستني مراجعة) | GitHub Copilot + Kilo | 2026-10-02 | تقرير `reports/P2.1_GitHubCopilot_2026-10-02.md`؛ Kilo صلحت مسارات `test:db` فنجح (2/2) |
| P3 | الإجازات: الحاسبة + الأرصدة + الطلبات + السجل + اللوحة | تنفيذ مكتمل (مستني فحص يدوي من المالك داخل Electron) | Kilo (تنفيذ) + Claude (مراجعة وإصلاح) | 2026-10-03 | إصلاحات مراجعة Claude مطبّقة: D22 حجز المعلق، D23 leave_request_year_days، D24 active فقط، D25 AppError واحدة. typecheck/test/build/test:db كلها ✅ |
| P4 | ملفات الموظف PDF + الرفع + المسح + استمارة الإجازة | جارية: P4.2a تنفيذ مكتمل (مستني مراجعة وفحص يدوي) | Kilo | 2026-10-03 | تاب ملف الموظف + عارض PDF (pdfjs-dist@4.10.38 محلي) + مزامنة ملفات + تشديد الكود (محجوز ويندوز وتكرار غير حساس). test:db 26/26 |
| P5 | القرارات + مرفقاتها | لم تبدأ | — | — | |
| P6 | الاستيراد Excel ثم PDF | لم تبدأ | — | — | |
| P7 | الإعدادات + سنة جديدة + نسخ احتياطي + تصدير + المثبّت | لم تبدأ | — | — | |

الحالات المسموحة: لم تبدأ / جارية / تنفيذ مكتمل (مستني مراجعة) / تم (راجعه Claude) / تحتاج تصحيح

## الخطوة الجاية بالظبط
P4.2a اكتملت (تاب ملف الموظف + عارض PDF + مزامنة + تشديد الكود) ويحتاج فحصًا يدويًا داخل Electron من المالك: تاب الملفات، الرفع، المعاينة في Light/Dark، وزر المزامنة. بعد موافقته تبدأ P4.2b (استمارة الإجازة + سحب وإفلات + سجل الإجازات).

## تغييرات v1
اتضاف: معمارية وحدات (D10)، نظام تصميم فخم Light/Dark (D11-D16)، وتقسيم P1 إلى P1a/P1b (D17).

## مكان الكود
`code/` — مستودع GitHub: https://github.com/modyspeed/HR-System (عام) | آخر commit P4.2a: مرفوع | tags: `P1a`, `P1b`, `P2`, `P3` | آخر ZIP: —

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
- `code/electron/modules/employees/{schemas.ts,service.ts,ipc.ts}` — تحقق Zod وخدمات DB-first وAppError وقنوات envelope — مكتمل في P2.1.
- `code/electron/modules/employees/{schemas.test.ts,service.db.test.ts}` و`code/vitest.db.config.ts` — اختبارات schemas وSQLite حقيقية — schemas مكتملة؛ اختبار DB غير متحقق بسبب مسار migration.
- `code/src/modules/employees/{index.tsx,validation.ts,employees.css}` — مسارات الموظفين والتحقق والتصميم — مكتمل.
- `code/src/modules/employees/components/{EmployeeFormModal.tsx,DepartmentFormModal.tsx}` — نماذج الموظف والقسم — مكتمل.
- `code/src/modules/employees/pages/{EmployeesPage.tsx,EmployeeProfilePage.tsx}` — القائمة وملف الموظف/تاب البيانات — مكتمل.
- `code/src/core/api/ipcClient.test.ts`, `code/src/modules/employees/validation.test.ts` — D19 والتحقق من المدخلات — مكتمل.
- `code/electron/core/migrate.test.ts`, `code/electron/modules/index.test.ts`, `code/src/modules/index.test.ts` — اختبارات registry وترتيب migrations — مكتمل.
- `code/README.md` — تثبيت وتشغيل وبناء واختبار — مكتمل.
- `reports/P1a_GitHubCopilot_2026-10-01.md` — تقرير P1a — مكتمل.
- `reports/P1b_GitHubCopilot_2026-10-01.md` — تقرير P1b — مكتمل.
- `reports/P2_GitHubCopilot_2026-10-02.md` — تقرير P2 — مكتمل.
- `reports/P2.1_GitHubCopilot_2026-10-02.md` — تقرير P2.1 — مكتمل.
- `reports/P2.1_Kilo_2026-10-02.md` — تقرير مراجعة Kilo لـ P2.1 — مكتمل.
- `reports/P3_Kilo_2026-10-02.md` — تقرير P3 — مكتمل.
- `reports/P3-fix_Kilo_2026-10-03.md` — تقرير التحقق من إصلاح مراجعة Claude + الرفع — مكتمل.
- `README_APPLY.md` — تعليمات فك حزمة إصلاح Claude (مؤقت) — مكتمل.
- `code/electron/modules/leaves/{services/leaveCalculator.ts, services/balanceService.ts, services/leaveRequestService.ts, schemas.ts, errors.ts, ipc.ts, index.ts}` — خدمات الحسبة والأرصدة والطلبات + Zod + IPC + migrations — مكتمل.
- `code/electron/modules/leaves/services/{leaveCalculator.test.ts, balanceService.test.ts, leaveRequestService.db.test.ts}` — اختبارات وحدة وSQLite — مكتمل.
- `code/src/modules/leaves/{index.tsx, pages/LeaveRequestPage.tsx, pages/LeaveLogPage.tsx, components/LeaveTypeBadge.tsx, leaves.css}` — شاشات الإجازات — مكتمل.
- `code/src/core/shell/pages/DashboardPage.tsx` — لوحة تحكم حقيقية ببيانات من SQLite + low-balance alerts — مكتمل.
- `code/src/modules/employees/pages/EmployeesPage.tsx` — أعمدة أرصدة (مستخدم/متبقي) — مكتمل.
- `code/electron/modules/leaves/migrations/003_request_year_days.sql` — جدول تثبيت توزيع أيام الطلبات (D23) — مكتمل (مراجعة Claude).
- `code/electron/modules/leaves/regression.db.test.ts` — 7 اختبارات انحدار لثغرات المراجعة — مكتمل (مراجعة Claude).
- `code/electron/modules/documents/{errors.ts,pathSafety.ts,pathSafety.test.ts,schemas.ts,ipc.ts}` — حزمة Claude الآمنة (D26) — مكتمل (غير معدّل).
- `code/electron/modules/documents/services/{fileService.ts,fileService.db.test.ts}` — خدمة الملفات + 10 اختبارات SQLite وفولدرات حقيقية (D27) — مكتمل (غير معدّل).
- `code/electron/core/moduleTypes.ts`, `code/electron/main.ts`, `code/electron/modules/documents/index.ts` — ربط host (P4.1) — مكتمل.
- `code/src/core/api/contracts.ts`, `code/electron/preload.ts`, `code/src/core/api/ipcClient.ts` — جسر 7 دوال documents (P4.1) — مكتمل.
- `code/electron/modules/employees/schemas.ts` + `schemas.test.ts` — تشديد كود الموظف (D28) — مكتمل.
- `reports/P4.1_Kilo_2026-10-03.md` — تقرير P4.1 — مكتمل.
- `code/src/modules/documents/{pdfSetup.ts,utils.ts,utils.test.ts,documents.css}` — تهيئة pdfjs + أدوات مساعدة + تنسيقات — مكتمل (P4.2a).
- `code/src/modules/documents/components/{PdfViewer.tsx,EmployeeFilesTab.tsx}` — عارض PDF + تاب ملفات الموظف — مكتمل (P4.2a).
- `code/src/modules/employees/pages/{EmployeeProfilePage.tsx,EmployeesPage.tsx}` — ربط التاب + زر المزامنة — مكتمل (P4.2a).
- `code/src/styles/tokens.css` — توكن `--paper-white` (D16) — مكتمل.
- `reports/P4.2a_Kilo_2026-10-03.md` — تقرير P4.2a — مكتمل.

## مشاكل مفتوحة / ملاحظات المراجعة
- `npm install` أبلغ عن 4 ثغرات في الاعتماديات (2 متوسطة و2 عالية)؛ لم تُطبّق تحديثات تلقائية.
- (محلول) تعارض docs/README.md مع AGENTS.md: القرار D18 = code/README.md هو المعتمد.
- (محلول في P2 — D19) عمليات بيانات الموظفين خارج Electron تفشل برسالة واضحة ولا تستخدم fallback تخزين.
- (محلول في P2 — D21) services اختُبرت على SQLite حقيقية عبر `ELECTRON_RUN_AS_NODE=1`، مع اختبار close/reopen.
- P2.1: `npm run test:db` فشل مرتين قبل تنفيذ الاختبارات بسبب مسارات migrations في `service.db.test.ts`؛ توقفنا حسب حد المحاولتين وسُجل الخطأ في التقرير.
- لا CSP في index.html (السكربت المبكر inline): يُضاف لاحقًا بـ hash.
- اختلاف مراجعة P1b: الحالة السابقة تشترط فحصًا يدويًا داخل Electron، بينما المالك أكد القبول في طلب P2؛ لم أغيّر قرار مراجعة Claude.
- ملاحظات P7: single-instance lock، إغلاق قاعدة البيانات عند الخروج، npm audit (4 ثغرات).
- (محلول — D20) القسم إجباري والمسمى اختياري، يُطبَّق في طبقة التحقق لا في SCHEMA.
- (محلول في P3-fix — D22–D25) حجز الطلبات المعلقة من الرصيد، تثبيت الأيام المستهلكة في `leave_request_year_days`، قبول الطلبات للموظفين النشطين فقط، وفئة `AppError` واحدة في وحدة leaves. الاختبارات الأربعة + البناء ناجحة.
- (P4.1 — D26–D28) حزمة documents الآمنة مربوطة بالمضيف؛ الواجهة لا ترسل مسارات أبدًا (مربع الحوار في main)، وكود الموظف المرفوض رموزًا يُرفض من طبقة التحقق. قيد مسجّل (D28): تغيير كود موظف له ملفات لا يعيد تسمية فولدره.
- (P4.2a) تاب ملف الموظف يعمل بعارض PDF محلي (pdfjs-dist@4.10.38)؛ npm audit ارتفع لـ 8 ثغرات (2 متوسطة و6 عالية) بعد إضافته ولم تُعالَج. لم يُختبر التفاعل البصري داخل Electron بعد.

## افتراضات اتاخدت أثناء التنفيذ
- قاعدة البيانات محفوظة في Documents تحت `LeaveDeskData`، وبنية `app.getPath("documents")` هي أساس مسار المستخدم.
- SQL migrations مستوردة كـ raw assets محلية ليتضمنها build.
