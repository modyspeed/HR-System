/**
 * استخراج «مفردات» ظرف المرتب/الحافز إلى بنود مستقلة.
 *
 * كل ظرف (صفحة واحدة من كشف PDF) يطبع جدولاً من عمودين متجاورين لكل جهة:
 *   الاستقطاعات (المسحوبات) | القيمة  ...  الاستحقاقات (المستحقات) | القيمة
 * إضافةً إلى عمود «الرصيد» (رصيد السلفة المستحقة).
 *
 * القراءة تتم من مواضع عناصر النص (x/y) داخل الصفحة، لا من خلايا جدول مُكتشَف:
 * فبعض الصفوف (مثل صفّ مكافأة التشجيعية) تُسندها خوارزمية الجداول إلى
 * خلايا مزاحة، بينما مواضعها الحقيقية صحيحة تمامًا.
 *
 * النتيجة: قائمة بنود لكل صفحة (بند/قيمة/نوع/ترتيب) تُخزَّن في جدول
 * PayrollItem، فيصبح لكل بند عمود واحد في مصفوفة «مفردات الشهر».
 */
import { PDFParse } from 'pdf-parse'
import type {
  AbsenceRow,
  AbsencesReport,
  PayrollItemColumn,
  PayrollItemKind,
  PayrollItemRow,
  PayrollItemsMatrix
} from '../../shared/types'
import { itemLabelKey, normalizeItemText } from './payroll-text'

export { itemLabelKey, normalizeItemText } from './payroll-text'

/** المسافة القصوى بين عمود القيمة ومرجعه. */
const VALUE_TOLERANCE = 26
/** الحد الفاصل بين نطاق البند المستحَق ونطاق بند المسحوب. */
const LABEL_TOLERANCE = 26
/** تسامح تجميع العناصر في سطر واحد (الفرق بين y لعنصرين متجاورين). */
const ROW_TOLERANCE = 3.5

const TOTAL_MARKERS = /(اجمالي|اجمالى|اجماليه|صافي|صافى|صافيه|الاجمالي)/

/** يقرأ رقمًا بصيغة عربية أو لاتينية (الفاصلة العشرية «٫» أو «.»). */
export function parseItemValue(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw
    .replace(/[\u0660-\u0669]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u066B]/g, '.')
    .replace(/[,\u066C\s]/g, '')
  if (!/^\d*\.?\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/* ------------------------------- page geometry ----------------------------- */

interface PositionedText {
  text: string
  x: number
  y: number
}

interface PageLike {
  getTextContent: () => Promise<{ items: unknown[] }>
  cleanup?: () => void
}

interface ParserInternals {
  load: () => Promise<void>
  doc?: { numPages: number; getPage: (pageNumber: number) => Promise<PageLike> }
}

interface TextItemLike {
  str?: string
  transform?: number[]
}

/** يجمع عناصر الصفحة في أسطر (بتجميع y المتقاربة) مرتّبة من اليمين لليسار. */
function groupIntoRows(items: PositionedText[]): PositionedText[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || b.x - a.x)
  const rows: PositionedText[][] = []
  let current: PositionedText[] = []
  let anchor = 0

  for (const item of sorted) {
    if (current.length === 0 || Math.abs(item.y - anchor) <= ROW_TOLERANCE) {
      current.push(item)
      anchor = current.length === 1 ? item.y : (anchor + item.y) / 2
      continue
    }
    rows.push(current)
    current = [item]
    anchor = item.y
  }
  if (current.length > 0) rows.push(current)
  return rows
}

/** أعمدة الجدول كما تُستنتج من صف العنوان. */
interface ColumnAnchors {
  earnValue: number
  earnLabel: number
  deductionValue: number
  deductionLabel: number
  balance: number | null
}

function detectAnchors(row: PositionedText[]): ColumnAnchors | null {
  const cells = row.map((item) => ({ ...item, label: normalizeItemText(item.text) }))
  const earnLabelCell = cells.find((cell) => cell.label === 'الاستحقاقات')
  const deductionLabelCell = cells.find((cell) => cell.label === 'الاستقطاعات')
  if (!earnLabelCell && !deductionLabelCell) return null

  const valueCells = cells.filter((cell) => cell.label === 'القيمة')
  const valueBefore = (limit: number): number => {
    const candidates = valueCells.filter((cell) => cell.x < limit)
    return candidates.length > 0 ? Math.max(...candidates.map((cell) => cell.x)) : Number.NaN
  }
  const balanceCell = cells.find((cell) => cell.label === 'الرصيد')

  const earnLabel = earnLabelCell?.x ?? Number.NaN
  const deductionLabel = deductionLabelCell?.x ?? Number.NaN

  return {
    earnLabel,
    earnValue: Number.isNaN(earnLabel) ? Number.NaN : valueBefore(earnLabel),
    deductionLabel,
    deductionValue: Number.isNaN(deductionLabel) ? Number.NaN : valueBefore(deductionLabel),
    balance: balanceCell?.x ?? null
  }
}

