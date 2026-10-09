/**
 * Leave supporting-document storage (وثيقة الإجازة الموثقة).
 *
 * Files live in a predictable folder the user can open from the UI:
 *   <Documents>/HR-System/LeaveFiles
 * and the database stores only a unique stored name + metadata, mirroring the
 * employee work-file module. Accepted formats: Excel, PDF and images, so a
 * documented leave can carry its paper proof.
 */
import { app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { ApiError } from '../../shared/types'
import type { LeaveFilePreview } from '../../shared/types'
import { assertFileSignature } from './file-guard'

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.xlsx',
  '.xls',
  '.xlsm',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp'
])
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const PREVIEW_MAX_ROWS = 2000
const PREVIEW_MAX_COLS = 60

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

export function getLeaveFilesDir(): string {
  return path.join(app.getPath('documents'), 'HR-System', 'LeaveFiles')
}

function ensureDir(): string {
  const dir = getLeaveFilesDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function sanitizeBaseName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase()
  const base =
    path
      .basename(originalName, path.extname(originalName))
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'document'
  return `${base}${ext}`
}

function assertAllowedExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ApiError(
      'VALIDATION',
      'Only PDF, Excel and image files are allowed (pdf/xlsx/xls/xlsm/csv/png/jpg/jpeg/webp/gif/bmp)'
    )
  }
  return ext
}

function resolveStoredPath(storedName: string): string {
  const safe = path.basename(storedName)
  if (!safe || safe !== storedName) {
    throw new ApiError('VALIDATION', 'Invalid file name')
  }
  return path.join(getLeaveFilesDir(), safe)
}

function deleteQuietly(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // best effort — a missing/locked file must not break the unlink
  }
}

/** Removes a stored leave document by its stored name (no-op when null/missing). */
export function deleteStoredLeaveFile(storedName: string | null | undefined): void {
  if (!storedName) return
  deleteQuietly(resolveStoredPath(storedName))
}

/** Writes the document into the files folder and links it to the leave. */
export async function attachLeaveFile(
  prisma: PrismaClient,
  leaveId: string,
  data: Buffer,
  originalName: string
): Promise<void> {
  assertAllowedExtension(originalName)
  if (data.byteLength === 0) throw new ApiError('VALIDATION', 'The file is empty')
  if (data.byteLength > MAX_FILE_SIZE) {
    throw new ApiError('VALIDATION', 'File exceeds the 25 MB limit')
  }
  assertFileSignature(originalName, data)

  const leave = await prisma.leave.findUnique({
    where: { id: leaveId },
    include: { employee: { select: { code: true } } }
  })
  if (!leave) throw new ApiError('NOT_FOUND', 'Leave not found')

  const dir = ensureDir()
  const safeCode = String(leave.employee.code).replace(/[^\w-]/g, '_') || 'leave'
  const storedName = `${safeCode}_${leave.id.slice(-8)}_${Date.now()}_${sanitizeBaseName(originalName)}`
  const target = path.join(dir, storedName)
  fs.writeFileSync(target, data)

  // replace: drop the previous physical file, then relink the record
  if (leave.fileStoredName) deleteQuietly(resolveStoredPath(leave.fileStoredName))

  await prisma.leave.update({
    where: { id: leaveId },
    data: {
      fileStoredName: storedName,
      fileOriginalName: originalName,
      fileSize: data.byteLength,
      fileLinkedAt: new Date()
    }
  })
}

/** Unlinks the document and removes it from disk. */
export async function removeLeaveFile(prisma: PrismaClient, leaveId: string): Promise<void> {
  const leave = await prisma.leave.findUnique({ where: { id: leaveId } })
  if (!leave) throw new ApiError('NOT_FOUND', 'Leave not found')
  if (!leave.fileStoredName) throw new ApiError('NOT_FOUND', 'No document is linked')

  deleteQuietly(resolveStoredPath(leave.fileStoredName))

  await prisma.leave.update({
    where: { id: leaveId },
    data: {
      fileStoredName: null,
      fileOriginalName: null,
      fileSize: null,
      fileLinkedAt: null
    }
  })
}

/** Reads the linked document and builds a preview (PDF/image bytes or a grid). */
export async function previewLeaveFile(
  prisma: PrismaClient,
  leaveId: string
): Promise<LeaveFilePreview> {
  const leave = await prisma.leave.findUnique({ where: { id: leaveId } })
  if (!leave) throw new ApiError('NOT_FOUND', 'Leave not found')
  if (!leave.fileStoredName) throw new ApiError('NOT_FOUND', 'No document is linked')

  const filePath = resolveStoredPath(leave.fileStoredName)
  if (!fs.existsSync(filePath)) {
    throw new ApiError('NOT_FOUND', 'The file is missing on disk')
  }

  const ext = path.extname(filePath).toLowerCase()
  const size = fs.statSync(filePath).size
  const base = {
    originalName: leave.fileOriginalName,
    ext,
    size
  }

  if (ext === '.pdf') {
    const data = fs.readFileSync(filePath)
    return { kind: 'pdf', ...base, data: new Uint8Array(data) }
  }

  if (IMAGE_MIME[ext]) {
    const data = fs.readFileSync(filePath)
    return { kind: 'image', ...base, data: new Uint8Array(data), mime: IMAGE_MIME[ext] }
  }

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
  const sheetName = workbook.SheetNames[0] ?? null
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet) throw new ApiError('VALIDATION', 'The spreadsheet has no sheets')

  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false
  })
  const totalRows = grid.length
  const rows = grid
    .slice(0, PREVIEW_MAX_ROWS)
    .map((row) => row.slice(0, PREVIEW_MAX_COLS).map((cell) => String(cell ?? '')))

  return {
    kind: 'table',
    ...base,
    sheetName,
    rows,
    totalRows,
    truncated: totalRows > PREVIEW_MAX_ROWS
  }
}

/** Creates the folder if needed and reveals it in the OS file browser. */
export async function revealLeaveFilesDir(): Promise<void> {
  const dir = ensureDir()
  await shell.openPath(dir)
}
