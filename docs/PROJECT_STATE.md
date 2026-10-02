# حالة المشروع — LeaveDesk
آخر تحديث: 2026-10-01 (بواسطة: Claude بعد مراجعة P1a وP1b) — النسخة: v2

## الملخص في سطرين
برنامج ديسكتوب (Electron + React + SQLite) لحصر أرصدة الإجازات وملفات الموظفين (PDF) والقرارات، عربي RTL، أوفلاين.
المرحلة الحالية: **P1a تم، P1b تم مشروطًا (بانتظار فحص يدوي داخل Electron).** P2 وما بعدها لم تبدأ.

## جدول المراحل
| المرحلة | الوصف | الحالة | المنصة | تاريخ | ملاحظات |
|---|---|---|---|---|---|
| P0 | الخطة + التوثيق | تم | Claude | 2026-10-01 | |
| P1a | النواة التقنية: Electron + SQLite + migrations لكل وحدة + registry | تم (راجعه Claude) | GitHub Copilot | 2026-10-01 | تحققنا: 13 جدول مطابقة لـ SCHEMA.sql، البذور صحيحة، typecheck ✅، 7 اختبارات ✅. code/README.md مقبول بدل docs/README.md (D18) |
| P1b | نظام التصميم + Shell + دارك/لايت + لوحة التحكم النهائية | تم مشروطًا | GitHub Copilot | 2026-10-01 | الكود مطابق للتصميم (لا hex خارج tokens، reduced-motion، registry). ينقص فحص يدوي داخل Electron: حفظ الثيم بعد إعادة التشغيل + عدم الوميض + مطابقة الشكل |
| P2 | الموظفين CRUD + الأقسام + ملف الموظف (تاب البيانات) | لم تبدأ | — | — | |
| P3 | الإجازات: الحاسبة + الأرصدة + الطلبات + السجل + اللوحة | لم تبدأ | — | — | |
| P4 | ملفات الموظف PDF + الرفع + المسح + استمارة الإجازة | لم تبدأ | — | — | |
| P5 | القرارات + مرفقاتها | لم تبدأ | — | — | |
| P6 | الاستيراد Excel ثم PDF | لم تبدأ | — | — | |
| P7 | الإعدادات + سنة جديدة + نسخ احتياطي + تصدير + المثبّت | لم تبدأ | — | — | |

الحالات المسموحة: لم تبدأ / جارية / تنفيذ مكتمل (مستني مراجعة) / تم (راجعه Claude) / تحتاج تصحيح

## الخطوة الجاية بالظبط
1) المالك يجري الفحص اليدوي داخل Electron لـ P1b (4 خطوات في رد Claude). 2) بعد تأكيده تبدأ P2 برسالة جاهزة من Claude. لا تبدأ P2 قبل ذلك.

## تغييرات v1
اتضاف: معمارية وحدات (D10)، نظام تصميم فخم Light/Dark (D11-D16)، وتقسيم P1 إلى P1a/P1b (D17).

## مكان الكود
`code/` — مستودع GitHub: https://github.com/modyspeed/HR-System (عام) | آخر commit: `2d0797a` (tags: `P1a`, `P1b`) | آخر ZIP: —

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
- (محلول) تعارض docs/README.md مع AGENTS.md: القرار D18 = code/README.md هو المعتمد.
- fallback غياب `window.leaveDesk` في المتصفح للمعاينة فقط؛ من P2 أي عملية بيانات لازم تفشل بوضوح خارج Electron ولا تحفظ وهميًا (D19).
- لا يوجد اختبار على SQLite حقيقي (الاختبارات الحالية mocks)؛ better-sqlite3 مبني لـ Electron بسبب postinstall. المطلوب في P2 حل (D21).
- لا CSP في index.html (السكربت المبكر inline): يُضاف لاحقًا بـ hash.
- core/ipc.ts يقرأ جدول employees مباشرة (تداخل بين النواة والوحدة): يُنقل لوحدة employees في P2.
- ملاحظات P7: single-instance lock، إغلاق قاعدة البيانات عند الخروج، npm audit (4 ثغرات).
- (محلول — D20) القسم إجباري والمسمى اختياري، يُطبَّق في طبقة التحقق لا في SCHEMA.

## افتراضات اتاخدت أثناء التنفيذ
- قاعدة البيانات محفوظة في Documents تحت `LeaveDeskData`، وبنية `app.getPath("documents")` هي أساس مسار المستخدم.
- SQL migrations مستوردة كـ raw assets محلية ليتضمنها build.
