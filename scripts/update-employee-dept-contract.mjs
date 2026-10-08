#!/usr/bin/env node
/**
 * One-shot backfill of Employee.departmentId + Employee.contractType from an
 * Excel export (رقم الموظف / اسم الموظف / رقم القسم / اسم القسم / نوع التعاقد).
 *
 *   node scripts/update-employee-dept-contract.mjs [file.xlsx]   # dry run
 *   node scripts/update-employee-dept-contract.mjs --apply [file.xlsx]
 *
 * Dry run is the default so nothing is written until --apply is passed.
 * A .bak copy of the SQLite file is taken before the first write.
 * Matching is by employee code; departments are matched by code, then by
 * normalized name, and created when missing. Existing (non-empty) values are
 * never overwritten.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const { PrismaClient } = require('@prisma/client')

const DEFAULT_FILE = path.join(os.homedir(), 'Desktop', 'بيانات الموظفين.xlsx')
const DB_PATH =
  process.env.HR_DB_PATH ??
  path.join(process.env.APPDATA ?? os.homedir(), 'hr-system', 'hr-system.db')

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const explicitFile = args.find((arg) => !arg.startsWith('--'))
const sourceFile = explicitFile ? path.resolve(explicitFile) : DEFAULT_FILE

/* ------------------------------- normalization ---------------------------- */

/** Arabic-Indic and Persian digits → ASCII, keeps codes comparable. */
function digitsOnly(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim()
}

function codeKey(value) {
  return digitsOnly(value).replace(/[^0-9a-zA-Z]/g, '')
}

/** Loose Arabic key for name fallback matching (diacritics, alef/ya variants). */
function nameKey(value) {
  return digitsOnly(value)
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

function text(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/* --------------------------------- Excel ---------------------------------- */

const HEADER_ALIASES = {
  code: ['رقم الموظف', 'كود الموظف', 'كود', 'code'],
  name: ['اسم الموظف', 'اسم', 'name'],
  departmentCode: ['رقم القسم', 'كود القسم', 'كود القسم', 'department code'],
  departmentName: ['اسم القسم', 'القسم', 'department'],
  contractType: ['نوع التعاقد', 'نوع العقد', 'contract type', 'contract']
}

function detectHeader(rows) {
  const aliasMap = new Map()
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) aliasMap.set(nameKey(alias), key)
  }

  const limit = Math.min(rows.length, 8)
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const found = {}
    rows[rowIndex].forEach((cell, columnIndex) => {
      const key = aliasMap.get(nameKey(cell))
      if (key && found[key] === undefined) found[key] = columnIndex
    })
    if (found.code !== undefined) return { rowIndex, columns: found }
  }
  throw new Error('لم يتم العثور على صف العناوين داخل الملف')
}

function readSourceRows(file) {
  const workbook = XLSX.read(fs.readFileSync(file), { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error(`الورقة الأولى غير موجودة في ${file}`)

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  })
  const { rowIndex, columns } = detectHeader(rows)

  const cell = (row, key) => (columns[key] === undefined ? '' : row[columns[key]])
  const out = []
  for (let i = rowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]
    const code = codeKey(cell(row, 'code'))
    if (!code) continue
    out.push({
      code,
      name: text(cell(row, 'name')),
      departmentCode: codeKey(cell(row, 'departmentCode')),
      departmentName: text(cell(row, 'departmentName')),
      contractType: text(cell(row, 'contractType'))
    })
  }
  return out
}

/* ---------------------------------- main ---------------------------------- */

