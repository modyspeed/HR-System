/**
 * ملف «نسب الحوافز الفردية-الشهر.pdf»: كل صفحة مجموعة موظفين بأعمدة
 * (كود الموظف / اسم العامل / النسبة) ككتل قبل تسمياتها، يُطابق الكود مع
 * الموظفين (ثم الاسم بعد التطبيع) والشهر من اسم الملف أو نص الصفحة.
 */
import { PDFParse } from 'pdf-parse'
import { ApiError } from '../../shared/types'
import type { EmployeeIncentiveRateParseResult, EmployeeIncentiveRateParseRow } from '../../shared/types'

export interface IncentiveEmployeeRef {
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

function slotsOf(text: string): { codes: string[]; names: string[]; rates: number[] } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const deptIndex = lines.findIndex((line) => line.includes('اسم القسم'))
  const employeeNoIndex = lines.findIndex((line) => line.includes('رقم العا'))
  const employeeNameIndex = lines.findIndex((line) => line.includes('اسم العامل'))
  const rateIndex = lines.findIndex((line) => line.includes('النسبة'))
  if (deptIndex < 0 || employeeNoIndex < 0 || employeeNameIndex < 0 || rateIndex < 0) {
    return { codes: [], names: [], rates: [] }
  }

  const codes = lines
    .slice(deptIndex + 1, employeeNoIndex)
    .filter((line) => /^\d{3,8}$/.test(line))
  const names = lines.slice(employeeNoIndex + 1, employeeNameIndex)
  const rates = lines
    .slice(employeeNameIndex + 1, rateIndex)
    .map((line) => (line.endsWith('%') ? line.slice(0, -1) : line))
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice(0, names.length)

  return { codes, names, rates }
}

/** «نسب_الحافز_الفردية-072026.pdf» أو «01 07 2026 شهر» داخل الصفحة. */
export function detectPeriod(
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
  const textMatch = firstPageText.match(/(\d{2})\s+(\d{2})\s+(\d{4})/)
  if (textMatch) return { month: Number(textMatch[2]), year: Number(textMatch[3]) }
  return { month: 1, year: new Date().getFullYear() }
}

export async function parseEmployeeIncentiveRatePdf({
  buffer,
  fileName,
  employees
}: {
  buffer: Buffer
  fileName: string
  employees: IncentiveEmployeeRef[]
}): Promise<EmployeeIncentiveRateParseResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    const pages = result.pages ?? []
    if (pages.length === 0) throw new ApiError('VALIDATION', 'The PDF has no pages')

    const first = normalizePage(pages[0].text ?? '')
    const { month, year } = detectPeriod(fileName, first)
    const period = `${year}-${String(month).padStart(2, '0')}`

    const byCode = new Map(employees.map((e) => [e.code.trim(), e]))
    const byName = new Map(employees.map((e) => [nameKey(e.name), e]))

    const rows: EmployeeIncentiveRateParseRow[] = []
    let matched = 0
    let unmatched = 0

    pages.forEach((pageData, index) => {
      const page = index + 1
      const slots = slotsOf(normalizePage(pageData.text ?? ''))
      if (slots.names.length === 0 || slots.rates.length === 0) return

      slots.names.forEach((name, i) => {
        const code = slots.codes[i] ?? ''
        const rate = slots.rates[i] ?? Number.NaN
        if (!Number.isFinite(rate)) return

        let employee: IncentiveEmployeeRef | null = null
        let match: EmployeeIncentiveRateParseRow['match'] = 'none'
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
          rate
        })
      })
    })

    return { month, year, period, pageCount: pages.length, rows, matched, unmatched }
  } finally {
    await parser.destroy()
  }
}
