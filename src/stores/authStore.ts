import { create } from 'zustand'
import { api } from '@/services/apiClient'

export interface User {
  id: string
  username: string
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  initialize: () => Promise<void>
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  initialize: async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        set({ loading: false })
        return
      }
      const { user } = await api.auth.me()
      set({ user: { id: user.id, username: user.username }, loading: false })
    } catch {
      // Token invalid/expired — clear it
      localStorage.removeItem('auth_token')
      set({ loading: false })
    }
  },

  signIn: async (username: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { user, token } = await api.auth.login(username, password)
      localStorage.setItem('auth_token', token)
      set({ user, loading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sign in failed'
      set({ error: message, loading: false })
      throw e
    }
  },

  signUp: async (username: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { user, token } = await api.auth.register(username, password)
      localStorage.setItem('auth_token', token)
      set({ user, loading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Registration failed'
      set({ error: message, loading: false })
      throw e
    }
  },

  signOut: async () => {
    localStorage.removeItem('auth_token')
    set({ user: null })
  },

  clearError: () => set({ error: null }),
}))
