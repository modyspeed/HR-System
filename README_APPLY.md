# حزمة إصلاح P3 (من Claude)
فك الـ ZIP **داخل جذر المستودع** (فولدر HR System) ووافق على استبدال الملفات. المسارات داخل الحزمة نفس مسارات المستودع.

الملفات:
- code/electron/modules/leaves/migrations/003_request_year_days.sql (جديد)
- code/electron/modules/leaves/index.ts (تسجيل الـ migration)
- code/electron/modules/leaves/services/leaveCalculator.ts و balanceService.ts و leaveRequestService.ts (معدّلة)
- code/electron/modules/leaves/service.db.test.ts (تحميل migration 003)
- code/electron/modules/leaves/regression.db.test.ts (جديد، اختبارات الانحدار)
- docs/SCHEMA.sql و docs/DECISIONS.md (D22 إلى D25)

بعد الفك: npm run typecheck ثم npm test ثم npm run test:db ثم npm run build
المتوقع: test:db = 15 اختبار ناجح (employees 2 + leaves 6 + regression 6 + ...) ، والبناء ناجح.
