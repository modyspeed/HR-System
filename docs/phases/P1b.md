# P1b — نظام التصميم والـ Shell والدارك مود
المدخلات: الكود الحالي (P1a مقبولة) + DESIGN_SYSTEM.md + ARCHITECTURE_MODULES.md + SPEC_COMPACT.md
المطلوب:
1. src/styles/tokens.css بالتوكنز كلها (Light/Dark) + ربطها بمتغيرات Bootstrap عبر data-bs-theme + خط Cairo محلي + أرقام غربية.
2. نظام الثيم: system/light/dark، حفظه في settings، بدون وميض (BrowserWindow.backgroundColor + nativeTheme.themeSource + سكربت مبكر في index.html)، زر شمس/قمر في Topbar.
3. Shell: Sidebar يمين قابل للطي (يتولد من registry) + Topbar (مربع بحث Ctrl+K بـ cmdk فيه الشاشات كبداية، إشعارات placeholder، زر الثيم، أفاتار) + حركة انتقال الصفحات (framer-motion).
4. مكونات ui الأساسية: Button, Input, Select, Card, StatCard (count-up), Badge/StatusPill, Tabs (خط متحرك), Modal, Drawer, ConfirmDialog, Toast (sonner), Skeleton, EmptyState, DataTable (فرز + hover + skeleton).
5. صفحة داخلية "معرض المكونات" (/design) تعرض كل المكونات في الوضعين لأغراض المراجعة.
6. لوحة التحكم بتصميمها النهائي ببيانات تجريبية (كروت + مخطط أعمدة + دونات) متصلة بالثيم.
شروط القبول (انظر DESIGN_SYSTEM.md قسم 10):
- [ ] التبديل بين Light وDark وsystem يشتغل ويتحفظ بعد إعادة التشغيل
- [ ] لا وميض أبيض عند فتح البرنامج في Dark
- [ ] لوحة التحكم تطابق الصورة المرجعية روحًا وتفصيلًا
- [ ] Sidebar تتطوى وتتولد من registry
- [ ] لا hex مكتوب في أي مكون (توكنز فقط)
- [ ] reduced-motion محترم
- في التقرير: وصف/لقطتين للوحة التحكم (Light وDark).
