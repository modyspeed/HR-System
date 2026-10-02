import { describe, expect, it } from "vitest";
import {
  AppError,
  countLeaveDays,
  listDaysBetween,
  splitDaysByYear,
  type HolidayContext,
} from "./leaveCalculator";

// بيانات وهمية للاختبار فقط (موظف اختبار / عطلة اختبار وهمية).
const WEEKEND_FRIDAY_SATURDAY = [5, 6]; // الجمعة والسبت (الافتراضي في النظام)
const WEEKEND_SATURDAY_SUNDAY = [0, 6]; // السبت والأحد

describe("countLeaveDays — استبعاد العطلات", () => {
  it("يستبعد أيام العطلة الأسبوعية (الجمعة والسبت) من النطاق", () => {
    // 2025-05-05 الإثنين ... 2025-05-11 الأحد (7 أيام تقويمية)
    const days = countLeaveDays(
      "2025-05-05",
      "2025-05-11",
      WEEKEND_FRIDAY_SATURDAY,
      [],
      false,
    );

    expect(days).toBe(5);
  });

  it("يستبعد العطلة الرسمية الواقعة داخل الفترة", () => {
    // نفس نطاق الاختبار السابق مع عطلة رسمية وهمية يوم الثلاثاء 2025-05-06
    const days = countLeaveDays(
      "2025-05-05",
      "2025-05-11",
      WEEKEND_FRIDAY_SATURDAY,
      ["2025-05-06"],
      false,
    );

    expect(days).toBe(4);
  });

  it("لا يحتسب عطلة رسمية تقع في يوم عطلة أسبوعية مرتين", () => {
    // 2025-05-09 جمعة وعطلة رسمية في نفس الوقت → تستبعد مرة واحدة
    const days = countLeaveDays(
      "2025-05-05",
      "2025-05-11",
      WEEKEND_FRIDAY_SATURDAY,
      ["2025-05-09"],
      false,
    );

    expect(days).toBe(5);
  });
});

describe("countLeaveDays — احتساب العطلات", () => {
  it("يحتسب أيام العطلة الأسبوعية والعطلات الرسمية عندما countsWeekends = true", () => {
    const days = countLeaveDays(
      "2025-05-05",
      "2025-05-11",
      WEEKEND_FRIDAY_SATURDAY,
      ["2025-05-06"],
      true,
    );

    expect(days).toBe(7);
  });

  it("يوم واحد = يوم واحد لنطاق يوم واحد في يوم عمل", () => {
    expect(countLeaveDays("2025-05-05", "2025-05-05", WEEKEND_FRIDAY_SATURDAY, [], false)).toBe(1);
  });

  it("يوم واحد واقع في العطلة الأسبوعية = صفر عندما countsWeekends = false", () => {
    // 2025-05-09 جمعة
    expect(countLeaveDays("2025-05-09", "2025-05-09", WEEKEND_FRIDAY_SATURDAY, [], false)).toBe(0);
  });
});

describe("countLeaveDays — التحقق من المدخلات", () => {
  it("يرفض الترتيب المعكوس بخطأ واضح", () => {
    expect(() =>
      countLeaveDays("2025-05-11", "2025-05-05", WEEKEND_FRIDAY_SATURDAY, [], false),
    ).toThrowError(
      new AppError("INVALID_RANGE", "تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له."),
    );
  });

  it.each([
    ["تاريخ البداية", "2025-13-01"],
    ["تاريخ النهاية", "2025-05-32"],
    ["تاريخ البداية", "2025-02-30"],
    ["تاريخ النهاية", "موظف اختبار"],
  ])("يرفض التاريخ غير الصحيح في %s بخطأ واضح", (field, invalidDate) => {
    const other = field === "تاريخ البداية" ? "2025-05-05" : "2025-05-05";
    expect(() =>
      countLeaveDays(
        field === "تاريخ البداية" ? invalidDate : other,
        field === "تاريخ النهاية" ? invalidDate : other,
        WEEKEND_FRIDAY_SATURDAY,
        [],
        false,
      ),
    ).toThrowError(AppError);
  });
});

describe("splitDaysByYear — توزيع الطلب العابر لسنتين", () => {
  const request = { start: "2024-12-30", end: "2025-01-03" };

  it("يوزع الأيام على السنتين: يومان لـ2024 وثلاثة لـ2025 مع عطلة السبت والأحد", () => {
    const context: HolidayContext = {
      weekendDays: WEEKEND_SATURDAY_SUNDAY,
      holidays: [],
      countsWeekends: false,
    };

    expect(splitDaysByYear(request.start, request.end, context)).toEqual([
      { year: 2024, days: 2 },
      { year: 2025, days: 3 },
    ]);
  });

  it("يستبعد جمعة 2025-01-03 عند عطلة الجمعة والسبت فيطابق مجموع النصفين", () => {
    const context: HolidayContext = {
      weekendDays: WEEKEND_FRIDAY_SATURDAY,
      holidays: [],
      countsWeekends: false,
    };

    expect(splitDaysByYear(request.start, request.end, context)).toEqual([
      { year: 2024, days: 2 },
      { year: 2025, days: 2 },
    ]);
  });

  it("مجموع أنصاف السنوات يساوي countLeaveDays", () => {
    const context: HolidayContext = {
      weekendDays: WEEKEND_FRIDAY_SATURDAY,
      holidays: ["2025-01-01"],
      countsWeekends: false,
    };

    const parts = splitDaysByYear(request.start, request.end, context);
    const total = parts.reduce((sum, part) => sum + part.days, 0);

    expect(total).toBe(
      countLeaveDays(request.start, request.end, context.weekendDays, context.holidays, false),
    );
  });

  it("نطاق داخل سنة واحدة يعيد سنة واحدة فقط", () => {
    const context: HolidayContext = {
      weekendDays: WEEKEND_FRIDAY_SATURDAY,
      holidays: [],
      countsWeekends: false,
    };

    expect(splitDaysByYear("2025-03-01", "2025-03-09", context)).toEqual([
      { year: 2025, days: 6 },
    ]);
  });

  it("يرفض الترتيب المعكوس بخطأ واضح", () => {
    const context: HolidayContext = {
      weekendDays: WEEKEND_FRIDAY_SATURDAY,
      holidays: [],
      countsWeekends: false,
    };

    expect(() => splitDaysByYear("2025-01-05", "2024-12-30", context)).toThrowError(AppError);
  });
});

describe("listDaysBetween", () => {
  it("يولّد الأيام شاملةً الطرفين", () => {
    expect(listDaysBetween("2025-01-30", "2025-02-02")).toEqual([
      "2025-01-30",
      "2025-01-31",
      "2025-02-01",
      "2025-02-02",
    ]);
  });

  it("يولّد يومًا واحدًا لنطاق يوم واحد", () => {
    expect(listDaysBetween("2025-05-05", "2025-05-05")).toEqual(["2025-05-05"]);
  });

  it("يرفض التاريخ غير الصحيح", () => {
    expect(() => listDaysBetween("2025-05-05", "2025-05-40")).toThrowError(AppError);
  });
});
