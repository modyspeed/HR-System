# معمارية الوحدات (Modules) — عشان نوسّع المشروع لمهام تانية

## الفكرة
البرنامج = **نواة (Core)** + **وحدات (Modules)** مستقلة. أي وحدة جديدة (حضور وانصراف، سلف، تدريب، أصول، مرتبات...) تتضاف بدون لمس كود الوحدات التانية.

## النواة (ثابتة)
Shell (Sidebar/Topbar/Router) • نظام الثيم • اتصال DB وmigrations لكل وحدة • الإعدادات • audit_log • خدمة الملفات (employee_files + المعاينة + الرفع) • محرك الاستيراد (Excel/PDF بربط أعمدة) • محرك التصدير • النسخ الاحتياطي • بحث Ctrl+K • الإشعارات • i18n (عربي افتراضي، النصوص في src/i18n/ar.ts عشان إضافة لغة لاحقًا) • سجل الوحدات.

## الوحدات الحالية
| الوحدة | تحتوي |
|---|---|
| employees | departments, employees + شاشات الموظفين وملف الموظف (الهيكل الأساسي اللي الوحدات التانية بتتعلق به) |
| leaves | leave_types, leave_balances, leave_requests, holidays + الحاسبة + شاشات الطلب والسجل |
| documents | employee_documents + الشجرة والمعاينة والرفع والمزامنة |
| decisions | decisions + تاب القرارات |
| (core) | settings, audit_log, import_batches, app_modules, schema_migrations |

## عقد الوحدة (interface)
```ts
export interface AppModule {
  id: string;                          // 'leaves'
  nameAr: string; icon: string; order: number;
  dependsOn?: string[];                // ['employees']
  migrationsDir: string;               // db/migrations/<id>/
  registerIpc(ctx: ModuleContext): void;
  routes: RouteObject[];
  nav: { path: string; labelAr: string; icon: string }[];
  dashboardWidgets?: { id: string; component: React.FC; span?: 1|2 }[];
  employeeTabs?: { id: string; labelAr: string; component: React.FC<{employeeId:number}> }[];
  settingsSections?: { id: string; labelAr: string; component: React.FC }[];
  importEntities?: ImportEntityConfig[];   // يظهر في معالج الاستيراد
  searchProviders?: SearchProvider[];      // يظهر في Ctrl+K
  reports?: ReportConfig[];                // يظهر في التصدير
}
```
- ملف `src/modules/index.ts` و`electron/modules/index.ts` فيهم **registry** (مصفوفة الوحدات). الـ Sidebar والـ Router وتابات ملف الموظف ولوحة التحكم والإعدادات كلها تتولد منه.
- جدول `app_modules(key, enabled)` يسمح بتفعيل/تعطيل وحدة من الإعدادات (قسم الوحدات).
- جدول `schema_migrations(module, name, applied_at)`: كل وحدة لها فولدر migrations خاص ومرقم، والـ runner يشغّلها بترتيب dependsOn.

## هيكل المجلدات المحدّث
```
electron/
  core/ (db.ts, migrate.ts, settings.ts, audit.ts, files.ts, importEngine.ts, exportEngine.ts, backup.ts, moduleRegistry.ts)
  modules/<id>/ (index.ts, ipc.ts, services/*, migrations/*.sql)
src/
  core/ (shell/, theme/, ui/, i18n/, api/ipcClient.ts)
  modules/<id>/ (index.tsx, pages/*, components/*)
```

## قواعد توسعة
1. وحدة جديدة = فولدر جديد + سطر في registry + migrations خاصة بها. ممنوع تعديل جداول وحدة أخرى؛ للربط استخدم foreign keys للـ employees فقط.
2. الملفات المرتبطة بكيان جديد: استخدم خدمة الملفات في النواة (فولدر الكيان تحت employee_files أو فولدر مستقل بنفس الأسلوب، مسارات نسبية).
3. أي وحدة تحتاج استيراد/تصدير تسجّل إعدادها ولا تكتب منطق جديد.
4. أي نص ظاهر للمستخدم يكون من ملف i18n.
5. الوحدات المقترحة للمستقبل (للمرجعية فقط، غير مطلوبة الآن): حضور وانصراف، سلف وقروض، جزاءات، تدريب، عهد وأصول، مرتبات وحوافز، مستخدمون وصلاحيات.
