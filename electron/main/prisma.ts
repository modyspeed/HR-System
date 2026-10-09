import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { SNAPSHOT_SQL } from './db-snapshot'

let client: PrismaClient | null = null

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'hr-system.db')
}

export function getPrisma(): PrismaClient {
  if (client) return client
  const dbPath = getDbPath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  client = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
    log: app.isPackaged ? ['error'] : ['error', 'warn']
  })
  return client
}

/**
 * The packaged app has no `prisma migrate` binary available, so the schema is
 * captured as plain SQL at build time and applied here on first launch.
 * Idempotent: SQLite `CREATE TABLE IF NOT EXISTS` keeps repeat runs safe.
 *
 * Columns added to an already-shipped table need ALTERs (CREATE IF NOT EXISTS
 * cannot add them). Each statement is attempted every launch and fails
 * harmlessly when the column already exists — keep in sync with schema.prisma.
 */
const SCHEMA_UPGRADES = [
  `ALTER TABLE "Employee" ADD COLUMN "fileOriginalName" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN "fileStoredName" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN "fileSize" INTEGER`,
  `ALTER TABLE "Employee" ADD COLUMN "fileLinkedAt" DATETIME`,
  `ALTER TABLE "Employee" ADD COLUMN "contractType" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN "departmentId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN "status" TEXT DEFAULT 'active'`,
  `ALTER TABLE "Employee" ADD COLUMN "rehiredFromId" TEXT`
]

export async function applySnapshot(prisma: PrismaClient): Promise<void> {
  for (const statement of splitSql(SNAPSHOT_SQL)) {
    const trimmed = statement.trim()
    if (!trimmed) continue
    await prisma.$executeRawUnsafe(trimmed)
  }

  for (const upgrade of SCHEMA_UPGRADES) {
    try {
      await prisma.$executeRawUnsafe(upgrade)
    } catch {
      // duplicate column — already upgraded
    }
  }
}

function splitSql(sql: string): string[] {
  const statements: string[] = []
  let buffer: string[] = []

  for (const line of sql.split('\n')) {
    const stripped = line.trim()
    if (stripped.startsWith('--')) continue
    buffer.push(line)
    if (stripped.endsWith(';')) {
      const stmt = buffer.join('\n').trim()
      if (stmt) statements.push(stmt)
      buffer = []
    }
  }

  const tail = buffer.join('\n').trim()
  if (tail) statements.push(tail)
  return statements
}