interface RowValues {
  earningLabel: string | null
  earningValue: number | null
  deductionLabel: string | null
  deductionValue: number | null
  balance: number | null
}

/** يوزّع عناصر السطر على أعمدة الجدول بحسب موضعها ونوعها. */
function readRow(row: PositionedText[], anchors: ColumnAnchors): RowValues {
  const result: RowValues = {
    earningLabel: null,
    earningValue: null,
    deductionLabel: null,
    deductionValue: null,
    balance: null
  }

  for (const item of row) {
    const text = normalizeItemText(item.text)
    if (!text) continue
    const value = parseItemValue(text)

    if (value !== null) {
      const candidates: { key: string; x: number }[] = []
      if (!Number.isNaN(anchors.earnValue)) {
        candidates.push({ key: 'earn', x: anchors.earnValue })
      }
      if (!Number.isNaN(anchors.deductionValue)) {
        candidates.push({ key: 'deduction', x: anchors.deductionValue })
      }
      if (anchors.balance !== null) {
        candidates.push({ key: 'balance', x: anchors.balance })
      }
      const distance = candidates
        .map((candidate) => ({ key: candidate.key, distance: Math.abs(item.x - candidate.x) }))
        .sort((a, b) => a.distance - b.distance)

      const nearest = distance[0]
      if (nearest && nearest.distance <= VALUE_TOLERANCE) {
        if (nearest.key === 'earn' && result.earningValue === null) result.earningValue = value
        else if (nearest.key === 'deduction' && result.deductionValue === null) {
          result.deductionValue = value
        } else if (nearest.key === 'balance' && result.balance === null) result.balance = value
        continue
      }
      // رقم لا يطابق عمودًا معروفًا — نتجاهله (أرقام خارج الجدول).
      continue
    }

    // نص ⇒ اسم بند: يحدده نطاقه الأفقي.
    if (!Number.isNaN(anchors.earnValue) && item.x > anchors.earnValue + LABEL_TOLERANCE) {
      if (result.earningLabel === null) result.earningLabel = text
      continue
    }
    if (
      !Number.isNaN(anchors.deductionValue) &&
      item.x > anchors.deductionValue + LABEL_TOLERANCE &&
      (Number.isNaN(anchors.earnValue) || item.x <= anchors.earnValue - LABEL_TOLERANCE)
    ) {
      if (result.deductionLabel === null) result.deductionLabel = text
      continue
    }
  }

  return result
}

/** يحوّل صفحة واحدة إلى بنودها. */
function extractPageItems(items: PositionedText[]): PayrollItemRow[] {
  const rows = groupIntoRows(items)
  const headerIndex = rows.findIndex((row) => {
    const labels = row.map((item) => normalizeItemText(item.text))
    return labels.includes('الاستحقاقات') || labels.includes('الاستقطاعات')
  })
  if (headerIndex < 0) return []

  const anchors = detectAnchors(rows[headerIndex])
  if (!anchors) return []

  const result: PayrollItemRow[] = []
  let sortOrder = 0

  const push = (
    kind: PayrollItemKind,
    label: string | null,
    value: number | null,
    balance: number | null
  ): void => {
    if (!label || value === null) return
    result.push({
      kind,
      label,
      labelKey: itemLabelKey(label),
      value,
      balance,
      sortOrder: sortOrder++
    })
  }

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const values = readRow(rows[i], anchors)
    const labels = [values.earningLabel, values.deductionLabel].filter(Boolean) as string[]

    // صفوف الإجماليات والصافي تُوقف الجدول — ما بعدها ليس بنودًا.
    if (labels.some((label) => TOTAL_MARKERS.test(label))) break
    if (labels.length === 0 && values.balance === null) continue

    // الرصيد يخصّ سلفة السطر (بند المسحوبات) — يُربط به مرة واحدة فقط.
    push('earning', values.earningLabel, values.earningValue, null)
    push('deduction', values.deductionLabel, values.deductionValue, values.balance)
    if (!values.earningLabel && !values.deductionLabel && values.balance !== null) {
      push('balance', 'الرصيد', values.balance, values.balance)
    }
  }

  return result
}

