import { app, BrowserWindow, Menu, shell } from 'electron'
import { join } from 'path'
import { registerAllIpc } from './ipc'
import { applySnapshot, getPrisma } from './prisma'
import { seedIfNeeded } from './seed'
import { applyNativeTheme, readSettings } from './ipc/settings.ipc'

const isDev = !app.isPackaged

async function bootstrapDatabase(): Promise<void> {
  const prisma = getPrisma()
  await applySnapshot(prisma)
  await seedIfNeeded(prisma)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 660,
    show: false,
    autoHideMenuBar: true,
    title: 'HR System',
    backgroundColor: '#0A0A0C',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Chromium's PDF viewer (used by the in-app employee-file preview)
      plugins: true
    }
  })

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  try {
    await bootstrapDatabase()
  } catch (error) {
    console.error('[main] Database bootstrap failed:', error)
  }

  registerAllIpc(getPrisma())

  // align native chrome (scrollbars, title bar) with the persisted theme
  try {
    const { theme } = await readSettings(getPrisma())
    applyNativeTheme(theme)
  } catch (error) {
    console.error('[main] Failed to read theme:', error)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  await getPrisma().$disconnect()
})
