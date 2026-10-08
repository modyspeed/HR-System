/**
 * Table report export (PDF + Excel) used by the list screens.
 *
 * PDF: the payload is rendered into a self-contained HTML document and printed
 * through a hidden BrowserWindow. Going through Chromium is what makes Arabic
 * reports actually work — it shapes the text, honours RTL and repeats the
 * table header on every page, none of which the pure-JS PDF libraries do.
 *
 * Excel: exceljs writes a styled sheet (RTL view, frozen header, autofilter,
 * banded rows). The community SheetJS build used for *importing* cannot style
 * cells, hence the second library.
 *
 * Both writers take the same `ExportPayload`, so the two formats always carry
 * identical content.
 */
import fs from 'fs'
import path from 'path'
import { app, BrowserWindow, dialog } from 'electron'
import ExcelJS from 'exceljs'
import { ApiError } from '../../../shared/types'
import type { ExportColumn, ExportPayload } from '../../../shared/types'

const MAX_ROWS = 50_000
const FONT_STACK = '"Segoe UI", Tahoma, Arial, sans-serif'

const INK = '#14141D'
const GOLD = '#E0A437'
const LINE = '#E6E4DF'
const MUTED = '#6B6B7B'

/* --------------------------------- shared --------------------------------- */

function assertPayload(payload: ExportPayload): void {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('VALIDATION', 'Export payload is required')
  }
  if (!Array.isArray(payload.columns) || payload.columns.length === 0) {
    throw new ApiError('VALIDATION', 'Export payload needs at least one column')
  }
  if (!Array.isArray(payload.rows)) {
    throw new ApiError('VALIDATION', 'Export payload rows must be an array')
  }
  if (payload.rows.length > MAX_ROWS) {
    throw new ApiError('VALIDATION', `Export is limited to ${MAX_ROWS} rows`)
  }
}

/** Keeps the suggested name usable on every file system. */
function safeBaseName(payload: ExportPayload): string {
  const base =
    payload.fileName
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'report'
  return base
}

function sheetNameOf(payload: ExportPayload): string {
  const name = payload.title.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim()
  return (name || 'Report').slice(0, 31)
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function timestampOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function alignmentClass(align: ExportColumn['align']): string {
  if (align === 'center') return 'is-center'
  if (align === 'end') return 'is-end'
  return 'is-start'
}

async function saveWithDialog(
  payload: ExportPayload,
  extension: 'pdf' | 'xlsx',
  buffer: Buffer
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: payload.title,
    defaultPath: path.join(app.getPath('documents'), `${safeBaseName(payload)}.${extension}`),
    filters: [
      extension === 'pdf'
        ? { name: 'PDF', extensions: ['pdf'] }
        : { name: 'Excel', extensions: ['xlsx'] }
    ]
  })
  if (canceled || !filePath) return null
  await fs.promises.writeFile(filePath, buffer)
  return filePath
}

/* ----------------------------------- PDF ---------------------------------- */

/** Pure renderer — exported for tests; the Electron path wraps it. */
export function renderReportHtml(payload: ExportPayload): string {
  assertPayload(payload)
  const rtl = payload.direction !== 'ltr'
  const generatedAt = timestampOf(new Date())

  const headCells = payload.columns
    .map((column) => `<th class="${alignmentClass(column.align ?? 'start')}">${escapeHtml(column.label)}</th>`)
    .join('')

  const bodyRows = payload.rows
    .map((row, index) => {
      const cells = payload.columns
        .map((column, columnIndex) => {
          const value = row[columnIndex] ?? null
          const numeric = typeof value === 'number'
          const classes = [alignmentClass(column.align ?? 'start'), numeric ? 'is-num' : '']
            .filter(Boolean)
            .join(' ')
          return `<td class="${classes}">${escapeHtml(displayValue(value))}</td>`
        })
        .join('')
      return `<tr class="${index % 2 === 1 ? 'alt' : ''}">${cells}</tr>`
    })
    .join('')

  const subtitle = payload.subtitle?.trim()

  return `<!doctype html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(payload.title)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${FONT_STACK};
    color: #26262E;
    font-size: 9pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    padding-bottom: 10px;
    border-bottom: 3px solid ${GOLD};
    margin-bottom: 14px;
  }
  .brand {
    font-size: 7.5pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${GOLD};
    font-weight: 700;
  }
  h1 {
    margin: 5px 0 0;
    font-size: 17pt;
    line-height: 1.2;
    color: ${INK};
    font-weight: 700;
  }
  .subtitle { margin-top: 4px; font-size: 9pt; color: ${MUTED}; }
  .meta { text-align: end; font-size: 8.5pt; color: ${MUTED}; line-height: 1.6; white-space: nowrap; }
  .meta strong { color: ${INK}; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th {
    background: ${INK};
    color: #F5F3EF;
    font-size: 8.5pt;
    font-weight: 600;
    padding: 7px 8px;
    border: 1px solid ${INK};
    white-space: nowrap;
  }
  td {
    padding: 6px 8px;
    border: 1px solid ${LINE};
    font-size: 9pt;
    color: #26262E;
    word-break: break-word;
  }
  tr.alt td { background: #FAF9F7; }
  .is-center { text-align: center; }
  .is-end { text-align: end; }
  .is-start { text-align: start; }
  .is-num { font-variant-numeric: tabular-nums; }
  .report-foot {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid ${LINE};
    font-size: 8pt;
    color: ${MUTED};
  }
</style>
</head>
<body>
  <header class="report-head">
    <div>
      <div class="brand">HR System</div>
      <h1>${escapeHtml(payload.title)}</h1>
      ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div class="meta">
      <div>${escapeHtml(generatedAt)}</div>
      <div><strong>${payload.rows.length}</strong> ${rtl ? 'سجل' : 'rows'}</div>
    </div>
  </header>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <footer class="report-foot">
    <span>${escapeHtml(payload.title)}</span>
    <span>${escapeHtml(generatedAt)}</span>
  </footer>
</body>
</html>`
}

