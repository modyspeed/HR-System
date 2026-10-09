/**
 * كشوف المرتبات PDF: يُحفظ ملف الكشف الأصلي (دفعة) مرة واحدة في
 * `<Documents>/HR-System/PayrollFiles`، وكل موظف يحصل على صفحته (ظرفه) عند
 * المعاينة عبر تقطيع الصفحة بـ pdf-lib — بلا نسخ مكررة على القرص.
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { PDFDocument } from 'pdf-lib'
import { ApiError } from '../../shared/types'
import { assertFileSignature } from './file-guard'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export function getPayrollFilesDir(): string {
  return path.join(app.getPath('documents'), 'HR-System', 'PayrollFiles')
}

function ensureDir(): string {
  const dir = getPayrollFilesDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function assertPdf(fileName: string, data: Buffer): void {
  if (path.extname(fileName).toLowerCase() !== '.pdf') {
    throw new ApiError('VALIDATION', 'Payroll files must be PDF')
  }
  assertFileSignature(fileName, data)
  if (data.byteLength === 0) throw new ApiError('VALIDATION', 'The file is empty')
  if (data.byteLength > MAX_FILE_SIZE) {
    throw new ApiError('VALIDATION', 'Payroll file exceeds the 50 MB limit')
  }
}

export function resolvePayrollStoredPath(storedName: string): string {
  const safe = path.basename(storedName)
  if (!safe || safe !== storedName) throw new ApiError('VALIDATION', 'Invalid file name')
  return path.join(getPayrollFilesDir(), safe)
}

function deleteQuietly(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // best effort
  }
}

/** يحفظ ملف الكشف ويعيد عدد صفحاته (يُستخدم لموازنة الأظرف). */
export async function storePayrollBatch(
  data: Buffer,
  originalName: string
): Promise<{ storedName: string; pageCount: number }> {
  assertPdf(originalName, data)
  const dir = ensureDir()
  const safeBase =
    path
      .basename(originalName, path.extname(originalName))
      .replace(/[\\/:*?"<>|]+/g, '_')
      .trim()
      .slice(0, 60) || 'payroll'
  const storedName = `${safeBase}_${Date.now()}.pdf`
  const target = path.join(dir, storedName)
  fs.writeFileSync(target, data)

  const document = await PDFDocument.load(data, { ignoreEncryption: true })
  return { storedName, pageCount: document.getPageCount() }
}

/** يعيد الصفحة (ظرف الموظف) كملف PDF مستقل. */
export async function slicePayrollPage(
  storedName: string,
  pageIndex: number
): Promise<Buffer> {
  const filePath = resolvePayrollStoredPath(storedName)
  if (!fs.existsSync(filePath)) throw new ApiError('NOT_FOUND', 'Payroll file is missing')

  const source = await PDFDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true })
  if (pageIndex < 0 || pageIndex >= source.getPageCount()) {
    throw new ApiError('NOT_FOUND', 'Payroll page is out of range')
  }
  const single = await PDFDocument.create()
  const [page] = await single.copyPages(source, [pageIndex])
  single.addPage(page)
  return Buffer.from(await single.save())
}

export function deleteStoredPayrollFile(storedName: string | null | undefined): void {
  if (!storedName) return
  deleteQuietly(resolvePayrollStoredPath(storedName))
}
