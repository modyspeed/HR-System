# P1a — النواة التقنية (بدون تصميم متقدم)
المدخلات: RESUME_PROMPT.md + SPEC_COMPACT.md + ARCHITECTURE_MODULES.md + SCHEMA.sql
المطلوب:
1. مشروع Electron + Vite + React + TS بالهيكل في SPEC_COMPACT (core + modules + placeholders).
2. اتصال SQLite + migration runner لكل وحدة (جدول schema_migrations) يشغّل تلقائيًا عند أول تشغيل، بترتيب dependsOn. وزّع جداول SCHEMA.sql على الوحدات حسب ARCHITECTURE_MODULES.md (core: settings, audit_log, import_batches, app_modules, schema_migrations) ثم الـ seed.
3. moduleRegistry في الجهتين (electron و src) وتسجيل الوحدات الأربع كهياكل فاضية (routes + nav بسيط).
4. إنشاء LeaveDeskData (employee_files, backups, imports) في مجلد المستندات.
5. preload آمن + ipcClient بأنواع TS + قناة تجريبية: عدد الموظفين + قائمة الوحدات المفعلة.
6. Bootstrap 5.3 RTL شغال بشكل أساسي (من غير تخصيص تصميم، ده في P1b)، وصفحة بسيطة تعرض عدد الموظفين ووحدات التطبيق.
7. docs/README.md: install / dev / build.
شروط القبول:
- [ ] npm run dev يفتح نافذة عربية RTL
- [ ] leavedesk.db تتكون بكل الجداول وبيانات leave_types وapp_modules
- [ ] الصفحة تعرض 0 موظفين وأسماء الوحدات الأربع من registry
- [ ] contextIsolation=true و nodeIntegration=false، ولا CDN
ممنوع: أي شاشة وظيفية أو تصميم متقدم.
