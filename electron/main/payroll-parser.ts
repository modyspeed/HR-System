/**
 * كشف الأجور PDF → أظرف موظفين.
 *
 * كل صفحة في ملف الكشف هي ظرف موظف يحمل رقمه واسمه وأرقامه (الأساسي، إجمالي
 * الاستحقاقات، الاستقطاعات، الصافي). النص المُستخرج من pdf-parse يخضع لـ
 * NFKC (تحويل أشكال العرض العربية وأرقام ٠-٩ إلى ASCII) ثم تنظيف (تشكيل،
 * تطويل ـ، همزات/ألفات موحّدة) فيصبح قابلاً للمطابقة المستقرة.
 *
 * الصيغتان المطلوبتان:
 *   - «مرتب شهر 092026.pdf»: 308 صفحات — الكود في سطر بعد «إجمالي الاستقطاعات».
 *   - «حافز 092026.pdf»:       303 صفحات — ««2094 الرقم :	الاسم»» في السطر الأول.
 */
import { PDFParse } from 'pdf-parse'
import {
  detectPayrollPeriod,
  detectPayrollType
} from '../../shared/payrolls'
import type { PayrollParseResult, PayrollParseRow } from '../../shared/types'

export interface PayrollEmployeeRef {
  id: string
  code: string
  name: string
}

const MAX_PAGES = 2000

/* ------------------------------- normalization ----------------------------- */

/** NFKC ثم إزالة التشكيل والتطويل وتوحيد الهمزات/الألفات/الياءات. */
export function normalizePayrollText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٫]/g, '.')
    .replace(/[,\u066C]/g, '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/[^0-9a-zA-Zا-ي.\n\t]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim()
}

/** مطابقة الأسماء — نفس تنظيف النص + إزالة المسافات. */
function nameKeyOf(name: string): string {
  return normalizePayrollText(name).replace(/\s+/g, '')
}

function firstNumber(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : null
}

function allNumbers(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
}

/* ------------------------------- per-page row ------------------------------ */

interface ParsedSlip {
  page: number
  code: string | null
  name: string | null
  basicSalary: number | null
  totalEarned: number | null
  totalDeductions: number | null
  netSalary: number | null
}

export function parseSlipPage(text: string, page: number): ParsedSlip | null {
  const lines = text.split('\n').map((line) => line.trim())
  const joined = lines.join('\n')

  // رقم الموظف: (أ) بجانب «الرقم» في ملف الحافز، (ب) بعد «إجمالي الاستقطاعات» في المرتب.
  let code: string | null = null
  const inlineCode = joined.match(/(?<!\d)(\d{3,7})(?!\d)\s*الرقم\s*:?\s*([^\n]+)/)
  if (inlineCode) {
    // «الرقم التأميني» يشبه السطر — نتجاهله ونعتمد على موضع «الاستقطاعات».
    if (inlineCode[2].trim().startsWith('التاميني')) {
      code = null
    } else {
      code = inlineCode[1]
    }
  } else {
    const afterTotals = joined.match(/اجمالي الاستقطاعات[^\n]*\n\s*(?<!\d)(\d{3,7})(?!\d)/)
    code = afterTotals?.[1] ?? null
    if (!code) {
      const index = lines.findIndex((line) => /اجمالي الاستقطاعات/.test(line))
      for (let i = index; i < Math.min(lines.length, index + 8); i += 1) {
        if (/^\d{3,7}$/.test(lines[i]) && !code) {
          code = lines[i]
          break
        }
      }
    }
  }

  // اسم الموظف — المقطع بجانب «الرقم».
  let name: string | null = null
  const region = joined.match(/الرقم[\s:]*([^\n]*?)\s*الرصيد/)
  if (region && !region[1].trim().startsWith('التاميني') && region[1].trim()) {
    name = region[1].trim()
  } else if (inlineCode && !inlineCode[2].trim().startsWith('التاميني')) {
    name = inlineCode[2].replace(/الرصيد.*$/, '').trim()
  }

  if (!code && !name) return null

  // الأساسي.
  let basicSalary: number | null = null
  const inlineBasic = joined.match(/(\d+(?:\.\d+)?)\s*الاساسي\s*:?/)
  if (inlineBasic) basicSalary = Number(inlineBasic[1])
  if (basicSalary === null && code) {
    const codeIndex = lines.findIndex(
      (line) => line.trim() === code || line.trim().startsWith(`${code} `)
    )
    if (codeIndex >= 0) {
      for (let i = codeIndex + 1; i < Math.min(lines.length, codeIndex + 4); i += 1) {
        const next = firstNumber(lines[i])
        if (next !== null) {
          basicSalary = next
          break
        }
      }
    }
  }

  // إجمالي الاستقطاعات — يظهر ملاصقاً للتسمية.
  const dedInline = joined.match(/(\d+(?:\.\d+)?)\s*اجمالي الاستقطاعات|اجمالي الاستقطاعات\s*:?\s*(\d+(?:\.\d+)?)/)
  const totalDeductions = firstNumber(dedInline?.[0] ?? '') ?? null

  // إجمالي الاستحقاقات والصافي — إما ملاصقان للتسمية أو في السطور المجاورة لها.
  let totalEarned: number | null = null
  let netSalary: number | null = null
  const grossLabelIndex = lines.findIndex((line) => /اجمالي الاستحقاقات/.test(line))
  if (grossLabelIndex >= 0) {
    const labelLine = lines[grossLabelIndex]
    const inlineGross = labelLine.match(/(\d+(?:\.\d+)?)\s*اجمالي الاستحقاقات/)
    if (inlineGross) {
      totalEarned = Number(inlineGross[1])
      netSalary =
        allNumbers(lines[grossLabelIndex + 1] ?? '')[0] ??
        null
    } else {
      const windowLines = lines.slice(Math.max(0, grossLabelIndex - 4), grossLabelIndex + 2)
      const candidates = windowLines.flatMap(allNumbers)
      const netNeighbour = allNumbers(lines[grossLabelIndex + 1] ?? '')[0] ?? null
      if (candidates.length > 0) {
        totalEarned = Math.max(...candidates)
        netSalary = netNeighbour ?? (candidates.length > 1 ? Math.min(...candidates) : null)
      }
    }
  }

  // الصافي المحسوب يغلب عند التعارض (الاستحقاقات − الاستقطاعات).
  if (totalEarned !== null && totalDeductions !== null) {
    const computed = Math.max(0, Math.round((totalEarned - totalDeductions) * 100) / 100)
    if (netSalary === null) netSalary = computed
    else if (Math.abs(netSalary - computed) > 0.5) netSalary = computed
  }

  return {
    page,
    code,
    name,
    basicSalary,
    totalEarned,
    totalDeductions,
    netSalary
  }
}

