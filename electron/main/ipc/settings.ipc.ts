import { nativeTheme } from 'electron'
import { PrismaClient } from '@prisma/client'
import type { AppSettings, Theme } from '../../../shared/types'
import { requirePermission } from '../auth'
import type { IpcRegistry } from './registry'

const LANGUAGE_KEY = 'app.language'
const THEME_KEY = 'app.theme'
const SUPPORTED_LANGUAGES = new Set(['ar', 'en'])
const SUPPORTED_THEMES = new Set<Theme>(['dark', 'light'])

export function applyNativeTheme(theme: Theme): void {
  nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'
}

export function registerSettingsIpc(prisma: PrismaClient, ipc: IpcRegistry): void {
  ipc.handle('settings:getAll', async () => {
    // Reading app settings is public so the login screen can localise itself.
    return readSettings(prisma)
  })

  ipc.handle('settings:setLanguage', async (_event, language: 'ar' | 'en') => {
    requirePermission('settings.edit')
    if (!SUPPORTED_LANGUAGES.has(language)) {
      throw new Error('Unsupported language')
    }
    await prisma.setting.upsert({
      where: { key: LANGUAGE_KEY },
      create: { key: LANGUAGE_KEY, value: language },
      update: { value: language }
    })
  })

  ipc.handle('settings:setTheme', async (_event, theme: Theme) => {
    requirePermission('settings.edit')
    if (!SUPPORTED_THEMES.has(theme)) {
      throw new Error('Unsupported theme')
    }
    await prisma.setting.upsert({
      where: { key: THEME_KEY },
      create: { key: THEME_KEY, value: theme },
      update: { value: theme }
    })
    applyNativeTheme(theme)
  })
}

export async function readSettings(prisma: PrismaClient): Promise<AppSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [LANGUAGE_KEY, THEME_KEY] } }
  })
  const map = new Map(rows.map((row) => [row.key, row.value]))
  const language = map.get(LANGUAGE_KEY) === 'en' ? 'en' : 'ar'
  const theme: Theme = map.get(THEME_KEY) === 'light' ? 'light' : 'dark'
  return { language, theme }
}
