/**
 * Departments importer.
 *
 * Reads an Excel (.xlsx/.xls/.csv) or PDF file produced from the payroll
 * workbook (DimDepartments) and normalizes it into typed rows that the
 * `departments:import` handler can persist.
 *
 * Column mapping is header driven with Arabic + English aliases and a
 * positional fallback, so re-imported or slightly reshaped files still work.
 */
import type {
  DepartmentImportIssue,
  DepartmentImportRow,
  DepartmentParseResult
} from '../../../shared/types'

const CODE_ALIASES = [
  'كود القسم',
  'كود',
  'رمز القسم',
  'رمز',
  'code',
  'dept code',
  'department code',
  'department id',
  'id'
]
const NAME_ALIASES = ['اسم القسم', 'القسم', 'اسم', 'name', 'dept name', 'department name', 'section']
const PCT_ALIASES = [
  'نسبة بدل طبيعة العمل',
  'بدل طبيعة العمل',
  'نسبة بدل',
  'نسبة',
  'nature allowance',
  'nature of work allowance',
  'allowance pct',
  'allowance percentage',
  'percentage',
  'pct',
  'percent',
  '%'
]

/** Unify Arabic orthography + strip noise so header matching is forgiving. */
function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/[^\p{L}\p{N}% ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Digits → plain ASCII so numeric parsing is locale independent. */
function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
}

function toCodeText(value: unknown): string {
  const text = normalizeDigits(String(value ?? '').trim())
  if (!text) return ''
  // Keep codes verbatim (leading zeros matter); only strip thousands separators
  // and decimals so formatted cells like "553,041" still match.
  if (/^\d[\d\s,]*$/.test(text) || /^\d[\d\s,]*\.\d*$/.test(text)) {
    const [integer] = text.replace(/[\s,]/g, '').split('.')
    return integer
  }
  return text
}

function toPctNumber(value: unknown): number | null {
  const text = normalizeDigits(String(value ?? '').trim()).replace(/%/g, '').trim()
  if (!text) return null
  const parsed = Number(text.replace(/,/g, ''))
  if (Number.isNaN(parsed)) return null
  return parsed
}

function toNameText(value: unknown): string {
  return normalizeDigits(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
}

interface ColumnMap {
  code: number
  name: number
  pct: number | null
}

function detectColumns(rows: unknown[][]): { map: ColumnMap; headerRow: number } {
  const aliases = new Map<string, 'code' | 'name' | 'pct'>()
  for (const alias of CODE_ALIASES) aliases.set(normalizeHeader(alias), 'code')
  for (const alias of NAME_ALIASES) aliases.set(normalizeHeader(alias), 'name')
  for (const alias of PCT_ALIASES) aliases.set(normalizeHeader(alias), 'pct')

  const scanLimit = Math.min(rows.length, 6)
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = rows[rowIndex]
    const found: Partial<Record<'code' | 'name' | 'pct', number>> = {}
    row.forEach((cell, columnIndex) => {
      const key = aliases.get(normalizeHeader(cell))
      if (key && found[key] === undefined) found[key] = columnIndex
    })
    if (found.code !== undefined && found.name !== undefined) {
      return {
        map: { code: found.code, name: found.name, pct: found.pct ?? null },
        headerRow: rowIndex
      }
    }
  }

  // No recognizable header — assume the first row is one and map positionally.
  return { map: { code: 0, name: 1, pct: 2 }, headerRow: 0 }
}

function rowToImportRow(values: unknown[], map: ColumnMap): DepartmentImportRow {
  return {
    code: toCodeText(values[map.code]),
    name: toNameText(values[map.name]),
    natureAllowancePct: map.pct === null ? null : toPctNumber(values[map.pct])
  }
}

/* --------------------------------- Excel ---------------------------------- */

