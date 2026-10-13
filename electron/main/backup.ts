/**
 * النسخ الاحتياطي الشامل: أرشيف ZIP مؤرخ (backup-2026-10-11_10-52-30.zip)
 * يضم لقطة متسقة لقاعدة البيانات (VACUUM INTO) + كل ملفات المستندات
 * (موظفون/إجازات/مرتبات/تدرجات/قرارات نقل/حوافز) داخل
 * `<Documents>/HR-System/Backups`.
 */
import { app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { PrismaClient } from '@prisma/client'
import { getDbPath } from './prisma'
import { ApiError } from '../../shared/types'
import { FILE_FOLDERS, getAppDocsDir, getDocumentFolderDir } from './document-folders'

export function getBackupsDir(): string {
  return path.join(getAppDocsDir(), 'Backups')
}

function ensureBackupsDir(): string {
  const dir = getBackupsDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function timestampName(): string {
  const now = new Date()
  return `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.zip`
}

export interface BackupInfo {
  fileName: string
  size: number
  createdAt: string
}

export function listBackups(): BackupInfo[] {
  const dir = getBackupsDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.zip'))
    .map((fileName) => {
      const stat = fs.statSync(path.join(dir, fileName))
      return { fileName, size: stat.size, createdAt: stat.mtime.toISOString() }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function resolveBackupPath(fileName: string): string {
  const name = path.basename(fileName)
  if (!name.endsWith('.zip') || name !== fileName) {
    throw new ApiError('VALIDATION', 'Invalid backup file name')
  }
  const filePath = path.join(getBackupsDir(), name)
  if (!fs.existsSync(filePath)) throw new ApiError('NOT_FOUND', 'Backup not found')
  return filePath
}

/** لقطة متسقة للقاعدة عبر VACUUM INTO — آمنة حتى أثناء عمل التطبيق. */
async function captureDatabaseSnapshot(prisma: PrismaClient): Promise<Buffer> {
  const tempDb = path.join(app.getPath('temp'), `hr-backup-${Date.now()}.db`)
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${tempDb.replace(/'/g, "''")}'`)
    return fs.readFileSync(tempDb)
  } finally {
    fs.rmSync(tempDb, { force: true })
  }
}

export async function createBackup(prisma: PrismaClient): Promise<BackupInfo> {
  const dir = ensureBackupsDir()
  const zip = new AdmZip()
  zip.addFile('hr-system.db', await captureDatabaseSnapshot(prisma))

  for (const folder of FILE_FOLDERS) {
    const folderPath = getDocumentFolderDir(folder)
    if (!fs.existsSync(folderPath)) continue
    const files = fs.readdirSync(folderPath).filter((name) => name !== '.keep')
    if (files.length > 0) zip.addLocalFolder(folderPath, `files/${folder}`)
  }

  const fileName = timestampName()
  const zipPath = path.join(dir, fileName)
  zip.writeZip(zipPath)
  const stat = fs.statSync(zipPath)
  return { fileName, size: stat.size, createdAt: stat.mtime.toISOString() }
}

/**
 * الاستعادة: يكتب ملفات المستندات أولًا، ثم يستبدل قاعدة البيانات (يحفظ لقطة
 * ما قبل الاستعادة بجانبها)، ويعيد الاتصال — الواجهة تعمل Reload بعدها.
 */
export async function restoreBackup(
  prisma: PrismaClient,
  fileName: string
): Promise<{ preRestore: string | null }> {
  const filePath = resolveBackupPath(fileName)
  const zip = new AdmZip(filePath)
  const dbEntry = zip.getEntry('hr-system.db')
  if (!dbEntry) throw new ApiError('VALIDATION', 'Backup does not contain the database')
  const dbData = zip.readFile(dbEntry)
  if (!dbData) throw new ApiError('INTERNAL', 'Could not read the backup database')

  const root = path.resolve(getAppDocsDir())
  zip.getEntries().forEach((entry) => {
    if (entry.isDirectory || !entry.entryName.startsWith('files/')) return
    const relative = entry.entryName.slice('files/'.length).split('/').join(path.sep)
    const target = path.resolve(root, relative)
    if (!target.startsWith(root + path.sep)) return // منع الخروج عن المجلد
    const content = zip.readFile(entry)
    if (content) {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, content)
    }
  })

  const dbPath = getDbPath()
  let preRestore: string | null = null
  try {
    preRestore = `${dbPath}.pre-restore-${Date.now()}`
    fs.copyFileSync(dbPath, preRestore)
  } catch {
    preRestore = null
  }

  await prisma.$disconnect()
  fs.rmSync(`${dbPath}-wal`, { force: true })
  fs.rmSync(`${dbPath}-shm`, { force: true })
  fs.writeFileSync(dbPath, dbData)
  await prisma.$connect()

  return { preRestore }
}

export function removeBackup(fileName: string): void {
  fs.rmSync(resolveBackupPath(fileName), { force: true })
}

export async function revealBackupsDir(): Promise<void> {
  await shell.openPath(ensureBackupsDir())
}