/** مفتاح حقل الغياب: «غياب بدون اذن:-» ⇒ «غياببدوناذن». */
function absenceFieldKey(text: string): string {
  return normalizeItemText(text)
    .replace(/\s+/g, '')
    .replace(/[:\-–—،,.]+$/g, '')
}

/** يصنّف حقل رأس الظرف إلى نوع غياب، أو `null` لغير حقول الغياب. */
export function classifyAbsenceField(text: string): 'withoutPermission' | 'withPermission' | null {
  const key = absenceFieldKey(text)
  if (!key.includes('غياب')) return null
  if (key.includes('بدوناذن')) return 'withoutPermission'
  if (key.includes('باذن')) return 'withPermission'
  return null
}

/**
 * يقرأ أيام الغياب من سطور رأس الظرف.
 *
 * الحقول المطلوبة تقع **فوق** جدول البنود: في ظرف الحافز عند y≈311 مقابل
 * رأس الجدول عند y≈273، وفي ظرف المرتب رأس الجدول عند y≈313 بينما بند
 * «غياب بدون اذن» (وهو **مبلغ** لا عدد أيام) عند y≈233 — أي أسفل الرأس.
 * لذلك نقتصر على السطور التي تسبق رأس الجدول، فلا نخلط مبلغ الغياب بأيامه.
 */
function readAbsenceDays(rows: PositionedText[][]): SlipAbsenceDays {
  const result: SlipAbsenceDays = { withoutPermission: null, withPermission: null }

  const headerIndex = rows.findIndex((row) => {
    const labels = row.map((item) => normalizeItemText(item.text))
    return labels.includes('الاستحقاقات') || labels.includes('الاستقطاعات')
  })
  const headerRows = headerIndex >= 0 ? rows.slice(0, headerIndex) : rows

  for (const row of headerRows) {
    for (const item of row) {
      const kind = classifyAbsenceField(item.text)
      if (!kind) continue

      // القيمة تقع يسار التسمية في السطر نفسه (اتجاه صفحة الـPDF من اليمين لليسار).
      const candidates = row
        .filter((candidate) => candidate.x < item.x)
        .map((candidate) => ({
          x: candidate.x,
          value: parseItemValue(normalizeItemText(candidate.text))
        }))
        .filter((candidate): candidate is { x: number; value: number } => candidate.value !== null)
        .sort((a, b) => b.x - a.x)

      const value = candidates[0]?.value ?? null
      if (kind === 'withoutPermission') result.withoutPermission = value
      else result.withPermission = value
    }
  }

  return result
}

export interface PayrollItemsParseResult {
  /** بنود كل صفحة من الملف — المفتاح رقم الصفحة (يبدأ من 1). */
  byPage: Map<number, PayrollItemRow[]>
  /** أيام الغياب لكل صفحة — المفتاح رقم الصفحة (يبدأ من 1). */
  absencesByPage: Map<number, SlipAbsenceDays>
  pages: number
}

/**
 * أيام الغياب المقروءة من رأس الظرف (فوق جدول البنود):
 *   «غياب بدون اذن:- ٨» ⇒ withoutPermission = 8
 *   «غياب باذن:- ٠٫٥»  ⇒ withPermission = 0.5
 */
export interface SlipAbsenceDays {
  /** أيام الغياب بدون إذن. */
  withoutPermission: number | null
  /** أيام الغياب بإذن. */
  withPermission: number | null
}

/**
 * يقرأ كشف المرتب/الحافز كاملًا ويستخرج مفردات كل ظرف فيه.
 * المسار الأساسي يعتمد مواضع عناصر النص، والبديل يعتمد خلايا الجدول
 * المكتشَف (احتياط لو تغيّرت واجهة pdf-parse الداخلية).
 */
export async function extractPayrollItems(buffer: Buffer): Promise<PayrollItemsParseResult> {
  const byGeometry = await extractByGeometry(buffer)
  if (byGeometry.byPage.size > 0) return byGeometry

  const byTable = await extractByTables(buffer)
  if (byTable.byPage.size > 0) return byTable

  return { byPage: new Map(), absencesByPage: new Map(), pages: 0 }
}

