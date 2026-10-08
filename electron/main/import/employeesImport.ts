/**
 * Employees importer.
 *
 * Reads an Excel (.xlsx/.xls/.csv) or PDF file (DimEmployees) and normalizes it
 * into typed rows that the `employees:import` handler can persist.
 *
 * The source file carries bidi control characters and embedded newlines in its
 * headers (e.g. `‫الرقمالتأمينى‬‏`, `تاريخ‏\r\nالدرجة`), so every header goes
 * through `normalizeHeader` before matching. Dates arrive as Excel's display
 * text (`6/1/26`, `12/31/89`) and are normalized to ISO `yyyy-mm-dd`.
 */
import type {
  EmployeeDate,
  EmployeeImportIssue,
  EmployeeImportRow,
  EmployeeParseResult
} from '../../../shared/types'
import { normalizeHeader, normalizeDigits, toIdText, toNameText, toIntOrNull } from './text'

type ColumnKey =
  | 'code'
  | 'name'
  | 'insuranceNo'
  | 'nationalId'
  | 'grade'
  | 'gradeDate'
  | 'birthDate'
  | 'permanentDate'
  | 'hireDate'
  | 'qualification'
  | 'qualificationYear'

const ALIASES: Record<ColumnKey, string[]> = {
  code: ['كود الموظف', 'كود', 'code', 'employee code', 'emp code', 'employee id'],
  name: ['اسم الموظف', 'اسم', 'name', 'employee name', 'emp name'],
  insuranceNo: ['الرقم التأمينى', 'الرقم التأميني', 'رقم التأمين', 'insurance no', 'insurance', 'social insurance'],
  nationalId: ['الرقم القومى', 'الرقم القومي', 'رقم قومي', 'national id', 'nationalid', 'nid'],
  grade: ['الدرجة', 'درجة', 'grade'],
  gradeDate: ['تاريخ الدرجة', 'تاريخ الدراجه', 'grade date'],
  birthDate: ['تاريخ الميلاد', 'تاريخ الميلادة', 'birth date', 'date of birth'],
  permanentDate: ['تاريخ التثبيت', 'تثبيت', 'permanent date'],
  hireDate: ['تاريخ التعيين', 'تاريخ التعين', 'hire date', 'date of hire', 'hiring date'],
  qualification: ['المؤهل', 'qualification', 'qualification name'],
  qualificationYear: ['سنة المؤهل', 'سنه المؤهل', 'qualification year', 'year of qualification']
}

interface ColumnMap {
  code: number
  name: number
  optional: Partial<Record<ColumnKey, number>>
}

/* --------------------------------- dates ---------------------------------- */

