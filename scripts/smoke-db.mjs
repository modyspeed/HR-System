/**
 * Headless smoke test for the main-process data layer: applies the DDL
 * snapshot, seeds roles + the admin account, and exercises a login.
 *
 *   node scripts/smoke-db.mjs
 */
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { mkdtempSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const dir = mkdtempSync(resolve(tmpdir(), 'hr-smoke-'))
const dbPath = resolve(dir, 'smoke.db')
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })

const sqlText = JSON.parse(
  readFileSync(resolve(root, 'electron/main/db-snapshot.ts'), 'utf-8').match(
    /export const SNAPSHOT_SQL = (".*")/s
  )[1]
)
const sql = sqlText
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';\n')
  .map((statement) => statement.trim())
  .filter(Boolean)

for (const statement of sql) {
  await prisma.$executeRawUnsafe(statement)
}
console.log(`✔ applied ${sql.length} DDL statements`)

const ALL = [
  'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_status',
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  'settings.view', 'settings.edit'
]

await prisma.role.upsert({
  where: { key: 'super_admin' },
  create: {
    key: 'super_admin',
    nameAr: 'المدير العام',
    nameEn: 'Super Admin',
    isSystem: true,
    permissions: { create: ALL.map((permissionKey) => ({ permissionKey })) }
  },
  update: {}
})
await prisma.role.upsert({
  where: { key: 'employee' },
  create: {
    key: 'employee',
    nameAr: 'موظف',
    nameEn: 'Employee',
    isSystem: true,
    permissions: { create: [{ permissionKey: 'settings.view' }] }
  },
  update: {}
})
console.log('✔ seeded roles')

const role = await prisma.role.findUniqueOrThrow({ where: { key: 'super_admin' } })
await prisma.user.create({
  data: {
    username: 'admin',
    fullName: 'مدير النظام',
    email: 'admin@hr-system.local',
    passwordHash: await bcrypt.hash('admin123', 10),
    roleId: role.id
  }
})
console.log('✔ seeded admin user')

const found = await prisma.user.findUnique({
  where: { username: 'admin' },
  include: { role: { include: { permissions: true } } }
})
const ok = await bcrypt.compare('admin123', found.passwordHash)
console.log(`✔ login check: ${ok ? 'password matches' : 'MISMATCH'}`)

const count = await prisma.user.count()
const rolesCount = await prisma.role.count()
const permsCount = await prisma.rolePermission.count()
console.log(`✔ totals: ${count} users, ${rolesCount} roles, ${permsCount} permission rows`)

await prisma.$disconnect()
console.log('smoke test passed')
