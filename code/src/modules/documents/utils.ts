import type { DocumentRecord } from "../../core/api/contracts";

/** يحوّل سلسلة base64 إلى Uint8Array لتمريرها لـ pdfjs (العملية الوحيدة التي تتعامل مع البايتات). */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export interface GroupedDocuments {
  general: DocumentRecord[];
  leave_form: DocumentRecord[];
  decision: DocumentRecord[];
}

const GROUP_ORDER: Array<keyof GroupedDocuments> = ["general", "leave_form", "decision"];

/** يجمّع ملفات الموظف في ثلاث مجموعات حسب التصنيف (يُتجاهل import_source لأنه ليس ملفًا معروضًا). */
export function groupDocuments(files: DocumentRecord[]): GroupedDocuments {
  const grouped: GroupedDocuments = { general: [], leave_form: [], decision: [] };
  for (const file of files) {
    if (file.category === "general") grouped.general.push(file);
    else if (file.category === "leave_form") grouped.leave_form.push(file);
    else if (file.category === "decision") grouped.decision.push(file);
  }
  for (const key of GROUP_ORDER) {
    grouped[key].sort((a, b) => a.fileName.localeCompare(b.fileName, "ar"));
  }
  return grouped;
}

/** صيغة عربية لحجم الملف: بايت/ك.ب/م.ب/ج.ب بحد أقصى رقم عشري واحد. */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} بايت`;
  const units = ["ك.ب", "م.ب", "ج.ب"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
