# حالة المشروع — LeaveDesk
آخر تحديث: 2026-10-01 (بواسطة: GitHub Copilot) — النسخة: تنفيذ P1b للمراجعة

## الملخص في سطرين
برنامج ديسكتوب (Electron + React + SQLite) لحصر أرصدة الإجازات وملفات الموظفين (PDF) والقرارات، عربي RTL، أوفلاين.
المرحلة الحالية: **P1b تنفيذ مكتمل (مستني مراجعة).** P2 وما بعدها لم تبدأ.

## جدول المراحل
| المرحلة | الوصف | الحالة | المنصة | تاريخ | ملاحظات |
|---|---|---|---|---|---|
| P0 | الخطة + التوثيق | تم | Claude | 2026-10-01 | |
| P1a | النواة التقنية: Electron + SQLite + migrations لكل وحدة + registry | تنفيذ مكتمل (مستني مراجعة) | GitHub Copilot | 2026-10-01 | تقرير reports/P1a_GitHubCopilot_2026-10-01.md؛ راجع ملاحظة docs/README.md |
| P1b | نظام التصميم + Shell + دارك/لايت + لوحة التحكم النهائية | تنفيذ مكتمل (مستني مراجعة) | GitHub Copilot | 2026-10-01 | تقرير reports/P1b_GitHubCopilot_2026-10-01.md |
| P2 | الموظفين CRUD + الأقسام + ملف الموظف (تاب البيانات) | لم تبدأ | — | — | |
| P3 | الإجازات: الحاسبة + الأرصدة + الطلبات + السجل + اللوحة | لم تبدأ | — | — | |
| P4 | ملفات الموظف PDF + الرفع + المسح + استمارة الإجازة | لم تبدأ | — | — | |
| P5 | القرارات + مرفقاتها | لم تبدأ | — | — | |
| P6 | الاستيراد Excel ثم PDF | لم تبدأ | — | — | |
| P7 | الإعدادات + سنة جديدة + نسخ احتياطي + تصدير + المثبّت | لم تبدأ | — | — | |

الحالات المسموحة: لم تبدأ / جارية / تنفيذ مكتمل (مستني مراجعة) / تم (راجعه Claude) / تحتاج تصحيح

## الخطوة الجاية بالظبط
مراجعة P1b في `reports/P1b_GitHubCopilot_2026-10-01.md` ومراجعة الكود في `code/` ثم انتظار الموافقة من المالك/Claude. لا تبدأ P2 قبل الموافقة.

## تغييرات v1
اتضاف: معمارية وحدات (D10)، نظام تصميم فخم Light/Dark (D11-D16)، وتقسيم P1 إلى P1a/P1b (D17).

## مكان الكود
`code/` — مستودع GitHub: https://github.com/modyspeed/HR-System (عام) | آخر commit: `4988980` (tag `P1b` مرفوع) | آخر ZIP: —

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
- `code/electron/core/migrate.test.ts`, `code/electron/modules/index.test.ts`, `code/src/modules/index.test.ts` — اختبارات registry وترتيب migrations — مكتمل.
- `code/README.md` — تثبيت وتشغيل وبناء واختبار — مكتمل.
- `reports/P1a_GitHubCopilot_2026-10-01.md` — تقرير P1a — مكتمل.
- `reports/P1b_GitHubCopilot_2026-10-01.md` — تقرير P1b — مكتمل.

## مشاكل مفتوحة / ملاحظات المراجعة
- `npm install` أبلغ عن 4 ثغرات في الاعتماديات (2 متوسطة و2 عالية)؛ لم تُطبّق تحديثات تلقائية.
- تعارض بين طلب `docs/README.md` في P1a وقيد `AGENTS.md` على ملفات التوثيق خارج الملفات المسموح بها؛ أُنشئ `code/README.md` فقط، والمطلوب مراجعة المالك/Claude.

## افتراضات اتاخدت أثناء التنفيذ
- قاعدة البيانات محفوظة في Documents تحت `LeaveDeskData`، وبنية `app.getPath("documents")` هي أساس مسار المستخدم.
- SQL migrations مستوردة كـ raw assets محلية ليتضمنها build.
