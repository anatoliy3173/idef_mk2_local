import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/services/supabaseClient'
import { EMAIL_DOMAIN } from '@/lib/constants'

interface AuthState {
  user: User | null
  session: Session | null
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
  session: null,
  loading: true,
  error: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ session, user: session?.user ?? null, loading: false })

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null })
      })
    } catch {
      set({ loading: false })
    }
  },

  signIn: async (username: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const email = `${username}@${EMAIL_DOMAIN}`
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      set({ session: data.session, user: data.user, loading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sign in failed'
      set({ error: message, loading: false })
      throw e
    }
  },

  signUp: async (username: string, password: string) => {
    set({ loading: true, error: null })
    try {
      // Call edge function for user creation
      const { data, error } = await supabase.functions.invoke('captcha-verify', {
        body: { username, password },
      })
      if (error) {
        // Extract actual error message from Edge Function response body
        let message = error.message || 'Registration failed'
        try {
          const responseBody = await error.context?.json?.()
          if (responseBody?.error) message = responseBody.error
        } catch { /* body may already be consumed or unavailable */ }
        throw new Error(message)
      }
      if (data?.error) throw new Error(data.error as string)

      // Auto sign in after registration
      const email = `${username}@${EMAIL_DOMAIN}`
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
      set({ session: signInData.session, user: signInData.user, loading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Registration failed'
      set({ error: message, loading: false })
      throw e
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  clearError: () => set({ error: null }),
}))
