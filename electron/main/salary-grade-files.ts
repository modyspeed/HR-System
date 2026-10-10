/**
 * مستندات استحقاق تدرج الأساسي (قرار زيادة/علاوة): PDF أو Excel، تُحفظ في
 * `<Documents>/HR-System/SalaryGradeFiles` مع فحص التوقيع والاستبدال الآمن.
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { ApiError } from '../../shared/types'
import type { EmployeeFilePreview } from '../../shared/types'
import { assertFileSignature } from './file-guard'

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls', '.csv'])
const MAX_FILE_SIZE = 25 * 1024 * 1024
const PREVIEW_MAX_ROWS = 2000
const PREVIEW_MAX_COLS = 60

export function getSalaryGradeFilesDir(): string {
  return path.join(app.getPath('documents'), 'HR-System', 'SalaryGradeFiles')
}

function ensureDir(): string {
  const dir = getSalaryGradeFilesDir()
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
    throw new ApiError('VALIDATION', 'Only PDF and Excel files are allowed (pdf/xlsx/xls/csv)')
  }
  return ext
}

function resolveStoredPath(storedName: string): string {
  const safe = path.basename(storedName)
  if (!safe || safe !== storedName) throw new ApiError('VALIDATION', 'Invalid file name')
  return path.join(getSalaryGradeFilesDir(), safe)
}

function deleteQuietly(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // best effort
  }
}

export function deleteStoredSalaryGradeFile(storedName: string | null | undefined): void {
  if (!storedName) return
  deleteQuietly(resolveStoredPath(storedName))
}

export async function attachSalaryGradeFile(
  prisma: PrismaClient,
  gradeId: string,
  data: Buffer,
  originalName: string
): Promise<void> {
  assertAllowedExtension(originalName)
  if (data.byteLength === 0) throw new ApiError('VALIDATION', 'The file is empty')
  if (data.byteLength > MAX_FILE_SIZE) {
    throw new ApiError('VALIDATION', 'File exceeds the 25 MB limit')
  }
  assertFileSignature(originalName, data)

  const grade = await prisma.basicSalaryGrade.findUnique({ where: { id: gradeId } })
  if (!grade) throw new ApiError('NOT_FOUND', 'Salary grade not found')

  const dir = ensureDir()
  const storedName = `${grade.id.slice(-8)}_${Date.now()}_${sanitizeBaseName(originalName)}`
  fs.writeFileSync(path.join(dir, storedName), data)

  if (grade.fileStoredName) deleteStoredSalaryGradeFile(grade.fileStoredName)

  await prisma.basicSalaryGrade.update({
    where: { id: gradeId },
    data: {
      fileStoredName: storedName,
      fileOriginalName: originalName,
      fileSize: data.byteLength,
      fileLinkedAt: new Date()
    }
  })
}

export async function removeSalaryGradeFile(
  prisma: PrismaClient,
  gradeId: string
): Promise<void> {
  const grade = await prisma.basicSalaryGrade.findUnique({ where: { id: gradeId } })
  if (!grade) throw new ApiError('NOT_FOUND', 'Salary grade not found')
  if (!grade.fileStoredName) throw new ApiError('NOT_FOUND', 'No document is linked')

  deleteStoredSalaryGradeFile(grade.fileStoredName)
  await prisma.basicSalaryGrade.update({
    where: { id: gradeId },
    data: { fileStoredName: null, fileOriginalName: null, fileSize: null, fileLinkedAt: null }
  })
}

export async function previewSalaryGradeFile(
  prisma: PrismaClient,
  gradeId: string
): Promise<EmployeeFilePreview> {
  const grade = await prisma.basicSalaryGrade.findUnique({ where: { id: gradeId } })
  if (!grade) throw new ApiError('NOT_FOUND', 'Salary grade not found')
  if (!grade.fileStoredName) throw new ApiError('NOT_FOUND', 'No document is linked')

  const filePath = resolveStoredPath(grade.fileStoredName)
  if (!fs.existsSync(filePath)) throw new ApiError('NOT_FOUND', 'The file is missing on disk')

  const ext = path.extname(filePath).toLowerCase()
  const size = fs.statSync(filePath).size
  const base = { originalName: grade.fileOriginalName, ext, size }

  if (ext === '.pdf') {
    const data = fs.readFileSync(filePath)
    return { kind: 'pdf', ...base, data: new Uint8Array(data) }
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
