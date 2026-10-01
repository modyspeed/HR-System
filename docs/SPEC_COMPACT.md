# LeaveDesk — المواصفات المختصرة (للمنصات ذات السياق الصغير)

## ايه هو
برنامج ديسكتوب ويندوز، أوفلاين، عربي RTL، **معماري بوحدات (Modules) قابل للتوسع**. الوحدات الحالية: موظفين + أرصدة إجازات وطلبات مع استمارة + ملف PDF لكل موظف + قرارات + استيراد Excel/PDF. تصميم فخم Light + Dark.

## التقنيات (ثابتة)
Electron + React + Vite + TypeScript | Bootstrap 5.3 RTL (مع data-bs-theme) + tokens.css مخصص | SQLite (better-sqlite3) | exceljs | pdfjs-dist | date-fns | zod | framer-motion | lucide-react | recharts | cmdk | sonner | electron-builder | vitest.
أمان: contextIsolation=true، nodeIntegration=false، كل الوصول للملفات/DB عبر IPC في preload بقنوات محددة. بدون CDN وبدون إنترنت وقت التشغيل.

## المعمارية
نواة (Shell، ثيم، DB+migrations، إعدادات، audit، ملفات، استيراد/تصدير، نسخ احتياطي، بحث Ctrl+K) + وحدات: employees, leaves, documents, decisions. الوحدة تُسجَّل في registry وتقدّم: routes, nav, dashboardWidgets, employeeTabs, settingsSections, importEntities, migrations, IPC. التفاصيل: ARCHITECTURE_MODULES.md.

## الهيكل
```
electron/ core/{db,migrate,settings,audit,files,importEngine,exportEngine,backup,moduleRegistry}.ts
          modules/<id>/{index.ts,ipc.ts,services/,migrations/}   main.ts  preload.ts
src/      core/{shell,theme,ui,i18n,api}   modules/<id>/{index.tsx,pages/,components/}   main.tsx
resources/ fonts/ icon templates/    docs/ README.md USER_GUIDE.md
```
بيانات المستخدم (قابلة للتغيير): `LeaveDeskData/` = leavedesk.db + backups/ + employee_files/<الكود>/(leaves/, decisions/) + imports/.

## التصميم
كل التفاصيل في DESIGN_SYSTEM.md: Sidebar يمين + Topbar (بحث Ctrl+K، إشعارات، زر ثيم)، توكنز ألوان، دارك/لايت/system بدون وميض، خط Cairo محلي، أرقام غربية، حركة خفيفة، حالات تحميل/فارغ/خطأ. **كل شاشة لازم تشتغل في الوضعين.**

## قاعدة البيانات
SCHEMA.sql بالظبط. التواريخ ISO وتُعرض dd-mm-yyyy. مسارات الملفات نسبية فقط.

## الشاشات
لوحة التحكم | الموظفين | ملف الموظف (تابات: البيانات / ملف PDF / الإجازات والاستمارات / القرارات) | طلب إجازة | سجل الإجازات | الاستيراد | الإعدادات (عام، المظهر، الأرصدة، العطلات، الملفات، النسخ الاحتياطي، الوحدات).

## قواعد العمل
1. الأيام = من..إلى شاملة الطرفين، تستبعد العطلة الأسبوعية (weekend_days، افتراضي 5,6 = الجمعة والسبت بترقيم JS getDay) والعطلات الرسمية (holidays)، إلا لو النوع counts_weekends=1.
2. المتبقي = entitlement + carried_over + adjustment − أيام approved (نوع+سنة). pending = محجوزة.
3. رفض الطلب لو الأيام > المتاح (للأنواع اللي بتخصم) إلا بـ "تجاوز بسبب" في audit_log.
4. منع تداخل طلبات نفس الموظف.
5. طلب يعبر نهاية السنة: الخصم يتوزع على السنتين.
6. إلغاء approved يرجّع الرصيد. الحالات: pending→approved/rejected، approved→cancelled.
7. تنبيه الأرصدة: اعتيادي متبقي ≤ low_balance_threshold.
8. النوع requires_attachment لا يُعتمد بدون مرفق.
9. أرقام الاستحقاق من leave_types/settings، **ممنوع كتابتها في الكود**.
10. الحذف ناعم. أي تعديل مهم → audit_log.

## ملفات الموظف
اسم الفولدر = كود الموظف (يقبل الرقم فقط مع code_prefix). عام في الجذر، leaves/ للاستمارات، decisions/ لمرفقات القرارات. "مزامنة" تمسح وتربط (added_via=folder_scan) وتعرض فولدرات بأكواد غير معروفة. حماية من path traversal.

## الاستيراد
Excel: قالب + ربط أعمدة، تواريخ yyyy-mm-dd و dd/mm/yyyy وأرقام Excel، تكرار = تخطي/تحديث، معاينة إجبارية، transaction واحدة، تقرير. PDF: نصي فقط + معاينة إجبارية؛ الممسوح مرفوض برسالة. المحرك عام (importEntities) عشان وحدات المستقبل.

## جودة
عربي كامل (النصوص من i18n)، تأكيد قبل الحذف، لا logging للأسماء/الأرقام القومية، كود كامل لكل ملف في التسليم.