/** الاستخراج بالإحداثيات — الأدق: يقرأ موضع كل عنصر في الصفحة. */
async function extractByGeometry(buffer: Buffer): Promise<PayrollItemsParseResult> {
  const byPage = new Map<number, PayrollItemRow[]>()
  const absencesByPage = new Map<number, SlipAbsenceDays>()
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const internals = parser as unknown as ParserInternals

  try {
    await internals.load()
    const doc = internals.doc
    if (!doc) return { byPage, absencesByPage, pages: 0 }

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        const items: PositionedText[] = (content.items as TextItemLike[])
          .filter((item) => typeof item.str === 'string' && item.str.trim() !== '')
          .map((item) => ({
            text: item.str as string,
            x: item.transform?.[4] ?? 0,
            y: item.transform?.[5] ?? 0
          }))
        absencesByPage.set(pageNumber, readAbsenceDays(groupIntoRows(items)))
        const parsed = extractPageItems(items)
        if (parsed.length > 0) byPage.set(pageNumber, parsed)
      } finally {
        page.cleanup?.()
      }
    }

    return { byPage, absencesByPage, pages: doc.numPages }
  } catch {
    return { byPage: new Map(), absencesByPage: new Map(), pages: 0 }
  }
}

/* --------------------------- fallback: table cells -------------------------- */

interface TableColumns {
  balance: number
  deductionLabel: number
  deductionValue: number
  earningLabel: number
  earningValue: number
}

/** يحدد أعمدة الجدول من صف العنوان («الرصيد | القيمة | الاستقطاعات | …»). */
function detectColumns(header: string[]): TableColumns | null {
  const cells = header.map((cell) => normalizeItemText(cell))
  const indexOfCell = (needle: string): number => cells.findIndex((cell) => cell === needle)

  const balance = indexOfCell('الرصيد')
  const deductionLabel = indexOfCell('الاستقطاعات')
  const earningLabel = indexOfCell('الاستحقاقات')
  if (deductionLabel < 0 && earningLabel < 0) return null

  const valueBefore = (from: number): number => {
    for (let i = from - 1; i >= 0; i -= 1) {
      if (cells[i] === 'القيمة') return i
    }
    return -1
  }

  return {
    balance,
    deductionLabel,
    deductionValue: deductionLabel >= 0 ? valueBefore(deductionLabel) : -1,
    earningLabel,
    earningValue: earningLabel >= 0 ? valueBefore(earningLabel) : -1
  }
}

function cellAt(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return ''
  return normalizeItemText(row[index] ?? '')
}

/** يحوّل جدول ظرف واحد إلى بنوده (المسار الاحتياطي). */
export function parseSlipTableItems(table: string[][]): PayrollItemRow[] {
  const headerIndex = table.findIndex((row) => {
    const cells = row.map((cell) => normalizeItemText(cell))
    return cells.includes('الاستحقاقات') || cells.includes('الاستقطاعات')
  })
  if (headerIndex < 0) return []

  const columns = detectColumns(table[headerIndex])
  if (!columns) return []

  const items: PayrollItemRow[] = []
  let sortOrder = 0

  const push = (
    kind: PayrollItemKind,
    rawLabel: string,
    rawValue: string | null,
    balance: number | null = null
  ): void => {
    const label = normalizeItemText(rawLabel)
    if (!label) return
    const value = parseItemValue(rawValue)
    if (value === null) return
    items.push({
      kind,
      label,
      labelKey: itemLabelKey(label),
      value,
      balance,
      sortOrder: sortOrder++
    })
  }

  for (let i = headerIndex + 1; i < table.length; i += 1) {
    const row = table[i]
    const deductionLabel = cellAt(row, columns.deductionLabel)
    const earningLabel = cellAt(row, columns.earningLabel)

    if (
      (deductionLabel && TOTAL_MARKERS.test(deductionLabel)) ||
      (earningLabel && TOTAL_MARKERS.test(earningLabel))
    ) {
      break
    }

    const balance = parseItemValue(cellAt(row, columns.balance))

    if (deductionLabel) {
      push('deduction', deductionLabel, cellAt(row, columns.deductionValue), balance)
    }
    if (earningLabel) {
      push('earning', earningLabel, cellAt(row, columns.earningValue), balance)
    }
    if (!deductionLabel && !earningLabel && balance !== null) {
      push('balance', 'الرصيد', String(balance), balance)
    }
  }

  return items
}

