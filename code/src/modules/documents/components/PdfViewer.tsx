import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileWarning, Maximize, Minus, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { Button, IconButton } from "../../../components/ui";
import { pdfjs } from "../pdfSetup";
import { base64ToUint8Array } from "../utils";
import type { DocumentMimeType } from "../../../core/api/contracts";

interface PdfViewerProps {
  base64: string;
  mimeType: DocumentMimeType;
  fileName: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

export function PdfViewer({ base64, mimeType, fileName }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isImage = mimeType !== "application/pdf";

  const renderPage = useCallback(async (page: pdfjs.PDFPageProxy, targetScale: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const outputScale = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: targetScale });
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    const renderTask = page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
    });
    renderTaskRef.current = renderTask;
    await renderTask.promise;
  }, []);

  // تحميل المستند عند تغيّر الملف، مع إلغاء أي رسم قديم وتدمير المستند السابق.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageNumber(1);

    async function loadDocument() {
      try {
        const task = pdfjs.getDocument({ data: base64ToUint8Array(base64) });
        const document = await task.promise;
        if (cancelled) {
          void document.destroy();
          return;
        }
        documentRef.current = document;
        setPageCount(document.numPages);
        const page = await document.getPage(1);
        if (cancelled) {
          void page.cleanup();
          return;
        }
        await renderPage(page, scale);
        if (!cancelled) setLoading(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "تعذر تحميل ملف PDF.");
          setLoading(false);
        }
      }
    }

    if (isImage) {
      setLoading(false);
    } else {
      void loadDocument();
    }

    return () => {
      cancelled = true;
      const renderTask = renderTaskRef.current;
      if (renderTask) void renderTask.cancel();
      renderTaskRef.current = null;
    };
    // base64 يتغير مع كل ملف جديد؛ scale يُعالج في تأثير منفصل.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64, isImage]);

  // إعادة الرسم عند تغيّر الصفحة أو التكبير.
  useEffect(() => {
    if (isImage) return;
    const loadedDocument = documentRef.current;
    if (!loadedDocument) return;
    let cancelled = false;

    async function redraw() {
      const current = documentRef.current;
      if (!current) return;
      try {
        const page = await current.getPage(pageNumber);
        if (cancelled) {
          void page.cleanup();
          return;
        }
        const previous = renderTaskRef.current;
        if (previous) void previous.cancel();
        await renderPage(page, scale);
      } catch (renderError) {
        if (!cancelled && !(renderError instanceof Error && renderError.name === "RenderingCancelledException")) {
          setError("تعذر رسم صفحة الملف.");
        }
      }
    }

    void redraw();
    return () => {
      cancelled = true;
    };
  }, [isImage, pageNumber, renderPage, scale]);

  // تدمير المستند عند إزالة المكون.
  useEffect(() => {
    return () => {
      const document = documentRef.current;
      if (document) void document.destroy();
      documentRef.current = null;
    };
  }, []);

  function zoomIn() {
    setScale((current) => Math.min(MAX_SCALE, Math.round((current + SCALE_STEP) * 100) / 100));
  }

  function zoomOut() {
    setScale((current) => Math.max(MIN_SCALE, Math.round((current - SCALE_STEP) * 100) / 100));
  }

  function fitWidth() {
    const container = canvasRef.current?.parentElement;
    const canvas = canvasRef.current;
    if (!container || !canvas || !documentRef.current) return;
    const available = container.clientWidth - 32;
    if (available <= 0) return;
    // تقدير عرض الصفحة بمقياس 1 ثم حساب المقياس الملائم للعرض.
    documentRef.current.getPage(pageNumber).then((page) => {
      const baseViewport = page.getViewport({ scale: 1 });
      const fit = Math.max(MIN_SCALE, Math.min(MAX_SCALE, available / baseViewport.width));
      setScale(Math.round(fit * 100) / 100);
      void page.cleanup();
    }).catch(() => {
      setError("تعذر ضبط عرض الملف.");
    });
  }

  function downloadFile() {
    const mime = mimeType === "application/pdf" ? "application/pdf" : mimeType;
    const link = document.createElement("a");
    link.href = `data:${mime};base64,${base64}`;
    link.download = fileName;
    link.click();
  }

  if (error) {
    return (
      <div className="pdf-viewer-error" role="alert">
        <div className="pdf-viewer-error-card">
          <FileWarning size={28} aria-hidden="true" />
          <h3>تعذر عرض الملف</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-viewer-toolbar">
          <span className="pdf-viewer-filename" title={fileName}>{fileName}</span>
          <span className="pdf-viewer-spacer" />
          <IconButton label="تنزيل الملف" onClick={downloadFile}>
            <Download size={16} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="pdf-viewer-stage pdf-viewer-image-stage">
          {/* الصورة المعاينة: مسار data محلي فقط، ولا مسار قرص */}
          <img alt={fileName} className="pdf-viewer-image" src={`data:${mimeType};base64,${base64}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-toolbar">
        <span className="pdf-viewer-filename" title={fileName}>{fileName}</span>
        <span className="pdf-viewer-spacer" />
        <IconButton disabled={pageNumber <= 1} label="الصفحة السابقة" onClick={() => setPageNumber((page) => Math.max(1, page - 1))}>
          <ChevronRight size={16} aria-hidden="true" />
        </IconButton>
        <span className="pdf-viewer-page-count">
          {loading ? "…" : `صفحة ${pageNumber} من ${pageCount}`}
        </span>
        <IconButton disabled={pageNumber >= pageCount} label="الصفحة التالية" onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}>
          <ChevronLeft size={16} aria-hidden="true" />
        </IconButton>
        <span className="pdf-viewer-divider" />
        <IconButton disabled={scale <= MIN_SCALE} label="تصغير" onClick={zoomOut}>
          <Minus size={16} aria-hidden="true" />
        </IconButton>
        <span className="pdf-viewer-scale">{Math.round(scale * 100)}%</span>
        <IconButton disabled={scale >= MAX_SCALE} label="تكبير" onClick={zoomIn}>
          <Plus size={16} aria-hidden="true" />
        </IconButton>
        <Button className="pdf-viewer-fit" icon={<Maximize size={15} />} onClick={fitWidth}>ملاءمة العرض</Button>
        <IconButton label="تنزيل الملف" onClick={downloadFile}>
          <Download size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="pdf-viewer-stage">
        {loading ? (
          <div className="pdf-viewer-loading" role="status">جارٍ تحميل الملف…</div>
        ) : (
          // خلفية الصفحة بيضاء دائمًا حتى في Dark (قرار D16)، والإطار من التوكنز.
          <canvas className="pdf-viewer-canvas" ref={canvasRef} />
        )}
      </div>
    </div>
  );
}