function isoOf(year: number, month: number, day: number): EmployeeDate {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Normalizes the date shapes found in exports:
 * - Excel display text: `6/1/26`, `12/31/89`, `5/11/1968` (US `m/d/y`; the
 *   first component > 12 flips to `d/m/y` so European exports still work)
 * - ISO: `1986-05-11`
 * - Excel serial numbers (days since 1899-12-30)
 * - JS Date objects (when the reader returns them)
 */
export function parseEmployeeDate(value: unknown): EmployeeDate {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoOf(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }

  if (typeof value === 'number') {
    // Excel serial: treat plausible serials as dates (1900..~2080 window).
    if (value < 1 || value > 65000) return null
    const serial = Math.floor(value)
    const epoch = Date.UTC(1899, 11, 30)
    const date = new Date(epoch + serial * 86400000)
    return isoOf(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }

  const text = normalizeDigits(String(value).trim())
  if (!text) return null

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const slashed = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
  if (slashed) {
    const first = Number(slashed[1])
    const second = Number(slashed[2])
    const rawYear = Number(slashed[3])
    // Heuristic: a component > 12 can only be the day → d/m/y, else m/d/y
    // (the source file uses US order: `12/31/89`, `5/11/68`).
    let day: number
    let month: number
    if (first > 12) {
      day = first
      month = second
    } else if (second > 12) {
      month = first
      day = second
    } else {
      month = first
      day = second
    }
    const year = rawYear < 100 ? (rawYear < 30 ? 2000 + rawYear : 1900 + rawYear) : rawYear
    return isoOf(year, month, day)
  }

  return null
}

/* ----------------------------- column detection --------------------------- */

function detectColumns(rows: unknown[][]): { map: ColumnMap; headerRow: number } {
  const aliasMap = new Map<string, ColumnKey>()
  for (const key of Object.keys(ALIASES) as ColumnKey[]) {
    for (const alias of ALIASES[key]) aliasMap.set(normalizeHeader(alias), key)
  }

  const scanLimit = Math.min(rows.length, 6)
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = rows[rowIndex]
    const found: Partial<Record<ColumnKey, number>> = {}
    row.forEach((cell, columnIndex) => {
      const key = aliasMap.get(normalizeHeader(cell))
      if (key && found[key] === undefined) found[key] = columnIndex
    })
    if (found.code !== undefined && found.name !== undefined) {
      const optional: Partial<Record<ColumnKey, number>> = {}
      for (const key of Object.keys(found) as ColumnKey[]) {
        if (key !== 'code' && key !== 'name') optional[key] = found[key] as number
      }
      return { map: { code: found.code, name: found.name, optional }, headerRow: rowIndex }
    }
  }

  // No recognizable header — assume the first row is one and map positionally:
  // code, name first; other columns are left unmapped rather than guessed wrong.
  return { map: { code: 10, name: 9, optional: {} }, headerRow: 0 }
}

function cellOf(values: unknown[], map: ColumnMap, key: ColumnKey): unknown {
  const index = key === 'code' ? map.code : key === 'name' ? map.name : map.optional[key]
  return index === undefined ? undefined : values[index]
}

function rowToImportRow(
  values: unknown[],
  map: ColumnMap,
  rawValues?: unknown[]
): EmployeeImportRow {
  // Dates prefer the raw cell: Excel serials are unambiguous (a displayed
  // `4/16/24` could be 1924 or 2024 — the serial tells the truth). The display
  // text stays the fallback for text-typed date cells.
  const dateCell = (key: ColumnKey): unknown => {
    const index = map.optional[key]
    if (index === undefined) return undefined
    const raw = rawValues?.[index]
    return typeof raw === 'number' ? raw : cellOf(values, map, key)
  }

  return {
    code: toIdText(cellOf(values, map, 'code')),
    name: toNameText(cellOf(values, map, 'name')),
    insuranceNo: toIdText(cellOf(values, map, 'insuranceNo')) || null,
    nationalId: toIdText(cellOf(values, map, 'nationalId')) || null,
    grade: toNameText(cellOf(values, map, 'grade')) || null,
    gradeDate: parseEmployeeDate(dateCell('gradeDate')),
    birthDate: parseEmployeeDate(dateCell('birthDate')),
    permanentDate: parseEmployeeDate(dateCell('permanentDate')),
    hireDate: parseEmployeeDate(dateCell('hireDate')),
    qualification: toNameText(cellOf(values, map, 'qualification')) || null,
    qualificationYear: toIntOrNull(cellOf(values, map, 'qualificationYear'))
  }
}

function isValidRow(row: EmployeeImportRow): boolean {
  return Boolean(row.code && row.name)
}

/* --------------------------------- Excel ---------------------------------- */

function parseExcelRows(
  rows: unknown[][],
  rawRows?: unknown[][]
): { parsed: EmployeeImportRow[]; issues: EmployeeImportIssue[] } {
  if (rows.length === 0) return { parsed: [], issues: [] }

  const { map, headerRow } = detectColumns(rows)
  const issues: EmployeeImportIssue[] = []

  const parsed = rows
    .slice(headerRow + 1)
    .map((values, offset) => {
      const rawValues = rawRows?.[headerRow + 1 + offset]
      const row = rowToImportRow(values, map, rawValues)
      if (!row.code && !row.name) return null
      if (!isValidRow(row)) {
        issues.push({
          line: headerRow + offset + 2,
          raw: toNameText(values[map.name] ?? values[map.code] ?? ''),
          reason: !row.code ? 'missing-code' : 'missing-name'
        })
        return null
      }
      return row
    })
    .filter((row): row is EmployeeImportRow => row !== null)

  return { parsed, issues }
}

async function parseExcel(data: Buffer): Promise<EmployeeParseResult> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(data, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return { rows: [], issues: [], source: 'excel' }

  const options = {
    header: 1,
    defval: '',
    blankrows: false
  } as const
  // Display text for labels/ids (what the user sees in Excel) plus the raw
  // grid so date columns can use exact Excel serials instead of ambiguous
  // two-digit display years. Both reads skip the same blank rows, so the
  // row indices line up.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { ...options, raw: false })
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { ...options, raw: true })
  const { parsed, issues } = parseExcelRows(rows, rawRows)
  return { rows: parsed, issues, source: 'excel' }
}

/* ---------------------------------- PDF ----------------------------------- */

const PAGE_MARKER = /--\s*\d+\s+of\s+\d+\s+--/
const HEADER_HINTS = ['كود الموظف', 'الرقم التأميني', 'employee code', 'insurance']

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.map((cell) => normalizeHeader(cell)).join(' ')
  return HEADER_HINTS.some((hint) => joined.includes(normalizeHeader(hint)))
}

