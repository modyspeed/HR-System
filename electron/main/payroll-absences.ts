/**
 * أيام الغياب: تُقرأ من **رأس ظرف الحافز** («غياب بدون اذن:- ٨» / «غياب باذن:- ٠٫٥»)
 * وتُخزَّن على الظرف نفسه في `PayrollEntry.absenceWithPermissionDays` و
 * `absenceWithoutPermissionDays` — وهي **أيام** لا مبالغ.
 *
 * لماذا هذا الملف منفصل عن `payroll-items.ts`؟
 * لأن أيام الغياب بيانات مستقلة عن المفردات: قد تكون المفردات مستخرجة بالكامل
 * وبقيت الأيام فارغة (كشف قديم أُضيف قبل ميزة الغيابات)، أو العكس. então نتتبّع
 * حالة الفحص لكل كشف على حدة عبر علامة `PayrollBatch.absencesScanned`، ونعيد
 * فحص ما لم يُفحص عند الإقلاع — فلا يبقى تقرير الغيابات فارغًا دون سبب معروف.
 *
 * في ظرف المرتب «غياب بدون اذن» **مبلغ** ضمن بنود الجدول لا عدد أيام، ولذلك
 * لا يُقرأ من إلا من فوق رأس جدول البنود (انظر `readAbsenceDays`).
 */
import type { PrismaClient } from '@prisma/client'
import fs from 'fs'
import { extractPayrollItems, type SlipAbsenceDays } from './payroll-items'
import { resolvePayrollStoredPath } from './payroll-files'

/** الكشوف التي يجري فحصها الآن — يمنع فحصًا مزدوجًا لنفس الكشف. */
const scanning = new Set<string>()

export interface AbsenceScanResult {
  /** الكشف الذي فُحص. */
  batchId: string
  /** عدد الأظرف التي كُتبت لها أيام غياب. */
  absences: number
  /** هل الملف موجود في الأرشيف؟ */
  fileMissing: boolean
  /** هل تخطّى الفحص لأن الفحص نفسه جارٍ في مسار آخر؟ */
  skipped: boolean
}

/**
 * يكتب أيام الغياب على أظرف كشف واحد.
 *
 * الصفحات التي فشلت قراءتها تُترك كما هي (لا تمحو بيانات سليمة)، أما الصفحات
 * التي قُرئت بلا حقول غياب فتُصفَّر — حتى لا تبقى أيام قديمة بعد إعادة الفحص.
 */
export async function applyAbsenceDays(
  prisma: PrismaClient,
  entries: { id: string; page: number }[],
  absencesByPage: Map<number, SlipAbsenceDays>
): Promise<number> {
  const updates: { id: string; withPermission: number | null; withoutPermission: number | null }[] =
    []

  for (const entry of entries) {
    const absence = absencesByPage.get(entry.page)
    if (!absence) continue
    updates.push({
      id: entry.id,
      withPermission: absence.withPermission,
      withoutPermission: absence.withoutPermission
    })
  }

  if (updates.length > 0) {
    // كل تحديث يكتب الحقلين معًا؛ القيمة الفارغة (null) تعني أن الحقل غير
    // موجود في هذا الظرف — فهي تُصفَّر حتى لا تبقى أيام قديمة بعد إعادة الفحص.
    await prisma.$transaction(
      updates.map((update) =>
        prisma.payrollEntry.update({
          where: { id: update.id },
          data: {
            absenceWithPermissionDays: update.withPermission,
            absenceWithoutPermissionDays: update.withoutPermission
          }
        })
      )
    )
  }

  return updates.filter((u) => u.withPermission !== null || u.withoutPermission !== null).length
}

/**
 * يفحص كشفًا واحدًا لأيام الغياب ويكتبها على أظرفه.
 *
 * يُستدعى عند استيراد كشف جديد (من مسار المفردات)، ومن الإقلاع (ردّ الفحص)،
 * ومن زر «استخراج أيام الغياب» في شاشة المراجعة.
 */
export async function scanBatchAbsences(
  prisma: PrismaClient,
  batchId: string
): Promise<AbsenceScanResult> {
  const batch = await prisma.payrollBatch.findUnique({
    where: { id: batchId },
    include: { entries: { select: { id: true, page: true } } }
  })
  if (!batch) {
    return { batchId, absences: 0, fileMissing: true, skipped: false }
  }

  // فحص مزدوج لنفس الكشف (فحصُ الإقلاع مع استخراج يدوي مثلًا): نتخطّاه
  // فالمسار الآخر يكتب الأرقام نفسها.
  if (scanning.has(batch.id)) {
    return { batchId: batch.id, absences: 0, fileMissing: false, skipped: true }
  }

  scanning.add(batch.id)
  try {
    const filePath = resolvePayrollStoredPath(batch.storedName)
    if (!fs.existsSync(filePath)) {
      // الملف مفقود — نحتفل حتى لا نعيد المحاولة كل إقلاع.
      await prisma.payrollBatch.update({
        where: { id: batch.id },
        data: { absencesScanned: true }
      })
      return { batchId: batch.id, absences: 0, fileMissing: true, skipped: false }
    }

    const { absencesByPage } = await extractPayrollItems(fs.readFileSync(filePath))
    const absences = await applyAbsenceDays(prisma, batch.entries, absencesByPage)
    await prisma.payrollBatch.update({
      where: { id: batch.id },
      data: { absencesScanned: true }
    })

    return { batchId: batch.id, absences, fileMissing: false, skipped: false }
  } finally {
    scanning.delete(batch.id)
  }
}

/**
 * ردّ فحص الغيابات: يفحص كل كشف لم يُفحص بعد (بالترتيب الزمني) ويكتب أيام
 * غيابه على أظرفه.
 *
 * يشمل الكشفَ الذي استُورد قبل ميزة الغيابات (فأيامه فارغة رغم توفّرها في
 * الملف) والكشفَ الذي استُعيد من نسخة احتياطية قديمة — فيتوفّر التقرير دائمًا.
 */
export async function backfillPayrollAbsences(
  prisma: PrismaClient,
  logger: (message: string) => void = () => undefined
): Promise<{ scanned: number; absences: number; missing: number }> {
  const pending = await prisma.payrollBatch.findMany({
    where: { absencesScanned: false },
    orderBy: [{ year: 'asc' }, { month: 'asc' }]
  })
  if (pending.length === 0) return { scanned: 0, absences: 0, missing: 0 }

  logger(`فحص أيام الغياب: ${pending.length} كشف…`)

  let absences = 0
  let missing = 0
  for (const batch of pending) {
    try {
      const result = await scanBatchAbsences(prisma, batch.id)
      absences += result.absences
      if (result.fileMissing) missing += 1
      logger(
        `  ✓ ${batch.period} ${batch.originalName} — ${result.absences} ظرف بأيام غياب` +
          (result.fileMissing ? ' (الملف مفقود)' : '')
      )
    } catch (error) {
      // فشل فحص كشف واحد لا يوقف الباقي؛ يُبقى غير مفحوص ليُعاد في الإقلاع التالي.
      logger(`  ! ${batch.originalName}: ${(error as Error).message}`)
    }
  }

  return { scanned: pending.length, absences, missing }
}
