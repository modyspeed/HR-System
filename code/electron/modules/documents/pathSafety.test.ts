import nodePath from "node:path";
import { describe, expect, it } from "vitest";
import {
  PathSafetyError,
  assertSafeFolderName,
  createPathTools,
  detectContentType,
  sanitizeFileName,
} from "./pathSafety";

describe("assertSafeFolderName (كود الموظف كاسم فولدر)", () => {
  it("يقبل الأكواد العادية والعربية", () => {
    expect(assertSafeFolderName("EMP-101")).toBe("EMP-101");
    expect(assertSafeFolderName("  موظف-7 ")).toBe("موظف-7");
    expect(assertSafeFolderName("ends ")).toBe("ends"); // المسافات الطرفية تُقصّ قبل الفحص
  });
  it.each(["../evil", "a/b", "a\\b", "C:", "a:b", "x*y", "a?b", "..", ".", ".hidden", "ends.", "", "   ", "con", "NUL", "com1", "LPT9.txt", "a\u0000b"])(
    "يرفض: %j",
    (value) => {
      expect(() => assertSafeFolderName(value)).toThrowError(PathSafetyError);
    },
  );
  it("يرفض الاسم الطويل جدًا", () => {
    expect(() => assertSafeFolderName("x".repeat(81))).toThrowError(PathSafetyError);
  });
});

describe("sanitizeFileName", () => {
  it("يأخذ الاسم فقط بدون أي مسار", () => {
    expect(sanitizeFileName("..\\..\\evil.pdf")).toBe("evil.pdf");
    expect(sanitizeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFileName("C:\\Users\\x\\عقد العمل.pdf")).toBe("عقد العمل.pdf");
  });
  it("يستبدل الرموز الممنوعة ويوحّد الامتداد صغيرًا", () => {
    expect(sanitizeFileName('a:b?c*.PDF')).toBe("a_b_c_.pdf");
    expect(sanitizeFileName("photo.JPG")).toBe("photo.jpg");
  });
  it("يتعامل مع الأسماء المحجوزة والنقاط والفراغات", () => {
    expect(sanitizeFileName("con.pdf")).toBe("_con.pdf");
    expect(sanitizeFileName("name.pdf. ")).toBe("name.pdf");
    expect(sanitizeFileName("...x.pdf")).toBe("x.pdf");
  });
  it("يرفض الامتدادات غير المسموحة والملف بلا امتداد", () => {
    for (const value of ["virus.exe", "script.js", "noext", "archive.pdf.exe", ".pdf", "a.html"]) {
      expect(() => sanitizeFileName(value)).toThrowError(expect.objectContaining({ code: "EXTENSION_NOT_ALLOWED" }));
    }
  });
  it("يقصّ الأسماء الطويلة ويحافظ على الامتداد", () => {
    const name = sanitizeFileName(`${"أ".repeat(300)}.pdf`);
    expect(name.endsWith(".pdf")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(124);
  });
});

for (const [label, platform, root] of [
  ["posix", nodePath.posix, "/data/employee_files"],
  ["win32", nodePath.win32, "C:\\Users\\Me\\Documents\\LeaveDeskData\\employee_files"],
] as const) {
  describe(`pathTools (${label})`, () => {
    const tools = createPathTools(platform);

    it("isInside: داخل وخارج وتشابه الأسماء", () => {
      expect(tools.isInside(root, platform.join(root, "EMP-1", "a.pdf"))).toBe(true);
      expect(tools.isInside(root, root)).toBe(true);
      expect(tools.isInside(root, `${root}-other${platform.sep}a.pdf`)).toBe(false);
      expect(tools.isInside(root, platform.join(root, "..", "x"))).toBe(false);
    });

    it("resolveInside: يبني مسارًا آمنًا ويرفض الهروب", () => {
      expect(tools.resolveInside(root, "EMP-1", "leaves", "f.pdf")).toBe(platform.join(root, "EMP-1", "leaves", "f.pdf"));
      for (const segments of [["..", "x"], ["EMP-1", "..", "..", "x"], ["a\u0000b"], [platform.resolve("/etc"), "passwd"], []]) {
        expect(() => tools.resolveInside(root, ...segments)).toThrowError(PathSafetyError);
      }
    });

    it("fromStoredRelative: يقبل النسبي الصحيح فقط", () => {
      expect(tools.fromStoredRelative(root, "EMP-1/leaves/f.pdf")).toBe(platform.join(root, "EMP-1", "leaves", "f.pdf"));
      for (const stored of ["../x.pdf", "EMP-1/../../x.pdf", "/etc/passwd", "\\windows\\x.pdf", "C:/x.pdf", "D:\\x.pdf", "EMP-1\\..\\..\\x.pdf", "a//b.pdf", "./a.pdf", "", "a\u0000.pdf"]) {
        expect(() => tools.fromStoredRelative(root, stored)).toThrowError(PathSafetyError);
      }
    });

    it("toStoredRelative: فواصل / دائمًا ويرفض الخارج", () => {
      expect(tools.toStoredRelative(root, platform.join(root, "EMP-1", "leaves", "f.pdf"))).toBe("EMP-1/leaves/f.pdf");
      expect(() => tools.toStoredRelative(root, platform.join(root, "..", "x.pdf"))).toThrowError(PathSafetyError);
    });
  });
}

describe("pathTools (win32): الأقراص وUNC والحالة", () => {
  const tools = createPathTools(nodePath.win32);
  const root = "C:\\LeaveDeskData\\employee_files";
  it("يرفض قرصًا آخر ومسار UNC", () => {
    expect(tools.isInside(root, "D:\\LeaveDeskData\\employee_files\\a.pdf")).toBe(false);
    expect(tools.isInside(root, "\\\\server\\share\\a.pdf")).toBe(false);
  });
  it("حالة الحروف لا تخدع الفحص في ويندوز", () => {
    expect(tools.isInside(root, "c:\\leavedeskdata\\EMPLOYEE_FILES\\EMP-1\\a.pdf")).toBe(true);
    expect(tools.isInside(root, "c:\\leavedeskdata\\employee_files\\..\\x.pdf")).toBe(false);
  });
});

describe("detectContentType", () => {
  it("يعرّف PDF وPNG وJPEG ويرفض غيرها", () => {
    expect(detectContentType(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
    expect(detectContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectContentType(Buffer.from("MZ\x90\x00 exe"))).toBeNull();
    expect(detectContentType(Buffer.from("<html>"))).toBeNull();
  });
});