/**
 * PDF import uses pdf-parse's table detector (cell geometry) when the page is a
 * real grid; otherwise it falls back to a per-line heuristic that pulls the
 * reliably positional parts (insurance/national numbers, dates, trailing code)
 * and keeps the last Arabic run as the name.
 */
async function parsePdf(data: Buffer): Promise<EmployeeParseResult> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(data) })
  try {
    // 1) structured tables
    try {
      const tableResult = await parser.getTable()
      const tables = tableResult.pages.flatMap((page) => page.tables ?? [])
      for (const grid of tables) {
        if (grid.length < 2) continue
        const { parsed, issues } = parseExcelRows(grid)
        if (parsed.length > 0) return { rows: parsed, issues, source: 'pdf' }
      }
    } catch {
      // fall through to the line heuristic
    }

    // 2) plain text fallback
    const text = await parser.getText()
    const raw =
      (text.pages?.map((page) => page.text ?? '').join('\n') ?? text.text ?? '') as string
    return parsePdfLines(raw)
  } finally {
    await parser.destroy()
  }
}

function parsePdfLines(text: string): EmployeeParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(PAGE_MARKER, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)

  const rows: EmployeeImportRow[] = []
  const issues: EmployeeImportIssue[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (looksLikeHeader(line.split(' '))) continue

    const tokens = line.split(' ')
    const digits = tokens.map((token) => (/^\d+$/.test(token) ? token : null))

    // trailing short number = employee code
    let code = ''
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      if (digits[i] && digits[i]!.length >= 3 && digits[i]!.length <= 7) {
        code = digits[i]!
        tokens.splice(i, 1)
        break
      }
    }

    // leading long numbers = insurance no, national id
    let insuranceNo: string | null = null
    let nationalId: string | null = null
    if (digits[0] && digits[0]!.length >= 6 && digits[0]!.length <= 9) {
      insuranceNo = digits[0]!
      tokens.splice(0, 1)
      const rest = tokens.map((t) => (/^\d+$/.test(t) ? t : null))
      if (rest[0] && rest[0]!.length >= 10 && rest[0]!.length <= 14) {
        nationalId = rest[0]!
        tokens.splice(0, 1)
      }
    }

    // date-like tokens in file order
    const dateValues: EmployeeDate[] = []
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      if (!/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(tokens[i])) continue
      dateValues.unshift(parseEmployeeDate(tokens[i]))
      tokens.splice(i, 1)
    }

    // last remaining Arabic run = employee name
    const arabicRuns: string[] = []
    let current: string[] = []
    for (const token of tokens) {
      if (/[\p{L}]/u.test(token) && !/\d/.test(token)) {
        current.push(token)
      } else if (current.length > 0) {
        arabicRuns.push(current.join(' '))
        current = []
      }
    }
    if (current.length > 0) arabicRuns.push(current.join(' '))
    const name = arabicRuns[arabicRuns.length - 1] ?? ''

    if (!code) {
      if (name || insuranceNo) {
        issues.push({ line: index + 1, raw: line, reason: 'missing-code' })
      }
      continue
    }
    if (!name) {
      issues.push({ line: index + 1, raw: line, reason: 'missing-name' })
      continue
    }

    rows.push({
      code,
      name,
      insuranceNo,
      nationalId,
      grade: arabicRuns.length > 1 ? arabicRuns[0] : null,
      gradeDate: dateValues[0] ?? null,
      birthDate: dateValues[1] ?? null,
      permanentDate: dateValues[2] ?? null,
      hireDate: dateValues[3] ?? null,
      qualification: null,
      qualificationYear: null
    })
  }

  return { rows, issues, source: 'pdf' }
}

/* --------------------------------- entry ---------------------------------- */

const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv']
const PDF_EXTENSIONS = ['.pdf']

export async function parseEmployeesFile(
  data: Buffer,
  fileName: string
): Promise<EmployeeParseResult> {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()

  if (PDF_EXTENSIONS.includes(extension)) return parsePdf(data)
  if (EXCEL_EXTENSIONS.includes(extension)) return parseExcel(data)

  const sample = data.subarray(0, 8).toString('latin1')
  if (sample.startsWith('%PDF')) return parsePdf(data)
  return parseExcel(data)
}

/** Used by the IPC layer so validation lives in one place. */
export function validateEmployeeImportRow(row: EmployeeImportRow): string | null {
  if (!row.code.trim()) return 'missing-code'
  if (!row.name.trim()) return 'missing-name'
  if (row.qualificationYear !== null && (row.qualificationYear < 1900 || row.qualificationYear > 2200)) {
    return 'invalid-year'
  }
  return null
}
