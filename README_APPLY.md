# حزمة P4 (الخلفية الحساسة أمنيًا) — من Claude
فك الـ ZIP **داخل جذر المستودع** (المسارات جواه نفس مسارات المستودع).

كلها ملفات جديدة داخل code/electron/modules/documents/ (عدا docs/DECISIONS.md المحدّث بـ D26 إلى D28):
- pathSafety.ts / pathSafety.test.ts — حماية المسارات وأسماء الملفات (36 اختبار، تغطي ويندوز ولينكس)
- services/fileService.ts / fileService.db.test.ts — الفولدرات والرفع والمسح والقراءة (10 اختبارات على SQLite وفولدرات حقيقية)
- ipc.ts / schemas.ts / errors.ts — قنوات IPC (تحتاج ربطها بالمضيف Electron: مهمة المنصة P4.1)

لا تعدّل هذه الملفات. اربطها فقط.
