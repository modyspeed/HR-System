/**
 * Leave (الإجازات) catalog.
 *
 * `type` on the Leave row is one of these keys — every allowed kind under the
 * Egyptian Labour Law (Law 12 of 2003) plus the usual civil-service and
 * administrative additions (Civil Service Law 81 of 2016). Display strings
 * live in the i18n locales (`leaves.types.*` / `leaves.typeHints.*`); this
 * module pins the identity and order of the catalogue.
 */
export const LEAVE_TYPE_KEYS = [
  'annual', // إجازة سنوية — 21/30 يومًا بأجر كامل
  'casual', // عارضة — 7 أيام سنويًا بأجر كامل
  'sick', // مرضية — حتى 180 يومًا بتقرير طبي
  'maternity', // وضع — 90 يومًا بأجر كامل (حتى 4 مرات طوال الخدمة)
  'hajj', // أداء شعائر الحج — 30 يومًا مرة واحدة طوال الخدمة
  'companion', // مرافقة مريض — 7 أيام سنويًا بأجر كامل
  'unpaid', // بدون أجر — باتفاق الطرفين
  'sports', // رياضية — للممثِّلين للدولة في منافسات رسمية
  'compensatory', // تعويضية — مقابل ساعات عمل إضافية
  'marriage', // زواج — 3 أيام بأجر كامل (قانون الخدمة المدنية 81/2016)
  'mourning', // وفاة قريب — 3 أيام بأجر كامل (قانون الخدمة المدنية 81/2016)
  'exam' // امتحانات — لأداء الامتحانات وتوفيق أوضاع
] as const

export type LeaveTypeKey = (typeof LEAVE_TYPE_KEYS)[number]

export const LEAVE_STATUS_KEYS = ['pending', 'approved', 'rejected'] as const

export type LeaveStatusKey = (typeof LEAVE_STATUS_KEYS)[number]