/** الاستخراج بخلايا الجدول المكتشَف (بديل). */
async function extractByTables(buffer: Buffer): Promise<PayrollItemsParseResult> {
  const byPage = new Map<number, PayrollItemRow[]>()
  // المسار البديل بلا إحداثيات، فلا تُقرأ منه أيام الغياب.
  const absencesByPage = new Map<number, SlipAbsenceDays>()
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getTable()
    for (const page of result.pages ?? []) {
      const items: PayrollItemRow[] = []
      for (const table of page.tables ?? []) {
        items.push(...parseSlipTableItems(table))
      }
      if (items.length > 0) byPage.set(page.num, items)
    }
    return { byPage, absencesByPage, pages: result.pages?.length ?? 0 }
  } catch {
    return { byPage, absencesByPage, pages: 0 }
  }
}

/* ----------------------------- matrix assembly ----------------------------- */

/** ترتيب البنود داخل المصفوفة: المستحقات أولًا ثم المسحوبات. */
const KIND_ORDER: Record<PayrollItemKind, number> = { earning: 0, deduction: 1, balance: 2 }

/** ظرف واحد جاهز للتجميع في المصفوفة. */
export interface MatrixEntry {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  totalEarned: number | null
  totalDeductions: number | null
  netSalary: number | null
  items: {
    kind: string
    label: string
    labelKey: string
    value: number
    balance: number | null
    sortOrder: number
  }[]
}

/**
 * يبني مصفوفة المفردات: الأعمدة من بنود الأظرف (بند واحد ⇒ عمود واحد)
 * والصفوف من الموظفين — كل صف يحمل قيمة كل بند في موضعه.
 */
export function buildItemsMatrix(params: {
  type: string
  period: string
  month: number
  year: number
  fileName: string | null
  entries: MatrixEntry[]
}): PayrollItemsMatrix {
  const columnMap = new Map<string, PayrollItemColumn & { firstOrder: number }>()

  for (const entry of params.entries) {
    for (const item of entry.items) {
      if (item.kind === 'balance') continue
      const existing = columnMap.get(item.labelKey)
      if (existing) {
        existing.count += 1
        existing.total += item.value
        existing.firstOrder = Math.min(existing.firstOrder, item.sortOrder)
        continue
      }
      columnMap.set(item.labelKey, {
        key: item.labelKey,
        label: item.label,
        kind: item.kind as PayrollItemKind,
        count: 1,
        total: item.value,
        firstOrder: item.sortOrder
      })
    }
  }

  const columns = [...columnMap.values()]
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        a.firstOrder - b.firstOrder ||
        a.label.localeCompare(b.label, 'ar')
    )
    .map(({ firstOrder: _firstOrder, ...column }) => column)

  const indexByKey = new Map(columns.map((column, index) => [column.key, index]))

  const rows = params.entries.map((entry) => {
    const values: (number | null)[] = new Array(columns.length).fill(null)
    let balance = 0
    let earningsTotal = 0
    let deductionsTotal = 0
    for (const item of entry.items) {
      balance += item.balance ?? 0
      if (item.kind === 'balance') continue
      if (item.kind === 'earning') earningsTotal += item.value
      else deductionsTotal += item.value
      const index = indexByKey.get(item.labelKey)
      if (index === undefined) continue
      values[index] = (values[index] ?? 0) + item.value
    }
    return {
      entryId: entry.id,
      employeeId: entry.employeeId,
      employeeCode: entry.employeeCode,
      employeeName: entry.employeeName,
      departmentName: entry.departmentName,
      values,
      balance: Math.round(balance * 100) / 100,
      earningsTotal: Math.round(earningsTotal * 100) / 100,
      deductionsTotal: Math.round(deductionsTotal * 100) / 100,
      totalEarned: entry.totalEarned,
      totalDeductions: entry.totalDeductions,
      netSalary: entry.netSalary
    }
  })

  const extracted = params.entries.filter((entry) => entry.items.length > 0).length

  return {
    type: params.type,
    period: params.period,
    month: params.month,
    year: params.year,
    fileName: params.fileName,
    columns,
    rows,
    totals: columns.map((column) => column.total),
    extracted,
    pending: params.entries.length - extracted
  }
}

/* -------------------------------- absences -------------------------------- */

