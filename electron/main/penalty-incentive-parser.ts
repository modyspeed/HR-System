/**
 * ملف «الحرمان من الحافز-الشهر.pdf»: كل صفحة مجموعة موظفين بأعمدة (رقم
 * العامل / اسم العامل / نسبة الخصم / نسبة القسم / قيمة الخصم) ككتل قبل
 * تسمياتها — يُستخرج نسبة الخصم وقيمة الخصم ويُطابق الكود ثم الاسم مع
 * الموظفين، والشهر من اسم الملف.
 */
import { PDFParse } from 'pdf-parse'
import { ApiError } from '../../shared/types'
import type { PenaltyRateParseResult, PenaltyRateParseRow } from '../../shared/types'

export interface PenaltyEmployeeRef {
  id: string
  code: string
  name: string
}

function nameKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/[^0-9a-zA-Zا-ي]/g, '')
}

function normalizePage(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫]/g, '.')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/[^0-9a-zA-Zا-ي.\n %]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim()
}

const numeric = (line: string) => {
  const value = Number(line.endsWith('%') ? line.slice(0, -1) : line)
  return Number.isFinite(value) ? value : null
}

function slotsOf(text: string): {
  codes: string[]
  names: string[]
  rates: number[]
  amounts: number[]
} {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const noId = lines.findIndex((line) => line === 'رقم' || line.includes('رقم العامل'))
  const nameIndex = lines.findIndex((line) => line.includes('اسم العامل'))
  const deptIndex = lines.findIndex((line) => line.includes('اسم القسم'))
  const ratioIndexes = lines
    .map((line, index) => (line === 'نسبة' ? index : -1))
    .filter((index) => index >= 0)
  const amountIndex = lines.findIndex((line) => line === 'قيمة')
  if (noId < 0 || nameIndex < 0 || deptIndex < 0 || ratioIndexes.length < 2 || amountIndex < 0) {
    return { codes: [], names: [], rates: [], amounts: [] }
  }

  const codes = lines.slice(0, noId).filter((line) => /^\d{3,8}$/.test(line))
  const names = lines.slice(noId + 2, nameIndex)
  const count = names.length || codes.length
  if (count === 0) return { codes: [], names: [], rates: [], amounts: [] }

  const firstRatio = lines
    .slice(deptIndex + 1, ratioIndexes[0])
    .map(numeric)
    .filter((value): value is number => value !== null)
    .slice(0, count)
  const amounts = lines
    .slice(amountIndex + 2, amountIndex + 2 + count)
    .map(numeric)
    .filter((value): value is number => value !== null)
    .slice(0, count)

  return { codes, names, rates: firstRatio, amounts }
}

export function detectPenaltyPeriod(
  fileName: string,
  firstPageText: string
): { month: number; year: number } {
  const fileMatch = fileName.match(/(\d{2})(\d{4})\.pdf/i)
  if (fileMatch) {
    const month = Number(fileMatch[1])
    const year = Number(fileMatch[2])
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { month, year }
    }
  }
  const textMatch = firstPageText.match(/حرمان[^\n]*\s*(\d{2})\s+(\d{4})/)
  if (textMatch) return { month: Number(textMatch[1]), year: Number(textMatch[2]) }
  return { month: 1, year: new Date().getFullYear() }
}

export async function parsePenaltyRatePdf({
  buffer,
  fileName,
  employees
}: {
  buffer: Buffer
  fileName: string
  employees: PenaltyEmployeeRef[]
}): Promise<PenaltyRateParseResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    const pages = result.pages ?? []
    if (pages.length === 0) throw new ApiError('VALIDATION', 'The PDF has no pages')

    const first = normalizePage(pages[0].text ?? '')
    const { month, year } = detectPenaltyPeriod(fileName, first)
    const period = `${year}-${String(month).padStart(2, '0')}`

    const byCode = new Map(employees.map((e) => [e.code.trim(), e]))
    const byName = new Map(employees.map((e) => [nameKey(e.name), e]))

    const rows: PenaltyRateParseRow[] = []
    let matched = 0
    let unmatched = 0

    pages.forEach((pageData, index) => {
      const page = index + 1
      const slots = slotsOf(normalizePage(pageData.text ?? ''))
      if (slots.names.length === 0 || slots.rates.length === 0) return

      slots.names.forEach((name, i) => {
        const code = slots.codes[i] ?? ''
        const rate = slots.rates[i] ?? Number.NaN
        const amount = slots.amounts[i] ?? Number.NaN
        if (!Number.isFinite(rate)) return

        let employee: PenaltyEmployeeRef | null = null
        let match: PenaltyRateParseRow['match'] = 'none'
        if (code) {
          employee = byCode.get(code) ?? null
          if (employee) match = 'code'
        }
        if (!employee) {
          employee = byName.get(nameKey(name)) ?? null
          if (employee) match = 'name'
        }
        if (employee) matched += 1
        else unmatched += 1

        rows.push({
          page,
          code,
          name,
          employeeId: employee?.id ?? null,
          match,
          rate,
          amount: Number.isFinite(amount) ? amount : 0
        })
      })
    })

    return { month, year, period, pageCount: pages.length, rows, matched, unmatched }
  } finally {
    await parser.destroy()
  }
}
