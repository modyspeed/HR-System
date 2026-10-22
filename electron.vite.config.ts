import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// بعض البيئات (أدوات IDE، الترديم الآلي، أدوات مبنية على Electron) تصدّر
// ELECTRON_RUN_AS_NODE=1، فيعمل Electron كـ Node عادي: تصبح require('electron')
// مسار الملف التنفيذي بدل واجهة Electron، فيضيع `app` ويفشل الإقلاع فورًا.
// Electron يرث بيئة هذه العملية، فحذف المتغير قبل أن يشغّله electron-vite.
delete process.env.ELECTRON_RUN_AS_NODE

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/index.html') }
      }
    }
  }
})
