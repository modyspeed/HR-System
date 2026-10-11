/**
 * ملف «نسب الحوافز للأقسام» PDF: كل صفحة تحمل ثلاثة أعمدة (كود القسم /
 * اسم القسم / النسبة) مكررة ككتل متتالية — تُقسَّم وتُطابق مع تبويب الأقسام
 * (بالكود ثم بالاسم بعد التطبيع)، والشهر/السنة من اسم الملف أو نص الصفحة.
 */
import { PDFParse } from 'pdf-parse'
import { ApiError } from '../../shared/types'
import type { IncentiveRateParseResult, IncentiveRateParseRow } from '../../shared/types'

export interface IncentiveDepartmentRef {
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

interface PageSlots {
  codes: string[]
  names: string[]
  rates: number[]
}

function slotsOf(text: string): PageSlots {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const codeIndex = lines.findIndex((line) => line.includes('كود القسم'))
  const nameIndex = lines.findIndex((line) => line.includes('اسم القسم'))
  const rateIndex = lines.findIndex((line) => line.includes('النسبة'))
  if (codeIndex < 0 || nameIndex < 0 || rateIndex < 0) {
    return { codes: [], names: [], rates: [] }
  }

  // الترتيب الفعلي في الملف: الكتل قبل تسمياتها (الأكواد ← التسمية، الأسماء ←
  // التسمية، النسب ← التسمية)، فتأخذ كل كتلة ما قبل تسمية العمود التالية.
  const codes = lines
    .slice(0, codeIndex)
    .filter((line) => /^\d{3,8}$/.test(line))
  const names = lines.slice(codeIndex + 1, nameIndex).filter((line) => line.length > 1)
  const rawRates = lines
    .slice(nameIndex + 1, rateIndex)
    .map((line) => (line.endsWith('%') ? line.slice(0, -1) : line))
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice(0, names.length)

  return { codes, names, rates: rawRates }
}

/** «نسب_الاقسام-082026.pdf» أو «شهر 08 2026» داخل الصفحة. */
export function detectRatePeriod(
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
  const textMatch = firstPageText.match(/شهر\s*(\d{2})\s*(\d{4})/)
  if (textMatch) return { month: Number(textMatch[1]), year: Number(textMatch[2]) }
  return { month: 1, year: new Date().getFullYear() }
}

export async function parseIncentiveRatePdf({
  buffer,
  fileName,
  departments
}: {
  buffer: Buffer
  fileName: string
  departments: IncentiveDepartmentRef[]
}): Promise<IncentiveRateParseResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    const pages = result.pages ?? []
    if (pages.length === 0) throw new ApiError('VALIDATION', 'The PDF has no pages')

    const first = normalizePage(pages[0].text ?? '')
    const { month, year } = detectRatePeriod(fileName, first)
    const period = `${year}-${String(month).padStart(2, '0')}`

    const byCode = new Map(departments.map((d) => [d.code.trim(), d]))
    const byName = new Map(departments.map((d) => [nameKey(d.name), d]))

    const rows: IncentiveRateParseRow[] = []
    let matched = 0
    let unmatched = 0

    pages.forEach((pageData, index) => {
      const page = index + 1
      const slots = slotsOf(normalizePage(pageData.text ?? ''))
      if (slots.rates.length === 0) return

      slots.names.forEach((name, i) => {
        const code = slots.codes[i] ?? ''
        const rate = slots.rates[i] ?? Number.NaN
        if (!Number.isFinite(rate)) return

        let department: IncentiveDepartmentRef | null = null
        let match: IncentiveRateParseRow['match'] = 'none'
        if (code) {
          department = byCode.get(code) ?? null
          if (department) match = 'code'
        }
        if (!department) {
          department = byName.get(nameKey(name)) ?? null
          if (department) match = 'name'
        }
        if (department) matched += 1
        else unmatched += 1

        rows.push({
          page,
          code,
          name,
          departmentId: department?.id ?? null,
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
