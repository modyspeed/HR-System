#!/usr/bin/env node
/**
 * ربط ملفات العمل الخارجية بالموظفين: يقرأ مجلدًا خارجيًا فيه ملفات بأسماء
 * أرقام الموظفين (مثل `2689.pdf`) وينسخ كل ملف إلى مجلد ملفات التطبيق بنفس
 * قاعدة التسمية المستخدمة داخل الواجهة `<code>_<name>.<ext>`، ثم يحدّث سجل
 * الموظف — تمامًا كما لو رُفع الملف من نافذة «ملف العمل».
 *
 *   node scripts/link-employee-files.mjs [sourceFolder]             # معاينة (لا يكتب)
 *   node scripts/link-employee-files.mjs --apply [sourceFolder]     # نسخ وربط فعلي
 *   node scripts/link-employee-files.mjs --apply --overwrite [dir]  # يستبدل الروابط القائمة
 *
 * التطابق: اسم الملف (بدون الامتداد) → كود الموظف، مع تحويل الأرقام العربية
 * إلى ASCII. تُفرض نفس قواعد التطبيق: الامتدادات المسموحة، الحد الأقصى للحجم، وفحص
 * التوقيع (Magic bytes). المعاينة افتراضية، ويُؤخذ نسخة `.bak` من القاعدة قبل
 * أول كتابة. الملفات المربوطة مسبقًا تُتخطّى إلا مع `--overwrite`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

const DEFAULT_SOURCE = path.join(
  os.homedir(),
  'Desktop',
  'work',
  'HR',
  'ملفات العاملين',
  'Documents'
)
const DB_PATH =
  process.env.HR_DB_PATH ??
  path.join(process.env.APPDATA ?? os.homedir(), 'hr-system', 'hr-system.db')

/** نفس قواعد `electron/main/employee-files.ts` و`file-guard.ts`. */
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls', '.xlsm', '.csv'])
/** يجب مطابقة `MAX_UPLOAD_SIZE` في `shared/upload-limits.ts`. */
const MAX_FILE_SIZE = 200 * 1024 * 1024

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const overwrite = args.includes('--overwrite')
const explicitSource = args.find((arg) => !arg.startsWith('--'))
const sourceDir = explicitSource ? path.resolve(explicitSource) : DEFAULT_SOURCE

/* ------------------------------ تسمية ومسارات ------------------------------ */

/** المستندات: نحترم تجاوز OneDrive عبر HR_DOCS_DIR وإلا المسار الافتراضي. */
function resolveDocsDir() {
  if (process.env.HR_DOCS_DIR) return process.env.HR_DOCS_DIR
  const home = os.homedir()
  const candidates = [
    path.join(home, 'Documents'),
    path.join(home, 'OneDrive', 'Documents'),
    path.join(home, 'OneDrive', 'المستندات')
  ]
  return candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0]
}

function sanitizeSegment(value) {
  return String(value ?? '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
}

function buildStoredName(code, name, ext) {
  const codePart = sanitizeSegment(code) || 'employee'
  const namePart = sanitizeSegment(name) || 'employee'
  return `${codePart}_${namePart}`.slice(0, 150) + ext
}

/* ------------------------------- تطبيع ومطابقة ----------------------------- */

/** الأرقام العربية/الفارسية → ASCII، ثم نُبقي الحروف والأرقام فقط للمقارنة. */
function codeKey(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^0-9a-zA-Z]/g, '')
    .toLowerCase()
}

/* ------------------------------ فحص توقيع الملف ---------------------------- */

function hasAsciiPrefix(data, text) {
  return data.length >= text.length && data.subarray(0, text.length).toString('ascii') === text
}
function hasHexPrefix(data, hex) {
  return data.length >= hex.length / 2 && data.subarray(0, hex.length / 2).toString('hex') === hex
}
function isPlainText(data) {
  for (const byte of data.subarray(0, 1024)) if (byte === 0) return false
  return true
}
function signatureOk(ext, data) {
  switch (ext) {
    case '.pdf':
      return hasAsciiPrefix(data, '%PDF-')
    case '.xlsx':
    case '.xlsm':
      return hasHexPrefix(data, '504b0304')
    case '.xls':
      return hasHexPrefix(data, 'd0cf11e0a1b11ae1')
    case '.csv':
      return isPlainText(data)
    default:
      return false
  }
}

