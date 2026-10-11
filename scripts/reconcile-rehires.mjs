#!/usr/bin/env node
/**
 * تسوية ملفات إعادة التعيين: يكتشف الموظفين المضافين كملفات جديدة ويربط كل
 * واحد بملفه الأصلي السابق (معاش/استقالة…)، ويكمل الحقول الفارغة منه فقط.
 *
 *   node scripts/reconcile-rehires.mjs            # معاينة (لا يكتب)
 *   node scripts/reconcile-rehires.mjs --apply    # ربط وتكميل فعلي
 *
 * التطابق بدرجات ثقة: الرقم القومي/التأميني المطابق (+10)، الاسم المطابق
 * تمامًا بعد التطبيع (+8)، تشابه أسرة الاسم (+4). يُختار أفضل مرشح واحد فقط
 * لكل ملف جديد، ويتجاهل الحالات الغامضة — راجع التقرير واربط الباقي يدويًا
 * من زر «ربط بملف سابق» في الملف الكامل.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

const DB_PATH =
  process.env.HR_DB_PATH ??
  path.join(process.env.APPDATA ?? os.homedir(), 'hr-system', 'hr-system.db')
const apply = process.argv.includes('--apply')

function nameKey(raw) {
  return (raw || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/[^0-9a-zA-Zا-ي]/g, '')
    .toLowerCase()
}

function prefixKey(raw) {
  const parts = (raw || '').split(/\s+/).filter(Boolean)
  return parts.length >= 4 ? parts.slice(0, 3).join(' ') : null
}

function emptyFields(fresh, source) {
  const fields = []
  if (!fresh.insuranceNo && source.insuranceNo) fields.push('insuranceNo')
  if (!fresh.nationalId && source.nationalId) fields.push('nationalId')
  if (!fresh.birthDate && source.birthDate) fields.push('birthDate')
  if (!fresh.qualification && source.qualification) fields.push('qualification')
  if (!fresh.qualificationYear && source.qualificationYear) fields.push('qualificationYear')
  if (!fresh.departmentId && source.departmentId) fields.push('departmentId')
  return fields
}

async function main() {
  if (!fs.existsSync(DB_PATH)) throw new Error(`قاعدة البيانات غير موجودة: ${DB_PATH}`)
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
    log: ['error']
  })
  try {
    const rows = await prisma.employee.findMany({ orderBy: { code: 'asc' } })
    const news = rows.filter((r) => r.status === 'active' && !r.rehiredFromId)
    const olds = rows.filter((r) => r.status !== 'active')

    console.log(`القاعدة: ${DB_PATH}`)
    console.log(`ملفات جديدة غير مربوطة: ${news.length} | ملفات سابقة: ${olds.length}`)

    const newKey = new Map(news.map((r) => [r.id, r]))
    const oldKey = new Map(olds.map((r) => [r.id, r]))
    const score = (n, o) => {
      let s = 0
      if (n.nationalId && n.nationalId === o.nationalId) s += 10
      if (n.insuranceNo && n.insuranceNo === o.insuranceNo) s += 10
      if (nameKey(n.name) === nameKey(o.name)) s += 8
      if (prefixKey(n.name) && prefixKey(n.name) === prefixKey(o.name)) s += 4
      return s
    }

    const used = new Set()
    const plan = []
    for (const fresh of news) {
      let best = null
      let bestScore = 0
      let ties = false
      for (const source of olds) {
        const s = score(fresh, source)
        if (s > bestScore) {
          best = source
          bestScore = s
          ties = false
        } else if (s === bestScore && s > 0) {
          ties = true
        }
      }
      if (!best || bestScore < 8 || ties || used.has(best.id)) continue
      used.add(best.id)
      plan.push({
        fresh,
        source: best,
        score: bestScore,
        fill: emptyFields(fresh, best)
      })
    }

    console.log(`\nأزواج مقترحة: ${plan.length}`)
    for (const item of plan) {
      const f = item.fresh
      const o = item.source
      console.log(
        `  [${f.code}] ${f.name}  →  [${o.code}] ${o.name} (${o.status})  درجة ${item.score}${
          item.fill.length ? ` | يُكمل: ${item.fill.join(', ')}` : ' | لا فراغات'
        }`
      )
    }

    const العوامي = rows.filter(
      (r) => r.name.includes('العوام') && (r.status !== 'active' || r.rehiredFromId)
    )
    console.log(`\nملفات مثال «العوامي»: ${العوامي.length}`)
    العوامي.forEach((r) =>
      console.log(`  [${r.code}] ${r.status} | ${r.name}${r.rehiredFromId ? ' | مرتبط' : ' | غير مرتبط'}`)
    )

    if (!apply || plan.length === 0) {
      if (plan.length) console.log('\nمعاينة فقط — استخدم --apply للربط الفعلي.')
      return
    }

    await prisma.$transaction(
      async (tx) => {
        for (const item of plan) {
          await tx.employee.update({
            where: { id: item.fresh.id },
            data: {
              rehiredFromId: item.source.id,
              insuranceNo: item.fresh.insuranceNo ?? item.source.insuranceNo,
              nationalId: item.fresh.nationalId ?? item.source.nationalId,
              birthDate: item.fresh.birthDate ?? item.source.birthDate,
              qualification: item.fresh.qualification ?? item.source.qualification,
              qualificationYear: item.fresh.qualificationYear ?? item.source.qualificationYear,
              departmentId: item.fresh.departmentId ?? item.source.departmentId
            }
          })
        }
      },
      { timeout: 120_000 }
    )
    console.log(`\nتم ربط ${plan.length} ملف وإكمال بياناتها.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`\nخطأ: ${error.message ?? error}`)
  process.exit(1)
})
