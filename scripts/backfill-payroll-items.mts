/**
 * تعبئة مفردات الأظرف الموجودة مسبقًا: يستخرج بنود كل ظرف من ملف الكشف
 * المخزَّن ويخزّنها في جدول PayrollItem.
 *
 * التشغيل:  npx tsx scripts/backfill-payroll-items.mts [--dry]
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { PrismaClient } from '@prisma/client'
import { extractPayrollItems } from '../electron/main/payroll-items.ts'

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'hr-system', 'hr-system.db')
const FILES_DIR = path.join(os.homedir(), 'Documents', 'HR-System', 'PayrollFiles')
const dry = process.argv.includes('--dry')

const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB_PATH}` } } })

async function main() {
  const batches = await prisma.payrollBatch.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    include: { entries: { select: { id: true, page: true } } }
  })

  console.log(`batches: ${batches.length}`)

  for (const batch of batches) {
    const filePath = path.join(FILES_DIR, batch.storedName)
    if (!fs.existsSync(filePath)) {
      console.log(`  ! missing file: ${batch.originalName}`)
      continue
    }

    const t = Date.now()
    const { byPage } = await extractPayrollItems(fs.readFileSync(filePath))
    const byPageNumber = new Map(batch.entries.map((entry) => [entry.page, entry.id]))

    const rows: {
      entryId: string
      kind: string
      label: string
      labelKey: string
      value: number
      balance: number | null
      sortOrder: number
    }[] = []
    let items = 0
    let linked = 0
    for (const [page, pageItems] of byPage) {
      const entryId = byPageNumber.get(page)
      if (!entryId) continue
      linked += 1
      items += pageItems.length
      for (const item of pageItems) {
        rows.push({
          entryId,
          kind: item.kind,
          label: item.label,
          labelKey: item.labelKey,
          value: item.value,
          balance: item.balance,
          sortOrder: item.sortOrder
        })
      }
    }

    if (!dry) {
      const entryIds = batch.entries.map((entry) => entry.id)
      await prisma.$transaction(async (tx) => {
        await tx.payrollItem.deleteMany({ where: { entryId: { in: entryIds } } })
        if (rows.length > 0) await tx.payrollItem.createMany({ data: rows })
      })
    }

    console.log(
      `  ${batch.type}/${batch.period}: ${batch.entries.length} entries, ${linked} slips parsed, ${items} items (${Date.now() - t}ms)`
    )
  }

  if (!dry) {
    const total = await prisma.payrollItem.count()
    console.log(`total payroll items: ${total}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
