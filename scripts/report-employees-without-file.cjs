const { PrismaClient } = require('@prisma/client')
const path = require('path')
const os = require('os')

const DB_PATH =
  process.env.HR_DB_PATH ??
  path.join(process.env.APPDATA ?? os.homedir(), 'hr-system', 'hr-system.db')

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:' + DB_PATH } },
  log: ['error']
})

async function main() {
  const employees = await prisma.employee.findMany({
    where: { fileStoredName: null },
    select: { code: true, name: true, department: { select: { name: true } }, status: true },
    orderBy: { code: 'asc' }
  })

  console.log('تقرير الموظفين غير المرتبطين بملف')
  console.log('==================================')
  console.log('إجمالي الموظفين بدون ملف:', employees.length)
  console.log('')
  console.log('رقم الموظف | الاسم | القسم | الحالة')
  console.log('-----------|------|------|------')
  for (const e of employees) {
    console.log(
      e.code.padStart(11) + ' | ' +
      e.name + ' | ' +
      (e.department?.name ?? '—') + ' | ' +
      e.status
    )
  }
  console.log('')
  console.log('تم في: ' + new Date().toLocaleString('ar-EG'))
}

main().finally(() => prisma.$disconnect())
