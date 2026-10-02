/**
 * LeaveDesk — حاسبة أيام الإجازة (دوال نقية).
 * جميع التواريخ بصيغة ISO yyyy-mm-dd، والعمليات الحسابية تتم على التوقيت العالمي (UTC)
 * لتجنب أي تأثير لتحويل التوقيت الصيفي/الشتوي على عدد الأيام.
 * لا يوجد أي استيراد من Electron؛ كل القيم (أيام العطلة الأسبوعية، العطلات الرسمية،
 * احتساب العطلات) تأتي من المتصل/الإعدادات.
 */

export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export interface HolidayContext {
  /** أرقام أيام العطلة الأسبوعية وفق ترقيم JS Date#getDay (0=الأحد ... 6=السبت). */
  readonly weekendDays: readonly number[];
  /** تواريخ العطلات الرسمية بصيغة yyyy-mm-dd. */
  readonly holidays: readonly string[];
  /** true = احتساب أيام العطلة الأسبوعية والعطلات الرسمية ضمن أيام الإجازة. */
  readonly countsWeekends: boolean;
}

export interface YearDays {
  year: number;
  days: number;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLIS_PER_DAY = 86_400_000;

function parseUtc(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = parseUtc(value);
  return !Number.isNaN(date.valueOf()) && toIsoDate(date) === value;
}

function assertIsoDate(value: string, field: string): Date {
  if (!isValidIsoDate(value)) {
    throw new AppError(
      "INVALID_DATE",
      `${field} غير صحيح؛ يجب أن يكون تاريخًا صحيحًا بصيغة yyyy-mm-dd.`,
    );
  }
  return parseUtc(value);
}

function assertValidRange(startDate: Date, endDate: Date): void {
  if (endDate < startDate) {
    throw new AppError(
      "INVALID_RANGE",
      "تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له.",
    );
  }
}

function normalizeHolidays(holidays: readonly string[]): Set<string> {
  return new Set(holidays.map((holiday) => String(holiday).slice(0, 10)));
}

/**
 * يولّد قائمة الأيام بين تاريخين شاملةً الطرفين، دون أي استبعاد (للاختبار والعرض).
 */
export function listDaysBetween(start: string, end: string): string[] {
  const startDate = assertIsoDate(start, "تاريخ البداية");
  const endDate = assertIsoDate(end, "تاريخ النهاية");
  assertValidRange(startDate, endDate);

  const days: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function countDaysInRange(startDate: Date, endDate: Date, context: HolidayContext): number {
  if (context.countsWeekends) {
    return Math.round((endDate.getTime() - startDate.getTime()) / MILLIS_PER_DAY) + 1;
  }
  const weekendDays = new Set(context.weekendDays);
  const holidays = normalizeHolidays(context.holidays);

  let count = 0;
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    if (!weekendDays.has(cursor.getUTCDay()) && !holidays.has(toIsoDate(cursor))) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * يحسب أيام الإجازة بين تاريخين شاملةً الطرفين.
 * يستبعد أيام العطلة الأسبوعية والعطلات الرسمية، إلا إذا كان countsWeekends = true
 * فتُحتسب جميع الأيام التقويمية.
 */
export function countLeaveDays(
  start: string,
  end: string,
  weekendDays: readonly number[],
  holidays: readonly string[],
  countsWeekends: boolean,
): number {
  const startDate = assertIsoDate(start, "تاريخ البداية");
  const endDate = assertIsoDate(end, "تاريخ النهاية");
  assertValidRange(startDate, endDate);

  return countDaysInRange(startDate, endDate, { weekendDays, holidays, countsWeekends });
}

/**
 * يوزع أيام الطلب العابر لحدود السنة على كل سنة تقويمية،
 * بنفس قواعد استبعاد العطلات الأسبوعية والرسمية.
 * الناتج يحتوي السنوات التي لها أيام محتسبة فقط.
 */
export function splitDaysByYear(start: string, end: string, context: HolidayContext): YearDays[] {
  const startDate = assertIsoDate(start, "تاريخ البداية");
  const endDate = assertIsoDate(end, "تاريخ النهاية");
  assertValidRange(startDate, endDate);

  const result: YearDays[] = [];
  const firstYear = startDate.getUTCFullYear();
  const lastYear = endDate.getUTCFullYear();

  for (let year = firstYear; year <= lastYear; year += 1) {
    const rangeStart = year === firstYear ? startDate : new Date(Date.UTC(year, 0, 1));
    const rangeEnd = year === lastYear ? endDate : new Date(Date.UTC(year, 11, 31));
    const days = countDaysInRange(rangeStart, rangeEnd, context);
    if (days > 0) result.push({ year, days });
  }

  return result;
}
