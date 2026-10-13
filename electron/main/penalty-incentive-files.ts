/** مستند «الحرمان من الحافز»: يُحفظ مرة لكل شهر ويُقطع لمعاينة الصفحة. */
import fs from 'fs'
import path from 'path'
import { PDFDocument } from 'pdf-lib'
import { ApiError } from '../../shared/types'
import { assertFileSignature } from './file-guard'
import { DOCUMENT_FOLDERS, getDocumentFolderDir } from './document-folders'
import { MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_MB } from '../../shared/upload-limits'

export function getPenaltyFilesDir(): string {
  return getDocumentFolderDir(DOCUMENT_FOLDERS.incentivePenaltyFiles)
}

function ensureDir(): string {
  const dir = getPenaltyFilesDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function resolveStoredPath(storedName: string): string {
  const safe = path.basename(storedName)
  if (!safe || safe !== storedName) throw new ApiError('VALIDATION', 'Invalid file name')
  return path.join(getPenaltyFilesDir(), safe)
}

export function deleteStoredFile(storedName: string | null | undefined): void {
  if (!storedName) return
  try {
    fs.rmSync(resolveStoredPath(storedName), { force: true })
  } catch {
    // best effort
  }
}

export async function storeBatch(
  data: Buffer,
  originalName: string
): Promise<{ storedName: string; pageCount: number }> {
  if (path.extname(originalName).toLowerCase() !== '.pdf') {
    throw new ApiError('VALIDATION', 'Penalty documents must be PDF')
  }
  assertFileSignature(originalName, data)
  if (data.byteLength === 0) throw new ApiError('VALIDATION', 'The file is empty')
  if (data.byteLength > MAX_UPLOAD_SIZE) {
    throw new ApiError('VALIDATION', `File exceeds the ${MAX_UPLOAD_SIZE_MB} MB limit`)
  }
  const dir = ensureDir()
  const safeBase =
    path
      .basename(originalName, path.extname(originalName))
      .replace(/[\\/:*?"<>|]+/g, '_')
      .trim()
      .slice(0, 60) || 'penalties'
  const storedName = `${safeBase}_${Date.now()}.pdf`
  fs.writeFileSync(path.join(dir, storedName), data)
  const document = await PDFDocument.load(data, { ignoreEncryption: true })
  return { storedName, pageCount: document.getPageCount() }
}

export async function slicePage(storedName: string, pageIndex: number): Promise<Buffer> {
  const filePath = resolveStoredPath(storedName)
  if (!fs.existsSync(filePath)) throw new ApiError('NOT_FOUND', 'Penalty document is missing')
  const source = await PDFDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true })
  if (pageIndex < 0 || pageIndex >= source.getPageCount()) {
    throw new ApiError('NOT_FOUND', 'Penalty page is out of range')
  }
  const single = await PDFDocument.create()
  const [page] = await single.copyPages(source, [pageIndex])
  single.addPage(page)
  return Buffer.from(await single.save())
}