/**
 * ظرف واحد مساهم في تقرير الغيابات — أيامه مقروءة من رأس الظرف.
 *
 * الأيام من نوع `incentive` فقط: ظرف الحافز يحمل «غياب بدون اذن:- ٨» و
 * «غياب باذن:- ٠٫٥» في رأسه، بينما في ظرف المرتب يظهر «غياب بدون اذن»
 * **مبلغًا** ضمن بنود الجدول لا عددًا من الأيام.
 */
export interface AbsenceEntry {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  /** أيام الغياب بإذن كما وردت في رأس الظرف. */
  withPermissionDays: number | null
  /** أيام الغياب بدون إذن كما وردت في رأس الظرف. */
  withoutPermissionDays: number | null
}

/**
 * يبني تقرير الغيابات: صف لكل موظف له أيام غياب في الشهر، مرتَّب
 * بالأشدّ أولًا (من غاب بدون إذن ثم من غاب بإذن).
 */
export function buildAbsencesReport(params: {
  period: string
  month: number
  year: number
  fileNames: string[]
  /** أنواع الأظرف الموجودة في الشهر. */
  slipTypes: string[]
  /** عدد كشوف الشهر التي فُحصت لأيام الغياب. */
  scannedBatches: number
  /** إجمالي كشوف الشهر. */
  totalBatches: number
  /** كشوف ملفها غير موجود في الأرشيف. */
  missingFiles: string[]
  entries: AbsenceEntry[]
}): AbsencesReport {
  // يُجمَّع للموظف الواحد كله: لو وردت أيامه في أكثر من ظرف (مرتب وحافز)
  // صارت له صف واحد لا صف لكل ظرف. وتُؤخذ بيانات الموظف (الاسم والقسم) من
  // الظرف الذي يحمل أيامه — وهو ظرف الحافز؛ فالقسم يُستنتج لكل ظرف على
  // حدة، وقد يختلف بين ظرف المرتب وظرف الحافز لنفس الموظف في الشهر نفسه.
  const byEmployee = new Map<string, AbsenceRow & { hasDays: boolean }>()
  for (const entry of params.entries) {
    const withPermission = entry.withPermissionDays ?? 0
    const withoutPermission = entry.withoutPermissionDays ?? 0
    const hasDays = withPermission !== 0 || withoutPermission !== 0
    const existing = byEmployee.get(entry.employeeId)
    if (existing) {
      existing.withPermission += withPermission
      existing.withoutPermission += withoutPermission
      if (hasDays && !existing.hasDays) {
        existing.employeeCode = entry.employeeCode
        existing.employeeName = entry.employeeName
        existing.departmentName = entry.departmentName
        existing.hasDays = true
      }
      continue
    }
    byEmployee.set(entry.employeeId, {
      employeeId: entry.employeeId,
      employeeCode: entry.employeeCode,
      employeeName: entry.employeeName,
      departmentName: entry.departmentName,
      withPermission,
      withoutPermission,
      total: 0,
      hasDays
    })
  }

  const rows = [...byEmployee.values()]
    .map(({ hasDays: _hasDays, ...row }) => ({
      ...row,
      withPermission: Math.round(row.withPermission * 100) / 100,
      withoutPermission: Math.round(row.withoutPermission * 100) / 100,
      total: Math.round((row.withPermission + row.withoutPermission) * 100) / 100
    }))
    .filter((row) => row.total !== 0)
    .sort(
      (a, b) =>
        b.withoutPermission - a.withoutPermission ||
        b.withPermission - a.withPermission ||
        b.total - a.total ||
        a.employeeCode.localeCompare(b.employeeCode)
    )

  const totals = rows.reduce(
    (acc, row) => ({
      withPermission: acc.withPermission + row.withPermission,
      withoutPermission: acc.withoutPermission + row.withoutPermission,
      total: acc.total + row.total
    }),
    { withPermission: 0, withoutPermission: 0, total: 0 }
  )

  return {
    period: params.period,
    month: params.month,
    year: params.year,
    fileNames: params.fileNames,
    slipTypes: params.slipTypes,
    scanned: params.totalBatches > 0 && params.scannedBatches === params.totalBatches,
    scannedBatches: params.scannedBatches,
    totalBatches: params.totalBatches,
    missingFiles: params.missingFiles,
    rows,
    totals: {
      withPermission: Math.round(totals.withPermission * 100) / 100,
      withoutPermission: Math.round(totals.withoutPermission * 100) / 100,
      total: Math.round(totals.total * 100) / 100
    },
    employees: rows.length
  }
}