/* --------------------------------- التشغيل -------------------------------- */

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function main() {
  if (!fs.existsSync(sourceDir)) throw new Error(`مجلد المصدر غير موجود: ${sourceDir}`)
  if (!fs.existsSync(DB_PATH)) throw new Error(`قاعدة البيانات غير موجودة: ${DB_PATH}`)

  const docsDir = resolveDocsDir()
  const filesDir = path.join(docsDir, 'HR-System', 'EmployeeFiles')

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
    log: ['error']
  })

  try {
    const employees = await prisma.employee.findMany({
      select: { id: true, code: true, name: true, fileStoredName: true }
    })

    const byCode = new Map()
    const ambiguous = new Set()
    for (const employee of employees) {
      const key = codeKey(employee.code)
      if (!key) continue
      if (byCode.has(key)) ambiguous.add(key)
      else byCode.set(key, employee)
    }

    console.log(`المصدر:  ${sourceDir}`)
    console.log(`الهدف:   ${filesDir}`)
    console.log(`القاعدة: ${DB_PATH}`)
    console.log(`الموظفون في القاعدة: ${employees.length}`)

    const entries = fs
      .readdirSync(sourceDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())

    const plan = []
    const skipped = {
      notCodeNamed: [],
      unknownCode: [],
      duplicateFile: [],
      ambiguousEmployee: [],
      badExtension: [],
      oversized: [],
      badSignature: [],
      alreadyAttached: []
    }

    const groups = new Map()
    for (const entry of entries) {
      const ext = path.extname(entry.name).toLowerCase()
      const base = path.basename(entry.name, path.extname(entry.name))
      if (!/^\d+$/.test(base.trim())) {
        skipped.notCodeNamed.push({ file: entry.name })
        continue
      }
      const key = codeKey(base)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({ entry, ext, full: path.join(sourceDir, entry.name) })
    }

    for (const [key, list] of groups) {
      if (list.length > 1) {
        skipped.duplicateFile.push({ code: key, files: list.map((f) => f.entry.name) })
        continue
      }
      const file = list[0]
      if (ambiguous.has(key)) {
        skipped.ambiguousEmployee.push({ code: key, file: file.entry.name })
        continue
      }
      const employee = byCode.get(key)
      if (!employee) {
        skipped.unknownCode.push({ code: key, file: file.entry.name })
        continue
      }
      if (!ALLOWED_EXTENSIONS.has(file.ext)) {
        skipped.badExtension.push({ code: key, file: file.entry.name })
        continue
      }
      const size = fs.statSync(file.full).size
      if (size === 0 || size > MAX_FILE_SIZE) {
        skipped.oversized.push({ code: key, file: file.entry.name, size })
        continue
      }
      const data = fs.readFileSync(file.full)
      if (!signatureOk(file.ext, data)) {
        skipped.badSignature.push({ code: key, file: file.entry.name })
        continue
      }
      if (employee.fileStoredName && !overwrite) {
        skipped.alreadyAttached.push({ code: key, file: file.entry.name, stored: employee.fileStoredName })
        continue
      }
      plan.push({
        employee,
        source: file.full,
        original: file.entry.name,
        ext: file.ext,
        size,
        data,
        storedName: buildStoredName(employee.code, employee.name, file.ext)
      })
    }

    /* --------------------------------- التقرير -------------------------------- */

    console.log(`\nملفات المصدر: ${entries.length}`)
    console.log(`قابلة للربط: ${plan.length}`)

    if (plan.length) {
      console.log('\n—— الملفات التي ستُربط ——')
      for (const item of plan) {
        console.log(
          `  [${item.employee.code}] ${item.employee.name}  ←  ${item.original}  (${formatSize(item.size)})`
        )
        console.log(`        يُحفظ كـ: ${item.storedName}`)
      }
    }

    const report = [
      ['أسماء ليست رقم موظف', skipped.notCodeNamed],
      ['رقم غير موجود بين الموظفين', skipped.unknownCode],
      ['أكثر من ملف لنفس الرقم', skipped.duplicateFile],
      ['رقم مكرر لعدة موظفين', skipped.ambiguousEmployee],
      ['امتداد غير مسموح', skipped.badExtension],
      ['الحجم صفر أو يتجاوز 25MB', skipped.oversized],
      ['التوقيع لا يطابق الامتداد', skipped.badSignature],
      ['مربوط مسبقًا (تخطٍّ)', skipped.alreadyAttached]
    ]
    const MAX_ROWS = 30
    for (const [label, list] of report) {
      console.log(`\n—— ${label}: ${list.length} ——`)
      for (const row of list.slice(0, MAX_ROWS)) {
        const prefix = row.code ? `[${row.code}] ` : ''
        if (row.files) console.log(`  ${prefix}${row.files.join(' | ')}`)
        else if (row.size !== undefined) console.log(`  ${prefix}${row.file} (${formatSize(row.size)})`)
        else if (row.stored) console.log(`  ${prefix}${row.file} (المربوط: ${row.stored})`)
        else console.log(`  ${prefix}${row.file}`)
      }
      if (list.length > MAX_ROWS) console.log(`  … و${list.length - MAX_ROWS} أخرى`)
    }

    if (!apply) {
      console.log(
        plan.length
          ? '\nمعاينة فقط — أعد التشغيل مع --apply للنسخ والربط الفعلي.'
          : '\nلا يوجد ما يُربط.'
      )
      return
    }
    if (plan.length === 0) {
      console.log('\nلا يوجد ما يُربط.')
      return
    }

    /* --------------------------------- الكتابة ------------------------------- */

    const backupPath = `${DB_PATH}.bak-${Date.now()}`
    fs.copyFileSync(DB_PATH, backupPath)
    console.log(`\nنسخة احتياطية من القاعدة: ${backupPath}`)

    fs.mkdirSync(filesDir, { recursive: true })

    let linked = 0
    let failed = 0
    for (const item of plan) {
      const target = path.join(filesDir, item.storedName)
      try {
        fs.writeFileSync(target, item.data)
        if (item.employee.fileStoredName && item.employee.fileStoredName !== item.storedName) {
          fs.rmSync(path.join(filesDir, path.basename(item.employee.fileStoredName)), { force: true })
        }
        await prisma.employee.update({
          where: { id: item.employee.id },
          data: {
            fileStoredName: item.storedName,
            fileOriginalName: item.storedName,
            fileSize: item.size,
            fileLinkedAt: new Date()
          }
        })
        linked += 1
        console.log(`  ✓ [${item.employee.code}] ${item.storedName}`)
      } catch (error) {
        failed += 1
        console.error(`  ✗ [${item.employee.code}] ${item.original} — ${error.message ?? error}`)
      }
    }

    console.log(`\nتم الربط: ${linked}${failed ? ` | فشل: ${failed}` : ''}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`\nخطأ: ${error.message ?? error}`)
  process.exit(1)
})
