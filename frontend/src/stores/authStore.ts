import { create, type StateCreator } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as authApi from '@/api/endpoints/auth'
import type { User } from '@/api/schemas/user'

export type AuthMode = 'authed' | 'guest' | 'anon'

export type AuthState = {
  user: User | null
  token: string | null
  mode: AuthMode
  /** Throws on invalid credentials. Stores token in localStorage on success. */
  login: (sid: string, password: string) => Promise<User>
  logout: () => void
  enterAsGuest: () => void
  /** Read existing token at boot; sets authed mode if me() returns a user. */
  hydrateFromToken: () => Promise<void>
}

const creator: StateCreator<
  AuthState,
  [['zustand/persist', unknown]]
> = (set, get) => ({
  user: null,
  token: null,
  mode: 'anon',
  login: async (sid, password) => {
    const { user, token } = await authApi.login(sid, password)
    localStorage.setItem(authApi.TOKEN_KEY, token)
    set({ user, token, mode: 'authed' })
    return user
  },
  logout: () => {
    localStorage.removeItem(authApi.TOKEN_KEY)
    set({ user: null, token: null, mode: 'anon' })
  },
  enterAsGuest: () => {
    set({ user: null, token: null, mode: 'guest' })
  },
  hydrateFromToken: async () => {
    const token = get().token ?? localStorage.getItem(authApi.TOKEN_KEY)
    if (!token) return
    try {
      const user = await authApi.me(token)
      if (user) set({ user, token, mode: 'authed' })
      else {
        localStorage.removeItem(authApi.TOKEN_KEY)
        set({ user: null, token: null, mode: 'anon' })
      }
    } catch {
      // Token invalid / network error — drop to anon, force re-login.
      localStorage.removeItem(authApi.TOKEN_KEY)
      set({ user: null, token: null, mode: 'anon' })
    }
  },
})

export const useAuthStore = create<AuthState>()(
  persist(creator, {
    name: 'labnotes.auth',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ user: s.user, token: s.token, mode: s.mode }),
  }),
)
