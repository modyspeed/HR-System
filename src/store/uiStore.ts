import { create } from 'zustand'
import i18n, { DEFAULT_LANGUAGE, dirFor, type Language } from '@/i18n'
import { api } from '@/lib/ipc'
import type { Theme } from '@shared/types'

export const DEFAULT_THEME: Theme = 'dark'

interface UiState {
  sidebarCollapsed: boolean
  language: Language
  theme: Theme
  commandOpen: boolean
  initialized: boolean

  toggleSidebar: () => void
  setCommandOpen: (open: boolean) => void
  applyLanguage: (language: Language) => void
  setLanguage: (language: Language) => Promise<void>
  applyTheme: (theme: Theme) => void
  setTheme: (theme: Theme) => Promise<void>
  toggleTheme: () => void
  hydrateUi: () => Promise<void>
}

function applyDocumentAttributes(language: Language): void {
  const dir = dirFor(language)
  document.documentElement.lang = language
  document.documentElement.dir = dir
  document.body.classList.toggle('font-arabic', language === 'ar')
}

function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle('light', theme === 'light')
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  language: DEFAULT_LANGUAGE,
  theme: DEFAULT_THEME,
  commandOpen: false,
  initialized: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandOpen: (open) => set({ commandOpen: open }),

  applyLanguage: (language) => {
    applyDocumentAttributes(language)
    void i18n.changeLanguage(language)
    set({ language })
  },

  setLanguage: async (language) => {
    get().applyLanguage(language)
    try {
      await api.settings.setLanguage(language)
    } catch {
      // persisted value is a nicety; the UI already switched
    }
  },

  applyTheme: (theme) => {
    applyThemeClass(theme)
    set({ theme })
  },

  setTheme: async (theme) => {
    get().applyTheme(theme)
    try {
      await api.settings.setTheme(theme)
    } catch {
      // persisted value is a nicety; the UI already switched
    }
  },

  toggleTheme: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light'
    void get().setTheme(next)
  },

  hydrateUi: async () => {
    let language: Language = DEFAULT_LANGUAGE
    let theme: Theme = DEFAULT_THEME
    try {
      const settings = await api.auth.bootstrap()
      language = settings.language
      theme = settings.theme
    } catch {
      language = DEFAULT_LANGUAGE
      theme = DEFAULT_THEME
    }
    applyDocumentAttributes(language)
    applyThemeClass(theme)
    await i18n.changeLanguage(language)
    set({ language, theme, initialized: true })
  }
}))