/** Renders the report into a PDF buffer using a hidden Chromium window. */
export async function renderPdfBuffer(payload: ExportPayload): Promise<Buffer> {
  const html = renderReportHtml(payload)
  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true }
  })
  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      displayHeaderFooter: false,
      pageSize: 'A4',
      landscape: payload.columns.length > 7,
      margins: { top: 0.5, bottom: 0.5, left: 0.45, right: 0.45 }
    })
    return Buffer.from(pdf)
  } finally {
    pdfWindow.destroy()
  }
}

export async function exportToPdf(payload: ExportPayload): Promise<string | null> {
  const buffer = await renderPdfBuffer(payload)
  return saveWithDialog(payload, 'pdf', buffer)
}

/* ---------------------------------- Excel --------------------------------- */

const GOLD_ARGB = 'FFE0A437'
const INK_ARGB = 'FF14141D'
const LINE_ARGB = 'FFE6E4DF'
const BAND_ARGB = 'FFFAF9F7'
const PAPER_ARGB = 'FFF7F5F0'
const TEXT_ARGB = 'FF26262E'
const MUTED_ARGB = 'FF6B6B7B'

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: LINE_ARGB } },
  left: { style: 'thin', color: { argb: LINE_ARGB } },
  bottom: { style: 'thin', color: { argb: LINE_ARGB } },
  right: { style: 'thin', color: { argb: LINE_ARGB } }
}

function fillOf(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

/** Builds the styled workbook — exported for tests; the Electron path wraps it. */
export function buildWorkbook(payload: ExportPayload): ExcelJS.Workbook {
  assertPayload(payload)
  const rtl = payload.direction !== 'ltr'
  const columnCount = payload.columns.length
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'HR System'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(sheetNameOf(payload), {
    views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 3, activeCell: 'A4' }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: columnCount > 7 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  })

  sheet.columns = payload.columns.map((column) => ({ width: column.width ?? 16 }))
  const start = rtl ? 'right' : 'left'
  const end = rtl ? 'left' : 'right'
  const horizontalOf = (align: ExportColumn['align']): 'left' | 'right' | 'center' =>
    align === 'center' ? 'center' : align === 'end' ? end : start

  // 1) title band — styled before merging (only the master cell keeps styles)
  const titleRow = sheet.addRow([payload.title])
  titleRow.height = 30
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    titleRow.getCell(columnNumber).fill = fillOf(INK_ARGB)
  }
  titleRow.getCell(1).font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: start, indent: 1 }
  if (columnCount > 1) sheet.mergeCells(1, 1, 1, columnCount)

  // 2) subtitle band
  const subtitleRow = sheet.addRow([payload.subtitle ?? ''])
  subtitleRow.height = 20
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    subtitleRow.getCell(columnNumber).fill = fillOf(PAPER_ARGB)
  }
  subtitleRow.getCell(1).font = { name: 'Segoe UI', size: 10, color: { argb: MUTED_ARGB } }
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: start, indent: 1 }
  if (columnCount > 1) sheet.mergeCells(2, 1, 2, columnCount)

  // 3) header row — the freeze/filter anchor
  const headerRow = sheet.addRow(payload.columns.map((column) => column.label))
  headerRow.height = 24
  headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const column = payload.columns[columnNumber - 1]
    cell.fill = fillOf(GOLD_ARGB)
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: INK_ARGB } }
    cell.alignment = { vertical: 'middle', horizontal: horizontalOf(column?.align) }
    cell.border = thinBorder
  })
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnCount } }

  // 4) banded data rows
  payload.rows.forEach((row, index) => {
    // Empty cells render as an em dash so the sheet matches the PDF exactly.
    const dataRow = sheet.addRow(
      payload.columns.map((_, columnIndex) => {
        const value = row[columnIndex]
        return value === null || value === undefined || value === '' ? '—' : value
      })
    )
    dataRow.height = 19
    dataRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const column = payload.columns[columnNumber - 1]
      if (index % 2 === 1) cell.fill = fillOf(BAND_ARGB)
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: TEXT_ARGB } }
      cell.border = thinBorder
      cell.alignment = { vertical: 'middle', horizontal: horizontalOf(column?.align), wrapText: false }
      if (column?.format && typeof cell.value === 'number') cell.numFmt = column.format
    })
  })

  return workbook
}

export async function buildExcelBuffer(payload: ExportPayload): Promise<Buffer> {
  const workbook = buildWorkbook(payload)
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function exportToExcel(payload: ExportPayload): Promise<string | null> {
  const buffer = await buildExcelBuffer(payload)
  return saveWithDialog(payload, 'xlsx', buffer)
}
