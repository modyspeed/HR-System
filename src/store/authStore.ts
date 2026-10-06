import { create } from 'zustand'
import { api } from '@/lib/ipc'
import type { SessionUser } from '@shared/types'

type Status = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: SessionUser | null
  status: Status
  error: string | null
  login: (username: string, password: string) => Promise<SessionUser>
  logout: () => Promise<void>
  hydrate: () => Promise<SessionUser | null>
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  login: async (username, password) => {
    set({ status: 'loading', error: null })
    try {
      const user = await api.auth.login({ username, password })
      set({ user, status: 'authenticated', error: null })
      return user
    } catch (error) {
      set({ status: 'unauthenticated', error: (error as Error).message })
      throw error
    }
  },

  logout: async () => {
    await api.auth.logout()
    set({ user: null, status: 'unauthenticated', error: null })
  },

  hydrate: async () => {
    try {
      const user = await api.auth.me()
      set({ user, status: user ? 'authenticated' : 'unauthenticated' })
      return user
    } catch {
      set({ user: null, status: 'unauthenticated' })
      return null
    }
  },

  reset: () => set({ user: null, status: 'idle', error: null })
}))