async function main() {
  if (!fs.existsSync(sourceFile)) throw new Error(`الملف غير موجود: ${sourceFile}`)
  if (!fs.existsSync(DB_PATH)) throw new Error(`قاعدة البيانات غير موجودة: ${DB_PATH}`)

  const sourceRows = readSourceRows(sourceFile)
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
    log: ['error']
  })

  try {
    const employees = await prisma.employee.findMany({
      select: { id: true, code: true, name: true, departmentId: true, contractType: true }
    })
    const departments = await prisma.department.findMany({
      select: { id: true, code: true, name: true }
    })

    const employeeByCode = new Map(employees.map((e) => [codeKey(e.code), e]))
    const deptByCode = new Map(departments.map((d) => [codeKey(d.code), d]))
    const deptByName = new Map(departments.map((d) => [nameKey(d.name), d]))

    const plan = []
    const notInDb = []
    const nameMismatches = []
    const noDepartmentInSource = []
    const sourceCodes = new Set(sourceRows.map((row) => row.code))

    for (const row of sourceRows) {
      const employee = employeeByCode.get(row.code)
      if (!employee) {
        notInDb.push(`${row.code} ${row.name}`.trim())
        continue
      }
      if (
        employee.name &&
        row.name &&
        nameKey(employee.name) !== nameKey(row.name)
      ) {
        nameMismatches.push(`${row.code}: DB="${employee.name}" ملف="${row.name}"`)
      }

      const needsDepartment = !employee.departmentId
      const needsContract = !text(employee.contractType)
      if (!needsDepartment && !needsContract) continue
      if (needsDepartment && !row.departmentCode && !row.departmentName) {
        noDepartmentInSource.push(`${row.code} ${employee.name}`.trim())
      }

      plan.push({ employee, row, needsDepartment, needsContract })
    }

    console.log(`الملف:        ${sourceFile}`)
    console.log(`قاعدة البيانات: ${DB_PATH}`)
    console.log(`صفوف الملف:    ${sourceRows.length}`)
    console.log(`موظفون بالقاعدة: ${employees.length}`)
    console.log(`أقسام بالقاعدة:  ${departments.length}`)
    const withDepartment = employees.filter((e) => e.departmentId).length
    const withContract = employees.filter((e) => text(e.contractType)).length
    console.log(`معبّأ بالفعل — قسم: ${withDepartment} / نوع تعاقد: ${withContract}`)
    console.log('')
    console.log(`مطابقة بالكود:   ${sourceRows.length - notInDb.length}`)
    console.log(`غير موجود بالقاعدة: ${notInDb.length}`)
    console.log(`موظفون بدون صف بالملف: ${employees.filter((e) => !sourceCodes.has(codeKey(e.code))).length}`)
    console.log(`تخطط للتحديث:    ${plan.length}`)
    console.log(`  قسم فقط:       ${plan.filter((p) => p.needsDepartment).length}`)
    console.log(`  نوع تعاقد فقط: ${plan.filter((p) => p.needsContract).length}`)
    console.log(`  كلاهما معاً:      ${plan.filter((p) => p.needsDepartment && p.needsContract).length}`)
    console.log(`تنبيه تغيّر الاسم: ${nameMismatches.length}`)
    console.log(`قسم غير متوفر بالملف: ${noDepartmentInSource.length}`)

    if (notInDb.length) {
      console.log('\nغير موجودين بالقاعدة:')
      notInDb.slice(0, 20).forEach((line) => console.log(`  ${line}`))
      if (notInDb.length > 20) console.log(`  … و${notInDb.length - 20} آخر`)
    }
    if (nameMismatches.length) {
      console.log('\nتطابق كود مع اسم مختلف:')
      nameMismatches.slice(0, 20).forEach((line) => console.log(`  ${line}`))
      if (nameMismatches.length > 20) console.log(`  … و${nameMismatches.length - 20} آخر`)
    }

    if (!apply) {
      console.log('\nمعاينة فقط — لن يتم كتابة أي بيانات. استخدم --apply للتنفيذ.')
      return
    }
    if (plan.length === 0) {
      console.log('\nلا يوجد ما يحتاج لتحديث.')
      return
    }

    const backup = `${DB_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`
    fs.copyFileSync(DB_PATH, backup)
    console.log(`\nنسخة احتياطية: ${backup}`)

    let departmentCreated = 0
    let departmentUpdated = 0
    let contractUpdated = 0
    const createdDeptNames = new Set()

    await prisma.$transaction(
      async (tx) => {
        for (const { employee, row, needsDepartment, needsContract } of plan) {
          const data = {}

          if (needsDepartment && (row.departmentCode || row.departmentName)) {
            let department =
              (row.departmentCode && deptByCode.get(row.departmentCode)) ||
              (row.departmentName && deptByName.get(nameKey(row.departmentName)))

            if (!department) {
              const code = row.departmentCode || `TMP-${Date.now()}`
              department = await tx.department.create({
                data: { code, name: row.departmentName || code }
              })
              deptByCode.set(codeKey(department.code), department)
              deptByName.set(nameKey(department.name), department)
              createdDeptNames.add(`${department.code} ${department.name}`)
              departmentCreated += 1
            }
            data.departmentId = department.id
            departmentUpdated += 1
          }

          if (needsContract && row.contractType) {
            data.contractType = row.contractType
            contractUpdated += 1
          }

          if (Object.keys(data).length > 0) {
            await tx.employee.update({ where: { id: employee.id }, data })
          }
        }
      },
      { timeout: 120_000 }
    )

    console.log('\nتم التحديث:')
    console.log(`  قسم الموظف:        ${departmentUpdated}`)
    console.log(`  نوع التعاقد:       ${contractUpdated}`)
    console.log(`  أقسام جديدة:      ${departmentCreated}`)
    if (createdDeptNames.size) {
      console.log('  الأقسام المُنشأة:')
      ;[...createdDeptNames].forEach((line) => console.log(`    ${line}`))
    }

    const after = await prisma.employee.count({ where: { departmentId: null } })
    const afterContract = await prisma.employee.count({ where: { contractType: null } })
    console.log(`\nالمتبقّي بدون قسم: ${after}`)
    console.log(`المتبقّي بدون نوع تعاقد: ${afterContract}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`\nخطأ: ${error.message ?? error}`)
  process.exit(1)
})
