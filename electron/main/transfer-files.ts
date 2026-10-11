/**
 * قرارات النقل بين الأقسام الموثقة: PDF أو Excel أو صورة — تُحفظ في
 * `<Documents>/HR-System/TransferDecisionFiles` مع فحص توقيع الملف.
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { ApiError } from '../../shared/types'
import type { EmployeeFilePreview } from '../../shared/types'
import { assertFileSignature } from './file-guard'

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.xlsx',
  '.xls',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp'
])
const MAX_FILE_SIZE = 25 * 1024 * 1024
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

export function getTransferDecisionFilesDir(): string {
  return path.join(app.getPath('documents'), 'HR-System', 'TransferDecisionFiles')
}

function ensureDir(): string {
  const dir = getTransferDecisionFilesDir()
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
      'Only PDF, Excel and image files are allowed (pdf/xlsx/xls/csv/png/jpg/jpeg/webp/gif/bmp)'
    )
  }
  return ext
}

function resolveStoredPath(storedName: string): string {
  const safe = path.basename(storedName)
  if (!safe || safe !== storedName) throw new ApiError('VALIDATION', 'Invalid file name')
  return path.join(getTransferDecisionFilesDir(), safe)
}

function deleteQuietly(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // best effort
  }
}

export function deleteStoredTransferDecision(storedName: string | null | undefined): void {
  if (!storedName) return
  deleteQuietly(resolveStoredPath(storedName))
}

export async function attachTransferDecision(
  prisma: PrismaClient,
  transferId: string,
  data: Buffer,
  originalName: string
): Promise<void> {
  assertAllowedExtension(originalName)
  if (data.byteLength === 0) throw new ApiError('VALIDATION', 'The file is empty')
  if (data.byteLength > MAX_FILE_SIZE) {
    throw new ApiError('VALIDATION', 'File exceeds the 25 MB limit')
  }
  assertFileSignature(originalName, data)

  const transfer = await prisma.departmentTransfer.findUnique({ where: { id: transferId } })
  if (!transfer) throw new ApiError('NOT_FOUND', 'Transfer not found')

  const dir = ensureDir()
  const storedName = `${transfer.id.slice(-8)}_${Date.now()}_${sanitizeBaseName(originalName)}`
  fs.writeFileSync(path.join(dir, storedName), data)

  if (transfer.decisionStoredName) deleteStoredTransferDecision(transfer.decisionStoredName)

  await prisma.departmentTransfer.update({
    where: { id: transferId },
    data: {
      decisionStoredName: storedName,
      decisionOriginalName: originalName,
      decisionSize: data.byteLength,
      decisionLinkedAt: new Date()
    }
  })
}

export async function removeTransferDecision(
  prisma: PrismaClient,
  transferId: string
): Promise<void> {
  const transfer = await prisma.departmentTransfer.findUnique({ where: { id: transferId } })
  if (!transfer) throw new ApiError('NOT_FOUND', 'Transfer not found')
  if (!transfer.decisionStoredName) throw new ApiError('NOT_FOUND', 'No decision is attached')

  deleteStoredTransferDecision(transfer.decisionStoredName)
  await prisma.departmentTransfer.update({
    where: { id: transferId },
    data: {
      decisionStoredName: null,
      decisionOriginalName: null,
      decisionSize: null,
      decisionLinkedAt: null
    }
  })
}

export async function previewTransferDecision(
  prisma: PrismaClient,
  transferId: string
): Promise<EmployeeFilePreview> {
  const transfer = await prisma.departmentTransfer.findUnique({ where: { id: transferId } })
  if (!transfer) throw new ApiError('NOT_FOUND', 'Transfer not found')
  if (!transfer.decisionStoredName) throw new ApiError('NOT_FOUND', 'No decision is attached')

  const filePath = resolveStoredPath(transfer.decisionStoredName)
  if (!fs.existsSync(filePath)) throw new ApiError('NOT_FOUND', 'The file is missing on disk')

  const ext = path.extname(filePath).toLowerCase()
  const size = fs.statSync(filePath).size
  const base = { originalName: transfer.decisionOriginalName, ext, size }

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

  return { kind: 'table', ...base, sheetName, rows, totalRows, truncated: totalRows > PREVIEW_MAX_ROWS }
}
