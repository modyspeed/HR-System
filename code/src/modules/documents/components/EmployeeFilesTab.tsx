import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, FilesIcon, Plus, RefreshCw, FileWarning } from "lucide-react";
import { Button, Card, EmptyState, Skeleton, toast } from "../../../components/ui";
import type { DocumentReadResult, DocumentRecord, EmployeeFilesResult } from "../../../core/api/contracts";
import {
  ensureEmployeeFolder, listEmployeeFiles, openEmployeeFolder, pickAndAddDocument,
  readDocument, scanEmployeeFiles, unwrapApiResult,
} from "../../../core/api/ipcClient";
import { formatFileSize, groupDocuments } from "../utils";
import { PdfViewer } from "./PdfViewer";

interface EmployeeFilesTabProps {
  employeeId: number;
}

interface PreviewState {
  base64: string;
  mimeType: DocumentReadResult["mimeType"];
  fileName: string;
}

const GROUP_LABELS: Record<keyof ReturnType<typeof groupDocuments>, string> = {
  general: "ملفات عامة",
  leave_form: "استمارات الإجازات",
  decision: "مرفقات القرارات",
};

export function EmployeeFilesTab({ employeeId }: EmployeeFilesTabProps) {
  const [files, setFiles] = useState<EmployeeFilesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // listDocuments يمسح الفولدر تلقائيًا في الخلفية.
      const result = unwrapApiResult(await listEmployeeFiles(employeeId));
      setFiles(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل ملفات الموظف.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function createFolder() {
    setBusy(true);
    try {
      unwrapApiResult(await ensureEmployeeFolder(employeeId));
      toast.success("تم إنشاء فولدر الموظف.");
      await loadFiles();
    } catch (folderError) {
      toast.error(folderError instanceof Error ? folderError.message : "تعذر إنشاء الفولدر.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile() {
    setBusy(true);
    try {
      const result = unwrapApiResult(await pickAndAddDocument({ employeeId, category: "general" }));
      if (result.cancelled) {
        // ألغى المستخدم مربع الحوار: لا رسالة نجاح.
        setBusy(false);
        return;
      }
      if (result.added.length > 0) {
        toast.success(`تمت إضافة ${result.added.length} ملف${result.added.length > 1 ? "ات" : ""}.`);
      }
      for (const failure of result.errors) {
        toast.error(`${failure.fileName}: ${failure.message}`);
      }
      await loadFiles();
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "تعذر رفع الملفات.");
    } finally {
      setBusy(false);
    }
  }

  async function rescan() {
    setBusy(true);
    try {
      const result = unwrapApiResult(await scanEmployeeFiles(employeeId));
      if (result.added > 0) {
        toast.success(`تمت إضافة ${result.added} ملف من الفولدر.`);
      } else {
        toast.success("لا توجد ملفات جديدة لربطها.");
      }
      await loadFiles();
    } catch (scanError) {
      toast.error(scanError instanceof Error ? scanError.message : "تعذر مسح الفولدر.");
    } finally {
      setBusy(false);
    }
  }

  async function openFolder() {
    try {
      unwrapApiResult(await openEmployeeFolder(employeeId));
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : "تعذر فتح الفولدر.");
    }
  }

  async function openFile(document: DocumentRecord) {
    setPreview(null);
    setPreviewError(null);
    try {
      const read = unwrapApiResult(await readDocument(document.id));
      setPreview({ base64: read.base64, mimeType: read.mimeType, fileName: read.fileName });
    } catch (readError) {
      setPreviewError(readError instanceof Error ? readError.message : "تعذر قراءة الملف.");
    }
  }

  if (loading) {
    return (
      <div className="employee-files-tab" aria-label="جارٍ تحميل ملفات الموظف" role="status">
        <Skeleton className="files-list-skeleton" lines={5} />
        <Skeleton className="files-preview-skeleton" lines={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-files-tab">
        <div className="files-empty" role="alert">
          <EmptyState icon={FileWarning} title="تعذر تحميل الملفات" description={error} />
          <Button icon={<RefreshCw size={16} />} onClick={() => void loadFiles()}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  if (!files) return null;

  if (!files.folderExists) {
    return (
      <div className="employee-files-tab">
        <div className="files-empty">
          <EmptyState
            description="لا يوجد فولدر لهذا الموظف بعد. أنشئه لترفع ملفاته يدويًا."
            icon={FolderOpen}
            title="لا يوجد فولدر لهذا الموظف"
            action={(
              <Button disabled={busy} icon={<Plus size={16} />} onClick={() => void createFolder()} variant="primary">
                إنشاء الفولدر
              </Button>
            )}
          />
        </div>
      </div>
    );
  }

  const grouped = groupDocuments(files.files);
  const hasFiles = files.files.length > 0;

  return (
    <div className="employee-files-tab">
      <div className="files-actions">
        <Button disabled={busy} icon={<Plus size={16} />} onClick={() => void uploadFile()} variant="primary">
          رفع ملف
        </Button>
        <Button disabled={busy} icon={<FolderOpen size={16} />} onClick={() => void openFolder()}>
          فتح الفولدر
        </Button>
        <Button disabled={busy} icon={<RefreshCw size={16} />} onClick={() => void rescan()}>
          إعادة المسح
        </Button>
      </div>

      <div className="files-grid">
        <Card className="files-list-card" title={`ملفات ${files.employeeCode}`}>
          {hasFiles ? (
            <div className="files-groups">
              {(Object.keys(grouped) as Array<keyof typeof grouped>).map((groupKey) => {
                const group = grouped[groupKey];
                if (group.length === 0) return null;
                return (
                  <section className="files-group" key={groupKey}>
                    <h3 className="files-group-title">{GROUP_LABELS[groupKey]}</h3>
                    <ul className="files-list">
                      {group.map((document) => (
                        <li key={document.id}>
                          <button
                            className={`files-item${!document.exists ? " is-missing" : ""}`}
                            onClick={() => void openFile(document)}
                            type="button"
                          >
                            <FileText aria-hidden="true" size={17} className="files-item-icon" />
                            <span className="files-item-name" title={document.fileName}>{document.fileName}</span>
                            {!document.exists && (
                              <span className="files-item-missing"><FileWarning size={13} aria-hidden="true" /> مفقود</span>
                            )}
                            <span className="files-item-size">{formatFileSize(document.fileSize)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <EmptyState
              description="ارفع أول ملف لهذا الموظف، أو ضع الملفات في فولدره ثم اضغط «إعادة المسح»."
              icon={FilesIcon}
              title="لا توجد ملفات"
            />
          )}
        </Card>

        <Card className="files-preview-card" title="المعاينة">
          {preview ? (
            <PdfViewer base64={preview.base64} fileName={preview.fileName} mimeType={preview.mimeType} />
          ) : (
            <EmptyState
              description={previewError ?? "اختر ملفًا من القائمة لعرضه هنا."}
              icon={FileText}
              title={previewError ? "تعذر فتح الملف" : "لا يوجد ملف معروض"}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
