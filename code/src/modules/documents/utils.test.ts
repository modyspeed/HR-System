import { describe, expect, it } from "vitest";
import type { DocumentRecord } from "../../core/api/contracts";
import { base64ToUint8Array, formatFileSize, groupDocuments } from "./utils";

function makeDocument(overrides: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: 1,
    employeeId: 10,
    category: "general",
    relatedLeaveId: null,
    relatedDecisionId: null,
    fileName: "file.pdf",
    relativePath: "EMP-10/file.pdf",
    fileSize: 100,
    addedVia: "upload",
    createdAt: "2026-01-01",
    exists: true,
    ...overrides,
  };
}

describe("base64ToUint8Array", () => {
  it("decodes base64 into matching bytes", () => {
    const bytes = base64ToUint8Array("SGVsbG8=");
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("returns an empty array for an empty string", () => {
    expect(base64ToUint8Array("").length).toBe(0);
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kilobytes and megabytes in Arabic", () => {
    expect(formatFileSize(0)).toBe("0 بايت");
    expect(formatFileSize(512)).toBe("512 بايت");
    expect(formatFileSize(340)).toBe("340 بايت");
    expect(formatFileSize(1024)).toBe("1.0 ك.ب");
    expect(formatFileSize(340_000)).toBe("332 ك.ب");
    expect(formatFileSize(1_200_000)).toBe("1.1 م.ب");
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.0 ج.ب");
  });

  it("rounds large kilobytes without decimals", () => {
    expect(formatFileSize(100 * 1024)).toBe("100 ك.ب");
  });

  it("returns a dash for missing sizes", () => {
    expect(formatFileSize(null)).toBe("—");
  });
});

describe("groupDocuments", () => {
  it("groups files by category and sorts file names", () => {
    const grouped = groupDocuments([
      makeDocument({ id: 1, category: "leave_form", fileName: "b.pdf" }),
      makeDocument({ id: 2, category: "general", fileName: "z.pdf" }),
      makeDocument({ id: 3, category: "general", fileName: "a.pdf" }),
      makeDocument({ id: 4, category: "decision", fileName: "q.pdf" }),
      makeDocument({ id: 5, category: "leave_form", fileName: "a.pdf" }),
    ]);
    expect(grouped.general.map((file) => file.id)).toEqual([3, 2]);
    expect(grouped.leave_form.map((file) => file.id)).toEqual([5, 1]);
    expect(grouped.decision.map((file) => file.id)).toEqual([4]);
  });

  it("ignores import_source documents", () => {
    const grouped = groupDocuments([
      makeDocument({ id: 6, category: "import_source", fileName: "sheet.xlsx" }),
    ]);
    expect(grouped.general).toHaveLength(0);
    expect(grouped.leave_form).toHaveLength(0);
    expect(grouped.decision).toHaveLength(0);
  });

  it("returns empty groups for an empty list", () => {
    const grouped = groupDocuments([]);
    expect(grouped.general).toHaveLength(0);
    expect(grouped.leave_form).toHaveLength(0);
    expect(grouped.decision).toHaveLength(0);
  });
});
