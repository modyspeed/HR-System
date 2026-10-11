/**
 * القسم الحالي = آخر قسم في كشوف المرتبات: عند استيراد كشف، يُحدَّث قسم
 * الموظف تلقائيًا ويُغلق أي تنقل مفتوح مع إنشاء تنقل جديد (سجل تاريخي).
 */
import type { Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import type { PayrollParseRow } from '../../shared/types'
import { parsePayrollPdf } from './payroll-parser'
import { resolvePayrollStoredPath } from './payroll-files'

export async function syncPayrollDepartments(
  tx: Prisma.TransactionClient,
  rows: (PayrollParseRow & { employeeId: string | null })[],
  fileName: string,
  year: number,
  month: number
): Promise<number> {
  const withDepartment = rows.filter((row) => row.employeeId && row.departmentId)
  if (withDepartment.length === 0) return 0

  const employeeIds = [...new Set(withDepartment.map((row) => row.employeeId!))]
  const employees = await tx.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, departmentId: true }
  })
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const periodStart = new Date(Date.UTC(year, month - 1, 1))
  const dayBefore = new Date(Date.UTC(year, month - 1, 0))

  let changed = 0
  for (const row of withDepartment) {
    const employee = employeeById.get(row.employeeId!)
    if (!employee || employee.departmentId === row.departmentId) continue

    const open = await tx.departmentTransfer.findFirst({
      where: { employeeId: employee.id, toDate: null },
      orderBy: { fromDate: 'desc' }
    })
    // تناقض ضمن الشهر نفسه (مرتب يقول قسمًا والحافز غيره) — نتجاهل المصدر الثاني
    // ولا نغلق تنقلاً فُتح في نفس الشهر لئلا ننتج نطاقًا معكوسًا.
    if (open && dayBefore < open.fromDate) continue

    if (open && dayBefore >= open.fromDate) {
      await tx.departmentTransfer.update({
        where: { id: open.id },
        data: { toDate: dayBefore }
      })
    }
    await tx.departmentTransfer.create({
      data: {
        employeeId: employee.id,
        fromDepartmentId: employee.departmentId,
        toDepartmentId: row.departmentId,
        fromDate: periodStart,
        toDate: null,
        note: `مستنتج من كشف ${fileName}`
      }
    })
    await tx.employee.update({
      where: { id: employee.id },
      data: { departmentId: row.departmentId }
    })
    changed += 1
  }
  return changed
}

/**
 * ردّ الفحص التاريخي: يعيد تحليل كل كشف مخزَّن لم يُفحص بعد (بالترتيب الزمني)،
 * يملأ قسم/جهة كل دفعة من الظرف، ثم يبني سجل التنقلات ويحدّث القسم الحالي —
 * يغطي الكشوف المرفوعة قبل إضافة الميزة (مثل 05→09/2026).
 */
export async function backfillPayrollDepartments(
  prisma: PrismaClient,
  logger: (message: string) => void = () => undefined
): Promise<{ scanned: number; transfers: number }> {
  const pending = await prisma.payrollBatch.findMany({
    where: { departmentsScanned: false },
    orderBy: [{ year: 'asc' }, { month: 'asc' }]
  })
  // قرار القسم المرجعي داخل الشهر من كشف المرتب (يُعالج قبل الحافز).
  const batches = [...pending].sort((a, b) => {
    const periodCompare = a.period.localeCompare(b.period)
    if (periodCompare !== 0) return periodCompare
    return a.type === 'salary' ? -1 : b.type === 'salary' ? 1 : 0
  })
  if (batches.length === 0) return { scanned: 0, transfers: 0 }

  logger(`ردّ فحص الأقسام: ${batches.length} كشف…`)
  const employees = await prisma.employee.findMany({
    select: { id: true, code: true, name: true }
  })
  const departments = await prisma.department.findMany({
    select: { id: true, name: true }
  })

  let transfers = 0
  for (const batch of batches) {
    const filePath = resolvePayrollStoredPath(batch.storedName)
    if (!fs.existsSync(filePath)) {
      // الملف مفقود — نحتفل حتى لا نعيد المحاولة كل إقلاع.
      await prisma.payrollBatch.update({
        where: { id: batch.id },
        data: { departmentsScanned: true }
      })
      continue
    }

    const parsed = await parsePayrollPdf({
      buffer: fs.readFileSync(filePath),
      fileName: batch.originalName,
      employees,
      departments
    })

    await prisma.$transaction(async (tx) => {
      for (const row of parsed.rows) {
        await tx.payrollEntry.updateMany({
          where: { batchId: batch.id, page: row.page },
          data: { departmentId: row.departmentId, workshop: row.workshop }
        })
      }
      const matched = parsed.rows.filter((row) => row.employeeId && row.departmentId)
      transfers += await syncPayrollDepartments(
        tx,
        matched,
        batch.originalName,
        batch.year,
        batch.month
      )
      await tx.payrollBatch.update({
        where: { id: batch.id },
        data: { departmentsScanned: true }
      })
    })
    logger(`  ✓ ${batch.period} ${batch.originalName} (${batch.pageCount} صفحة)`)
  }

  return { scanned: batches.length, transfers }
}