async function parseExcel(data: Buffer): Promise<DepartmentParseResult> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(data, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) {
    return { rows: [], issues: [], source: 'excel' }
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false
  })
  if (rows.length === 0) {
    return { rows: [], issues: [], source: 'excel' }
  }

  const { map, headerRow } = detectColumns(rows)
  const issues: DepartmentImportIssue[] = []

  const parsed = rows
    .slice(headerRow + 1)
    .map((values, offset) => {
      const row = rowToImportRow(values, map)
      if (!row.code && !row.name) return null
      if (!row.code || !row.name) {
        issues.push({
          line: headerRow + offset + 2,
          raw: String(values[map.name] ?? values[map.code] ?? ''),
          reason: !row.code ? 'missing-code' : 'missing-name'
        })
        return null
      }
      return row
    })
    .filter((row): row is DepartmentImportRow => row !== null)

  return { rows: parsed, issues, source: 'excel' }
}

/* ---------------------------------- PDF ----------------------------------- */

const PAGE_MARKER = /--\s*\d+\s+of\s+\d+\s+--/

async function parsePdf(data: Buffer): Promise<DepartmentParseResult> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(data) })
  try {
    const result = await parser.getText()
    const text = (result.pages?.map((page) => page.text ?? '').join('\n') ?? result.text ?? '') as string
    return parsePlainText(text, 'pdf')
  } finally {
    await parser.destroy()
  }
}

/**
 * Best-effort row extraction from free PDF text. Each table row is expected to
 * live on its own line, starting with the department code and ending with the
 * allowance percentage:
 *   `553041 (ص. ك) رمالة رئيسية 50`
 */
function parsePlainText(text: string, source: 'pdf' | 'csv'): DepartmentParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(PAGE_MARKER, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)

  const rows: DepartmentImportRow[] = []
  const issues: DepartmentImportIssue[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const headerish =
      normalizeHeader(line).includes(normalizeHeader('كود القسم')) ||
      (/\bcode\b/i.test(line) && /\bname\b/i.test(line))
    if (headerish) continue

    // leading code: digit first, then letters / dashes / slashes
    const codeMatch = line.match(/^(\d[A-Za-z0-9\-/]*)/)
    // trailing percentage: optional parentheses, optional % sign
    const pctMatch = line.match(/\(?(\d+(?:[.,]\d+)?)\)?\s*%?\s*$/)

    if (!codeMatch || !pctMatch) {
      issues.push({ line: index + 1, raw: line, reason: 'unrecognized-line' })
      continue
    }

    const code = toCodeText(codeMatch[1])
    const natureAllowancePct = toPctNumber(pctMatch[1])
    const name = line.slice(codeMatch[0].length, pctMatch.index).trim()

    if (!name) {
      issues.push({ line: index + 1, raw: line, reason: 'missing-name' })
      continue
    }

    rows.push({ code, name, natureAllowancePct })
  }

  return { rows, issues, source }
}

/* --------------------------------- entry ---------------------------------- */

const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv']
const PDF_EXTENSIONS = ['.pdf']

export async function parseDepartmentsFile(
  data: Buffer,
  fileName: string
): Promise<DepartmentParseResult> {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()

  if (PDF_EXTENSIONS.includes(extension)) {
    return parsePdf(data)
  }
  if (EXCEL_EXTENSIONS.includes(extension)) {
    return parseExcel(data)
  }

  // Fall back on content sniffing when the extension is missing/unknown.
  const sample = data.subarray(0, 8).toString('latin1')
  if (sample.startsWith('%PDF')) return parsePdf(data)
  return parseExcel(data)
}

/** Used by the IPC layer to keep the same validation rules in one place. */
export function validateImportRow(row: DepartmentImportRow): string | null {
  if (!row.code.trim()) return 'missing-code'
  if (!row.name.trim()) return 'missing-name'
  if (row.natureAllowancePct !== null && (row.natureAllowancePct < 0 || row.natureAllowancePct > 100)) {
    return 'pct-out-of-range'
  }
  return null
}
