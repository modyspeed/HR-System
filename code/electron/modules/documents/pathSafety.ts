/**
 * LeaveDesk — حماية المسارات وأسماء الملفات (دوال نقية بدون تعديل على القرص).
 * كل ما يخص مسارات ملفات الموظفين يمر من هنا فقط. ممنوع بناء مسار بـ string concatenation في أي مكان آخر.
 * كُتبت ليعمل منطقها على ويندوز ولينكس؛ والاختبارات تغطي path.win32 وpath.posix معًا.
 */
import nodePath from "node:path";
import type { PlatformPath } from "node:path";

export class PathSafetyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PathSafetyError";
  }
}

export const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"] as const;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
// eslint-disable-next-line no-control-regex
const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;
// eslint-disable-next-line no-control-regex
const ILLEGAL_CHARS_GLOBAL = /[<>:"/\\|?*\u0000-\u001f]/g;

/** اسم فولدر الموظف (كود الموظف): يُرفض أي شيء يمكن أن يخرج من الجذر أو يخالف قواعد ويندوز. */
export function assertSafeFolderName(raw: string): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name === "") throw new PathSafetyError("FOLDER_NAME_INVALID", "كود الموظف فارغ ولا يصلح اسمًا للفولدر.");
  if (name.length > 80) throw new PathSafetyError("FOLDER_NAME_INVALID", "كود الموظف طويل جدًا ولا يصلح اسمًا للفولدر.");
  if (ILLEGAL_CHARS.test(name)) {
    throw new PathSafetyError("FOLDER_NAME_INVALID", "كود الموظف يحتوي رموزًا غير مسموحة في أسماء الفولدرات (/ \\ : * ? \" < > |).");
  }
  if (name.startsWith(".") || /[. ]$/.test(name)) {
    throw new PathSafetyError("FOLDER_NAME_INVALID", "كود الموظف لا يجوز أن يبدأ بنقطة أو ينتهي بنقطة أو مسافة.");
  }
  if (WINDOWS_RESERVED.test(name.split(".")[0] ?? "")) {
    throw new PathSafetyError("FOLDER_NAME_INVALID", "كود الموظف اسم محجوز في ويندوز ولا يصلح اسمًا للفولدر.");
  }
  return name;
}

/** تنظيف اسم الملف المرفوع: يأخذ الاسم فقط (بدون أي مسار)، ويُبقي الامتداد المسموح فقط. */
export function sanitizeFileName(raw: string): string {
  const base = String(raw ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(ILLEGAL_CHARS_GLOBAL, "_").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  const extension = nodePath.extname(cleaned).toLowerCase();
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new PathSafetyError("EXTENSION_NOT_ALLOWED", "نوع الملف غير مسموح. المسموح: PDF أو PNG أو JPG.");
  }
  let stem = cleaned.slice(0, cleaned.length - extension.length).replace(/^\.+/, "").replace(/[. ]+$/, "").trim();
  if (stem === "") stem = "ملف";
  if (WINDOWS_RESERVED.test(stem)) stem = `_${stem}`;
  if (stem.length > 120) stem = stem.slice(0, 120).trim();
  return `${stem}${extension}`;
}

export function createPathTools(p: PlatformPath = nodePath) {
  /** هل target داخل root (أو يساويه)؟ يتعامل مع اختلاف الأقراص وUNC وحالة الحروف حسب النظام. */
  function isInside(root: string, target: string): boolean {
    const relative = p.relative(p.resolve(root), p.resolve(target));
    if (relative === "") return true;
    if (p.isAbsolute(relative)) return false;
    return relative !== ".." && !relative.startsWith(`..${p.sep}`);
  }

  /** يبني مسارًا مطلقًا من أجزاء ويضمن أنه داخل root، وإلا يرمي PATH_OUTSIDE_ROOT. */
  function resolveInside(root: string, ...segments: string[]): string {
    for (const segment of segments) {
      if (typeof segment !== "string" || segment.includes("\0")) {
        throw new PathSafetyError("PATH_OUTSIDE_ROOT", "مسار غير صالح.");
      }
    }
    const resolved = p.resolve(root, ...segments);
    if (!isInside(root, resolved) || p.resolve(root) === resolved) {
      throw new PathSafetyError("PATH_OUTSIDE_ROOT", "المسار خارج مجلد ملفات الموظفين المسموح.");
    }
    return resolved;
  }

  /** المسار المخزَّن في القاعدة: نسبي لجذر employee_files وبفواصل "/" دائمًا. */
  function toStoredRelative(root: string, absolutePath: string): string {
    if (!isInside(root, absolutePath)) throw new PathSafetyError("PATH_OUTSIDE_ROOT", "المسار خارج مجلد ملفات الموظفين المسموح.");
    return p.relative(p.resolve(root), p.resolve(absolutePath)).split(p.sep).join("/");
  }

  /** يحوّل مسارًا مخزَّنًا (من القاعدة) إلى مسار مطلق آمن. يرفض المطلق و.. والأقراص والفواصل المعكوسة. */
  function fromStoredRelative(root: string, stored: string): string {
    if (typeof stored !== "string" || stored === "" || stored.includes("\0")) {
      throw new PathSafetyError("PATH_OUTSIDE_ROOT", "مسار الملف المخزَّن غير صالح.");
    }
    if (stored.startsWith("/") || stored.startsWith("\\") || /^[a-zA-Z]:/.test(stored)) {
      throw new PathSafetyError("PATH_OUTSIDE_ROOT", "مسار الملف المخزَّن غير صالح.");
    }
    const segments = stored.split(/[\\/]/);
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new PathSafetyError("PATH_OUTSIDE_ROOT", "مسار الملف المخزَّن غير صالح.");
    }
    return resolveInside(root, ...segments);
  }

  return { isInside, resolveInside, toStoredRelative, fromStoredRelative };
}

export const pathTools = createPathTools();

/** يتأكد أن المسار الحقيقي (بعد حل الروابط الرمزية/Junctions) ما زال داخل الجذر الحقيقي. */
export function assertRealPathInside(
  fsApi: { existsSync(path: string): boolean; realpathSync(path: string): string },
  root: string,
  target: string,
): void {
  const realRoot = fsApi.realpathSync(root);
  let probe = target;
  while (!fsApi.existsSync(probe)) {
    const parent = nodePath.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const realProbe = fsApi.realpathSync(probe);
  if (!pathTools.isInside(realRoot, realProbe)) {
    throw new PathSafetyError("PATH_OUTSIDE_ROOT", "الملف يشير إلى موقع خارج مجلد ملفات الموظفين (رابط رمزي).");
  }
}

/** يتحقق أن محتوى الملف يطابق امتداده (PDF/PNG/JPEG) من البايتات الأولى. */
export function detectContentType(head: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (head.length >= 5 && head.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  return null;
}

export function expectedContentType(fileName: string): "application/pdf" | "image/png" | "image/jpeg" {
  const extension = nodePath.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  return "image/jpeg";
}