/* --------------------------------- exports -------------------------------- */

export interface ParsePayrollPdfOptions {
  buffer: Buffer
  fileName: string
  employees: PayrollEmployeeRef[]
}

export async function parsePayrollPdf({
  buffer,
  fileName,
  employees
}: ParsePayrollPdfOptions): Promise<PayrollParseResult> {
  const type = detectPayrollType(fileName)
  const detected = detectPayrollPeriod(fileName)

  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    const pages = (result.pages ?? []).slice(0, MAX_PAGES)

    let month = detected?.month ?? 1
    let year = detected?.year ?? new Date().getFullYear()
    if (!detected && pages.length > 0) {
      const slip = normalizePayrollText(pages[0].text ?? '')
      const monthMatch = slip.match(/عن شهر\s*(\d{2})[-/](\d{4})/)
      if (monthMatch) {
        month = Number(monthMatch[1])
        year = Number(monthMatch[2])
      }
    }
    const period = `${year}-${String(month).padStart(2, '0')}`

    const byCode = new Map(employees.map((employee) => [employee.code.trim(), employee]))
    const byName = new Map(employees.map((employee) => [nameKeyOf(employee.name), employee]))

    const rows: PayrollParseRow[] = []
    let matched = 0
    let unmatched = 0

    pages.forEach((pageData, index) => {
      const slip = parseSlipPage(normalizePayrollText(pageData.text ?? ''), index + 1)
      if (!slip) return

      let matchedEmployee: PayrollEmployeeRef | null = null
      let match: PayrollParseRow['match'] = 'none'
      if (slip.code) {
        matchedEmployee = byCode.get(slip.code) ?? null
        if (matchedEmployee) match = 'code'
      }
      if (!matchedEmployee && slip.name) {
        matchedEmployee = byName.get(nameKeyOf(slip.name)) ?? null
        if (matchedEmployee) match = 'name'
      }

      if (matchedEmployee) matched += 1
      else unmatched += 1

      rows.push({
        page: slip.page,
        code: slip.code ?? '',
        name: slip.name ?? '',
        employeeId: matchedEmployee?.id ?? null,
        match,
        basicSalary: slip.basicSalary,
        totalEarned: slip.totalEarned,
        totalDeductions: slip.totalDeductions,
        netSalary: slip.netSalary
      })
    })

    return {
      type,
      month,
      year,
      period,
      fileName,
      pageCount: pages.length,
      rows,
      matched,
      unmatched
    }
  } finally {
    await parser.destroy()
  }
}
